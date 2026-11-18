import logging
"""
REST API for Rasoi & Co. — every response is JSON under /api/.
Public content is read-only (edit it in Django admin); cart, wishlist, addresses,
orders and reviews are per-user and need a JWT access token.
"""
from datetime import timedelta
from django.conf import settings
from django.contrib.auth import get_user_model
from django.contrib.auth.tokens import default_token_generator
from django.core.cache import cache
from django.core.mail import send_mail
from django.db import connection, transaction
from django.db.models import Count, F, Max, Min, Q
from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.utils.encoding import force_bytes, force_str
from django.utils.http import urlsafe_base64_decode, urlsafe_base64_encode
from rest_framework import filters, generics, mixins, permissions, status, viewsets
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.views import TokenObtainPairView

from .constants import INDIAN_STATES
from .filters import ProductFilter
from .models import (
    FAQ,
    AIAssistant,
    Address,
    Brand,
    Cart,
    CartItem,
    Category,
    HeroSlide,
    Highlight,
    HomeSection,
    ListingPage,
    NavLink,
    NewsletterSubscriber,
    Order,
    OrderItem,
    Page,
    Product,
    PromoBanner,
    Review,
    SiteSettings,
    Testimonial,
    WishlistItem,
)
from .serializers import (
    AIAssistantSerializer,
    AddressSerializer,
    BrandSerializer,
    CartItemSerializer,
    CartItemWriteSerializer,
    CategorySerializer,
    ChangePasswordSerializer,
    CheckoutSerializer,
    ContactMessageSerializer,
    EmailOrUsernameTokenSerializer,
    FAQSerializer,
    HeroSlideSerializer,
    HighlightSerializer,
    HomeSectionSerializer,
    ListingPageSerializer,
    NavLinkSerializer,
    NewsletterSerializer,
    OrderSerializer,
    PageSerializer,
    PasswordResetConfirmSerializer,
    PasswordResetRequestSerializer,
    ProductDetailSerializer,
    ProductListSerializer,
    ProfileUpdateSerializer,
    PromoBannerSerializer,
    RegisterSerializer,
    ReviewSerializer,
    SiteSettingsSerializer,
    TestimonialSerializer,
    UserSerializer,
    WishlistItemSerializer,
)
from .services import cart_lines, check_pincode, compute_totals, razorpay_client
from .storage import media_url

User = get_user_model()
CACHE_SECONDS = 60 * 10


def cached(key, builder, timeout=CACHE_SECONDS):
    data = cache.get(key)
    if data is None:
        data = builder()
        cache.set(key, data, timeout)
    return data


def product_queryset():
    return (
        Product.objects.active()
        .select_related('category', 'brand')
        .prefetch_related('images', 'variants')
        .with_ratings()
    )


def tokens_for(user):
    refresh = RefreshToken.for_user(user)
    return {'refresh': str(refresh), 'access': str(refresh.access_token)}


# ===========================================================================
# Health & site content
# ===========================================================================
@api_view(['GET'])
@permission_classes([permissions.AllowAny])
def health(request):
    db_ok = True
    try:
        with connection.cursor() as cursor:
            cursor.execute('SELECT 1')
    except Exception:
        db_ok = False
    return Response({'status': 'ok' if db_ok else 'degraded', 'database': db_ok, 'time': timezone.now()},
                    status=200 if db_ok else 503)


class SiteSettingsView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        data = cached('site_settings', lambda: SiteSettingsSerializer(
            SiteSettings.load(), context={'request': request}).data)
        return Response(data)


class MenuView(APIView):
    """Header links, footer links and the categories mega menu (grouped by menu_group)."""
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        def build():
            links = NavLink.objects.filter(is_active=True)
            cats = (Category.objects.filter(is_active=True, show_in_menu=True, parent__isnull=True)
                    .annotate(product_count=Count('products', filter=Q(products__is_active=True))))
            groups = {}
            for c in cats:
                groups.setdefault(c.menu_group or 'Shop by category', []).append(
                    {'name': c.name, 'slug': c.slug, 'product_count': c.product_count})
            return {
                'header': NavLinkSerializer(links.filter(location='header'), many=True).data,
                'footer_shop': NavLinkSerializer(links.filter(location='footer_shop'), many=True).data,
                'footer_care': NavLinkSerializer(links.filter(location='footer_care'), many=True).data,
                'mega_menu': [{'title': k, 'items': v} for k, v in groups.items()],
            }
        return Response(cached('menu', build))


class HomeView(APIView):
    """Everything the home page needs in ONE request. Section order & headings come from admin (Home page sections)."""
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        def build():
            ctx = {'request': request}
            sections = list(HomeSection.objects.filter(is_active=True))
            limits = {s.key: max(1, min(s.product_limit or 8, 12)) for s in sections}
            products = product_queryset()
            categories = (Category.objects.filter(is_active=True, show_on_home=True, parent__isnull=True)
                          .annotate(product_count=Count('products', filter=Q(products__is_active=True))))
            banners = PromoBanner.objects.filter(is_active=True)
            ai_banner = banners.filter(position='home_ai').first()

            def plist(qs, key):
                return ProductListSerializer(qs[:limits.get(key, 8)], many=True, context=ctx).data

            return {
                'sections': HomeSectionSerializer(sections, many=True).data,
                'hero_slides': HeroSlideSerializer(HeroSlide.objects.filter(is_active=True), many=True, context=ctx).data,
                'highlights': HighlightSerializer(
                    Highlight.objects.filter(is_active=True, placement__in=['hero', 'both']), many=True).data,
                'categories': CategorySerializer(categories, many=True, context=ctx).data,
                'featured': plist(products.filter(is_featured=True), 'featured'),
                'new_arrivals': plist(products.filter(is_new=True).order_by('-created_at'), 'new_arrivals'),
                'bestsellers': plist(products.order_by('-sold_count'), 'bestsellers'),
                'offers': plist(products.filter(sale_price__lt=F('mrp')).order_by('sale_price'), 'offers'),
                'banners': PromoBannerSerializer(banners.filter(position='home_top'), many=True, context=ctx).data,
                'ai_banner': PromoBannerSerializer(ai_banner, context=ctx).data if ai_banner else None,
                'testimonials': TestimonialSerializer(
                    Testimonial.objects.filter(is_active=True), many=True, context=ctx).data,
                'stats': {
                    'products': Product.objects.active().count(),
                    'categories': Category.objects.filter(is_active=True, parent__isnull=True).count(),
                    'brands': Brand.objects.filter(is_active=True).count(),
                },
            }
        return Response(cached('home', build, timeout=60 * 5))


class ListingPageViewSet(viewsets.ReadOnlyModelViewSet):
    """Admin-created product pages: /api/listing-pages/<slug>/ (Collections, New arrivals, Offers …)."""
    queryset = ListingPage.objects.filter(is_active=True)
    serializer_class = ListingPageSerializer
    lookup_field = 'slug'
    pagination_class = None


@api_view(['GET'])
@permission_classes([permissions.AllowAny])
def resolve_slug(request, slug):
    """Tells React what to show at /<slug>: a product listing page or a content page."""
    if ListingPage.objects.filter(slug=slug, is_active=True).exists():
        return Response({'type': 'listing', 'slug': slug})
    if Page.objects.filter(slug=slug, is_active=True).exists():
        return Response({'type': 'page', 'slug': slug})
    return Response({'type': 'not_found', 'slug': slug}, status=404)


class AIAssistantListView(generics.ListAPIView):
    permission_classes = [permissions.AllowAny]
    serializer_class = AIAssistantSerializer
    pagination_class = None
    queryset = AIAssistant.objects.filter(is_active=True)


class AIChatView(APIView):
    """
    POST /api/ai/chat/ {message, history: [{role, content}], assistant: "<slug>", language: "en|hi|ta|…"}
    → {reply, products: [...], source: "ai" | "smart-search"}
    """
    permission_classes = [permissions.AllowAny]
    throttle_scope = 'ai'

    def get_throttles(self):
        from rest_framework.throttling import ScopedRateThrottle
        return [ScopedRateThrottle()]

    def post(self, request):
        from .ai import chat
        message = str(request.data.get('message', '')).strip()
        if not message:
            raise ValidationError({'message': 'Please type a message.'})
        result = chat(
            message,
            history=request.data.get('history') or [],
            assistant_slug=request.data.get('assistant'),
            language=request.data.get('language', 'en'),
                        user=request.user,
            context_products=request.data.get('context_products') or [],
        )
        ctx = {'request': request}
        result['products'] = ProductListSerializer(result['products'], many=True, context=ctx).data
        action = result.get('cart_action')
        result['cart_action'] = ProductListSerializer(action, context=ctx).data if action else None
        return Response(result)


class HeroSlideViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = HeroSlide.objects.filter(is_active=True)
    serializer_class = HeroSlideSerializer
    pagination_class = None


class HighlightViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = Highlight.objects.filter(is_active=True)
    serializer_class = HighlightSerializer
    pagination_class = None
    filterset_fields = ['placement']


class PromoBannerViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = PromoBanner.objects.filter(is_active=True)
    serializer_class = PromoBannerSerializer
    pagination_class = None
    filterset_fields = ['position']


class TestimonialViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = Testimonial.objects.filter(is_active=True)
    serializer_class = TestimonialSerializer
    pagination_class = None


class FAQViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = FAQ.objects.filter(is_active=True)
    serializer_class = FAQSerializer
    pagination_class = None
    filterset_fields = ['category']
    search_fields = ['question', 'answer']


class PageViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = Page.objects.filter(is_active=True).prefetch_related('sections')
    serializer_class = PageSerializer
    lookup_field = 'slug'
    pagination_class = None


@api_view(['GET'])
@permission_classes([permissions.AllowAny])
def indian_states(request):
    return Response([{'value': v, 'label': label} for v, label in INDIAN_STATES])


# ===========================================================================
# Catalogue
# ===========================================================================
class CategoryViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = CategorySerializer
    lookup_field = 'slug'
    pagination_class = None
    filterset_fields = ['show_on_home', 'show_in_menu', 'menu_group']
    search_fields = ['name']

    def get_queryset(self):
        return (Category.objects.filter(is_active=True).select_related('parent')
                .annotate(product_count=Count('products', filter=Q(products__is_active=True))))


class BrandViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = BrandSerializer
    lookup_field = 'slug'
    pagination_class = None

    def get_queryset(self):
        return (Brand.objects.filter(is_active=True)
                .annotate(product_count=Count('products', filter=Q(products__is_active=True))))


SORT_MAP = {
    'newest': '-created_at',
    'price_low': 'sale_price',
    'price_high': '-sale_price',
    'popular': '-sold_count',
    'rating': '-rating_avg',
    'name': 'name',
}


class ProductViewSet(viewsets.ReadOnlyModelViewSet):
    """
    GET /api/products/?category=&brand=&min_price=&max_price=&capacity=&colour=&in_stock=true
                      &search=&ordering=-created_at   (or &sort=newest|price_low|price_high|popular|rating)
    GET /api/products/<slug>/
    GET /api/products/<slug>/related/
    GET /api/products/facets/?category=
    """
    lookup_field = 'slug'
    filterset_class = ProductFilter
    search_fields = ['name', 'short_description', 'category__name', 'brand__name', 'capacity', 'colour', 'tag']
    ordering_fields = ['sale_price', 'created_at', 'sold_count', 'rating_avg', 'name', 'mrp']
    ordering = ['-created_at']

    def get_queryset(self):
        qs = product_queryset()
        if self.action == 'retrieve':
            qs = qs.prefetch_related('specifications')
        sort = self.request.query_params.get('sort')
        if sort in SORT_MAP and not self.request.query_params.get('ordering'):
            qs = qs.order_by(SORT_MAP[sort], '-id')
        return qs

    def filter_queryset(self, queryset):
        sort = self.request.query_params.get('sort')
        if sort in SORT_MAP and not self.request.query_params.get('ordering'):
            # skip OrderingFilter default so ?sort= wins
            for backend in list(self.filter_backends):
                if backend is filters.OrderingFilter:
                    continue
                queryset = backend().filter_queryset(self.request, queryset, self)
            return queryset
        return super().filter_queryset(queryset)

    def get_serializer_class(self):
        return ProductDetailSerializer if self.action == 'retrieve' else ProductListSerializer

    @action(detail=True, methods=['get'])
    def related(self, request, slug=None):
        product = self.get_object()
        qs = (product_queryset().filter(category=product.category).exclude(pk=product.pk)
              .order_by('-sold_count', '-created_at')[:8])
        return Response(ProductListSerializer(qs, many=True, context={'request': request}).data)

    @action(detail=False, methods=['get'])
    def facets(self, request):
        """Options for the shop filter panel (brands, capacities, colours, ₹ price range)."""
        qs = ProductFilter(
            {k: v for k, v in request.query_params.items() if k in ('category', 'is_new', 'on_sale', 'tag', 'listing')},
            queryset=Product.objects.active(),
        ).qs
        price = qs.aggregate(min=Min('sale_price'), max=Max('sale_price'))
        brands = (Brand.objects.filter(products__in=qs).annotate(n=Count('products', filter=Q(products__in=qs)))
                  .values('name', 'slug', 'n').order_by('name').distinct())
        capacities = sorted({c for c in qs.exclude(capacity='').values_list('capacity', flat=True)})
        colours = sorted({c for c in qs.exclude(colour='').values_list('colour', flat=True)})
        return Response({
            'price_min': price['min'] or 0,
            'price_max': price['max'] or 0,
            'brands': [{'name': b['name'], 'slug': b['slug'], 'count': b['n']} for b in brands],
            'capacities': capacities,
            'colours': colours,
            'tags': [{'value': v, 'label': label} for v, label in Product.TAG_CHOICES if v],
            'total': qs.count(),
        })


@api_view(['GET'])
@permission_classes([permissions.AllowAny])
def search_suggest(request):
    q = request.query_params.get('q', '').strip()
    if len(q) < 2:
        return Response({'products': [], 'categories': []})
    products = product_queryset().filter(
        Q(name__icontains=q) | Q(brand__name__icontains=q) | Q(category__name__icontains=q))[:6]
    categories = Category.objects.filter(is_active=True, name__icontains=q)[:4]
    return Response({
        'products': ProductListSerializer(products, many=True, context={'request': request}).data,
        'categories': [{'name': c.name, 'slug': c.slug} for c in categories],
    })


class ReviewViewSet(mixins.ListModelMixin, mixins.CreateModelMixin, mixins.UpdateModelMixin,
                    mixins.DestroyModelMixin, viewsets.GenericViewSet):
    """GET /api/reviews/?product=<slug>  ·  POST (logged in)  ·  PATCH/DELETE own review."""
    serializer_class = ReviewSerializer

    def get_permissions(self):
        if self.action == 'list':
            return [permissions.AllowAny()]
        return [permissions.IsAuthenticated()]

    def get_queryset(self):
        qs = Review.objects.filter(is_approved=True).select_related('user', 'product')
        if self.action in ('update', 'partial_update', 'destroy'):
            return Review.objects.filter(user=self.request.user)
        slug = self.request.query_params.get('product')
        return qs.filter(product__slug=slug) if slug else qs

    def perform_create(self, serializer):
        product = serializer.validated_data['product']
        verified = OrderItem.objects.filter(
            order__user=self.request.user, product=product, order__payment_status='paid').exists() or \
            OrderItem.objects.filter(order__user=self.request.user, product=product, order__status='delivered').exists()
        serializer.save(user=self.request.user, is_verified_purchase=verified)
        cache.delete('home')


# ===========================================================================
# Delivery
# ===========================================================================
@api_view(['GET'])
@permission_classes([permissions.AllowAny])
def pincode_check(request, pincode):
    return Response(check_pincode(pincode))


# ===========================================================================
# Cart
# ===========================================================================
def get_cart(user):
    cart, _ = Cart.objects.get_or_create(user=user)
    return cart


def cart_payload(cart, request):
    items = (cart.items.select_related('product__category', 'product__brand', 'variant')
             .prefetch_related('product__images', 'product__variants'))
    totals = compute_totals(cart_lines(cart), payment_method=request.query_params.get('payment_method'))
    return {
        'items': CartItemSerializer(items, many=True, context={'request': request}).data,
        'totals': totals,
    }


class CartView(APIView):
    """GET /api/cart/  — items + ₹ totals (add ?payment_method=cod to include COD fee)."""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        return Response(cart_payload(get_cart(request.user), request))


class CartItemViewSet(mixins.CreateModelMixin, mixins.UpdateModelMixin, mixins.DestroyModelMixin,
                      viewsets.GenericViewSet):
    """
    POST   /api/cart/items/           {product: "<slug>", variant: <id|null>, quantity: 1}
    PATCH  /api/cart/items/<id>/      {quantity: 2}
    DELETE /api/cart/items/<id>/
    POST   /api/cart/items/merge/     {items: [{product, variant, quantity}, ...]}  (guest cart → account)
    POST   /api/cart/items/clear/
    """
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = CartItemWriteSerializer

    def get_queryset(self):
        return CartItem.objects.filter(cart__user=self.request.user)

    @staticmethod
    def _add(cart, product, variant, quantity, replace=False):
        stock = variant.stock if variant else product.stock
        item, created = CartItem.objects.get_or_create(
            cart=cart, product=product, variant=variant, defaults={'quantity': 0})
        new_qty = quantity if replace else item.quantity + quantity
        item.quantity = max(1, min(new_qty, 10, stock))
        item.save()
        return item

    def create(self, request, *args, **kwargs):
        serializer = CartItemWriteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        d = serializer.validated_data
        cart = get_cart(request.user)
        self._add(cart, d['product'], d.get('variant'), d['quantity'])
        return Response(cart_payload(cart, request), status=status.HTTP_201_CREATED)

    def partial_update(self, request, *args, **kwargs):
        item = self.get_object()
        try:
            qty = int(request.data.get('quantity', item.quantity))
        except (TypeError, ValueError):
            raise ValidationError({'quantity': 'Enter a number.'})
        stock = item.variant.stock if item.variant else item.product.stock
        if qty < 1:
            item.delete()
        else:
            item.quantity = max(1, min(qty, 10, stock or 1))
            item.save()
        return Response(cart_payload(get_cart(request.user), request))

    def update(self, request, *args, **kwargs):
        return self.partial_update(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        self.get_object().delete()
        return Response(cart_payload(get_cart(request.user), request))

    @action(detail=False, methods=['post'])
    def merge(self, request):
        cart = get_cart(request.user)
        for raw in request.data.get('items', []) or []:
            s = CartItemWriteSerializer(data=raw)
            if s.is_valid():
                d = s.validated_data
                self._add(cart, d['product'], d.get('variant'), d['quantity'])
        return Response(cart_payload(cart, request))

    @action(detail=False, methods=['post'])
    def clear(self, request):
        get_cart(request.user).items.all().delete()
        return Response(cart_payload(get_cart(request.user), request))


# ===========================================================================
# Wishlist
# ===========================================================================
class WishlistViewSet(mixins.ListModelMixin, mixins.CreateModelMixin, mixins.DestroyModelMixin,
                      viewsets.GenericViewSet):
    """GET/POST /api/wishlist/ · DELETE /api/wishlist/<id>/ · POST /api/wishlist/toggle/ {product_slug}"""
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = WishlistItemSerializer
    pagination_class = None

    def get_queryset(self):
        return (WishlistItem.objects.filter(user=self.request.user)
                .select_related('product__category', 'product__brand')
                .prefetch_related('product__images', 'product__variants'))

    def perform_create(self, serializer):
        product = serializer.validated_data['product']
        if WishlistItem.objects.filter(user=self.request.user, product=product).exists():
            raise ValidationError('Already in your wishlist.')
        serializer.save(user=self.request.user)

    @action(detail=False, methods=['post'])
    def toggle(self, request):
        product = get_object_or_404(Product, slug=request.data.get('product_slug'), is_active=True)
        item = WishlistItem.objects.filter(user=request.user, product=product).first()
        if item:
            item.delete()
            added = False
        else:
            WishlistItem.objects.create(user=request.user, product=product)
            added = True
        slugs = list(WishlistItem.objects.filter(user=request.user).values_list('product__slug', flat=True))
        return Response({'added': added, 'slugs': slugs})


# ===========================================================================
# Addresses
# ===========================================================================
class AddressViewSet(viewsets.ModelViewSet):
    """Full CRUD: GET/POST /api/addresses/ · GET/PUT/PATCH/DELETE /api/addresses/<id>/"""
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = AddressSerializer
    pagination_class = None

    def get_queryset(self):
        return Address.objects.filter(user=self.request.user)

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)


# ===========================================================================
# Orders & checkout
# ===========================================================================
class OrderViewSet(mixins.ListModelMixin, mixins.RetrieveModelMixin, mixins.CreateModelMixin,
                   viewsets.GenericViewSet):
    """
    GET  /api/orders/                         my orders
    POST /api/orders/                         checkout from cart (address + payment_method)
    GET  /api/orders/<order_number>/
    POST /api/orders/<order_number>/cancel/
    """
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = OrderSerializer
    lookup_field = 'order_number'

    def get_queryset(self):
        return Order.objects.filter(user=self.request.user).prefetch_related('items')

    def create(self, request, *args, **kwargs):
        checkout = CheckoutSerializer(data=request.data, context={'request': request})
        checkout.is_valid(raise_exception=True)
        data = checkout.validated_data
        user = request.user
        cart = get_cart(user)
        items = list(cart.items.select_related('product', 'variant').prefetch_related('product__images'))
        if not items:
            raise ValidationError({'detail': 'Your bag is empty.'})

        # Stock check
        for item in items:
            stock = item.variant.stock if item.variant else item.product.stock
            if not item.product.is_active or stock < item.quantity:
                raise ValidationError({'detail': f'Only {stock} left of "{item.product.name}". Please update your bag.'})

        # Address
        if data.get('address'):
            a = data['address']
            addr = {f: getattr(a, f) for f in ('full_name', 'mobile', 'house', 'street', 'landmark', 'city', 'state', 'pincode')}
        else:
            addr = dict(data['address_data'])
            if data.get('save_address', True):
                Address.objects.create(user=user, **addr)

        delivery = check_pincode(addr['pincode'])
        if not delivery.get('serviceable'):
            raise ValidationError({'pincode': delivery.get('message', 'We do not deliver to this PIN code yet.')})

        method = data['payment_method']
        site = SiteSettings.load()
        totals = compute_totals(cart_lines(cart), site=site, payment_method=method)
        if method == 'cod':
            if not delivery.get('cod_available') or not totals['cod_allowed'] \
                    or any(not i.product.cod_available for i in items):
                raise ValidationError({'payment_method': 'Cash on Delivery is not available for this order.'})

        with transaction.atomic():
            order = Order.objects.create(
                user=user,
                email=user.email,
                **addr,
                subtotal=totals['subtotal'],
                mrp_total=totals['mrp_total'],
                discount=totals['discount'],
                shipping_fee=totals['shipping_fee'],
                cod_fee=totals['cod_fee'],
                gst_amount=totals['gst_amount'],
                total=totals['total'],
                payment_method=method,
                payment_status='pending',
                status='placed' if method == 'cod' else 'pending_payment',
                estimated_delivery=timezone.localdate() + timedelta(days=delivery.get('delivery_days', 6)),
                notes=data.get('notes', ''),
            )
            for item in items:
                imgs = list(item.product.images.all())
                OrderItem.objects.create(
                    order=order,
                    product=item.product,
                    variant=item.variant,
                    product_name=item.product.name,
                    variant_label=item.variant.label if item.variant else '',
                    sku=(item.variant.sku if item.variant and item.variant.sku else item.product.sku),
                    hsn_code=item.product.hsn_code,
                    gst_rate=item.product.gst_rate,
                    image_url=media_url(imgs[0].image, request) if imgs else '',
                    unit_mrp=item.unit_mrp,
                    unit_price=item.unit_price,
                    quantity=item.quantity,
                    line_total=item.line_total,
                )
            if method == 'cod':
                order.deduct_stock()
                cart.items.all().delete()

        return Response(OrderSerializer(order, context={'request': request}).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['post'])
    def cancel(self, request, order_number=None):
        order = self.get_object()
        if order.status not in ('pending_payment', 'placed', 'confirmed'):
            raise ValidationError({'detail': 'This order can no longer be cancelled.'})
        with transaction.atomic():
            if order.stock_deducted:
                for item in order.items.select_related('product', 'variant'):
                    if item.variant_id and item.variant:
                        item.variant.stock += item.quantity
                        item.variant.save(update_fields=['stock'])
                    if item.product_id and item.product:
                        item.product.stock += item.quantity
                        item.product.sold_count = max(0, item.product.sold_count - item.quantity)
                        item.product.save(update_fields=['stock', 'sold_count'])
                order.stock_deducted = False
            order.status = 'cancelled'
            if order.payment_status == 'paid':
                order.notes = (order.notes + '\nRefund to be initiated (cancelled by customer).').strip()
            order.save()
        return Response(OrderSerializer(order, context={'request': request}).data)


# ===========================================================================
# Razorpay
# ===========================================================================
class RazorpayCreateOrderView(APIView):
    """POST /api/payments/razorpay/create-order/  {order_number}"""
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        order = get_object_or_404(Order, order_number=request.data.get('order_number'), user=request.user)
        if order.payment_method != 'razorpay' or order.payment_status == 'paid':
            raise ValidationError({'detail': 'This order does not need online payment.'})
        client = razorpay_client()
        if client is None:
            return Response({'detail': 'Online payments are not configured yet. Please choose Cash on Delivery.'},
                            status=status.HTTP_503_SERVICE_UNAVAILABLE)
        rp_order = client.order.create({
            'amount': order.amount_in_paise,
            'currency': 'INR',
            'receipt': order.order_number,
            'notes': {'order_number': order.order_number, 'email': order.email},
        })
        order.razorpay_order_id = rp_order['id']
        order.save(update_fields=['razorpay_order_id'])
        site = SiteSettings.load()
        return Response({
            'key_id': settings.RAZORPAY_KEY_ID,
            'razorpay_order_id': rp_order['id'],
            'amount': order.amount_in_paise,
            'currency': 'INR',
            'order_number': order.order_number,
            'name': site.store_name,
            'description': f'Order {order.order_number}',
            'prefill': {'name': order.full_name, 'email': order.email, 'contact': f'+91{order.mobile}'},
            'theme_color': '#B87333',
        })


class RazorpayVerifyView(APIView):
    """POST /api/payments/razorpay/verify/ {order_number, razorpay_order_id, razorpay_payment_id, razorpay_signature}"""
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        order = get_object_or_404(Order, order_number=request.data.get('order_number'), user=request.user)
        params = {
            'razorpay_order_id': request.data.get('razorpay_order_id', ''),
            'razorpay_payment_id': request.data.get('razorpay_payment_id', ''),
            'razorpay_signature': request.data.get('razorpay_signature', ''),
        }
        if params['razorpay_order_id'] != order.razorpay_order_id:
            raise ValidationError({'detail': 'Payment does not match this order.'})
        client = razorpay_client()
        if client is None:
            return Response({'detail': 'Payments not configured.'}, status=status.HTTP_503_SERVICE_UNAVAILABLE)
        try:
            client.utility.verify_payment_signature(params)
        except Exception:
            order.payment_status = 'failed'
            order.save(update_fields=['payment_status'])
            raise ValidationError({'detail': 'Payment verification failed. If money was debited, it will be refunded.'})

        with transaction.atomic():
            order.razorpay_payment_id = params['razorpay_payment_id']
            order.razorpay_signature = params['razorpay_signature']
            order.payment_status = 'paid'
            order.status = 'confirmed'
            order.save()
            order.deduct_stock()
            get_cart(request.user).items.all().delete()
        return Response(OrderSerializer(order, context={'request': request}).data)


class RazorpayFailedView(APIView):
    """POST /api/payments/razorpay/failed/ {order_number}"""
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        order = get_object_or_404(Order, order_number=request.data.get('order_number'), user=request.user)
        if order.payment_status != 'paid':
            order.payment_status = 'failed'
            order.save(update_fields=['payment_status'])
        return Response({'detail': 'Payment marked as failed. You can retry from My Orders.'})


# ===========================================================================
# Auth
# ===========================================================================
class RegisterView(generics.CreateAPIView):
    permission_classes = [permissions.AllowAny]
    serializer_class = RegisterSerializer

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        return Response({**tokens_for(user), 'user': UserSerializer(user).data}, status=status.HTTP_201_CREATED)


class LoginView(TokenObtainPairView):
    """POST /api/auth/login/ {username (or email), password} → {access, refresh, user}"""
    serializer_class = EmailOrUsernameTokenSerializer


class MeView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        return Response(UserSerializer(request.user).data)

    def patch(self, request):
        s = ProfileUpdateSerializer(request.user, data=request.data, partial=True)
        s.is_valid(raise_exception=True)
        s.save()
        return Response(UserSerializer(request.user).data)


class ChangePasswordView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        s = ChangePasswordSerializer(data=request.data, context={'request': request})
        s.is_valid(raise_exception=True)
        request.user.set_password(s.validated_data['new_password'])
        request.user.save()
        return Response({'detail': 'Password updated.', **tokens_for(request.user)})


class PasswordResetRequestView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        s = PasswordResetRequestSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        user = User.objects.filter(email__iexact=s.validated_data['email'], is_active=True).first()
        if user:
            uid = urlsafe_base64_encode(force_bytes(user.pk))
            token = default_token_generator.make_token(user)
            link = f'{settings.FRONTEND_URL.rstrip("/")}/reset-password/{uid}/{token}'
            site = SiteSettings.load()
            send_mail(
                subject=f'Reset your {site.store_name} password',
                message=f'Hi {user.first_name or user.username},\n\nReset your password here:\n{link}\n\n'
                        f'If you did not ask for this, you can ignore this email.\n\n— {site.store_name}',
                from_email=settings.DEFAULT_FROM_EMAIL,
                recipient_list=[user.email],
                fail_silently=True,
            )
        return Response({'detail': 'If an account exists for this email, a reset link has been sent.'})


class PasswordResetConfirmView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        s = PasswordResetConfirmSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        try:
            user = User.objects.get(pk=force_str(urlsafe_base64_decode(s.validated_data['uid'])))
        except (User.DoesNotExist, ValueError, TypeError, OverflowError):
            raise ValidationError({'detail': 'This reset link is invalid.'})
        if not default_token_generator.check_token(user, s.validated_data['token']):
            raise ValidationError({'detail': 'This reset link has expired. Please request a new one.'})
        from django.contrib.auth.password_validation import validate_password
        validate_password(s.validated_data['new_password'], user=user)
        user.set_password(s.validated_data['new_password'])
        user.save()
        return Response({'detail': 'Password reset. You can now sign in.'})


# ===========================================================================
# Leads
# ===========================================================================
class NewsletterView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        s = NewsletterSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        sub, created = NewsletterSubscriber.objects.get_or_create(email=s.validated_data['email'].lower())
        if not sub.is_active:
            sub.is_active = True
            sub.save()
        return Response({'detail': 'Thank you for subscribing!' if created else "You're already on the list."},
                        status=status.HTTP_201_CREATED if created else status.HTTP_200_OK)


class ContactMessageView(generics.CreateAPIView):
    permission_classes = [permissions.AllowAny]
    serializer_class = ContactMessageSerializer

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        msg = serializer.save()
        notify_store_of_contact(msg)
        return Response({'detail': "Thank you! We'll get back to you within 24 hours."}, status=status.HTTP_201_CREATED)


def notify_store_of_contact(msg):
    """Email the store (Site settings → Email) about a new Contact us message. Never breaks the form."""
    from django.core.mail import EmailMessage

    to_email = SiteSettings.load().email
    if not to_email:
        return
    data = {f: getattr(msg, f, '') for f in ('name', 'email', 'mobile', 'phone', 'subject', 'message')}
    body = '\n'.join([
        'New message from the Contact us page',
        '',
        f"Name: {data['name']}",
        f"Email: {data['email']}",
        f"Mobile: {data['mobile'] or data['phone'] or '-'}",
        f"Subject: {data['subject'] or '-'}",
        '',
        str(data['message'] or ''),
        '',
        'Reply to this email to answer the customer directly.',
    ])
    try:
        EmailMessage(
            subject=f"[Rasoi & Co.] Contact: {data['subject'] or data['name']}",
            body=body,
            to=[to_email],
            reply_to=[data['email']] if data['email'] else None,
        ).send(fail_silently=False)
    except Exception as exc:  # the message is still saved in admin
        logging.getLogger(__name__).error('Contact email failed: %s', exc)
