from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from django.db.models import Count, Q
from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer

from .models import (
    FAQ,
    AIAssistant,
    Address,
    Brand,
    CartItem,
    Category,
    ContactMessage,
    CustomerProfile,
    HeroSlide,
    Highlight,
    HomeSection,
    ListingPage,
    NavLink,
    NewsletterSubscriber,
    Order,
    OrderItem,
    Page,
    PageSection,
    Product,
    ProductImage,
    ProductSpecification,
    ProductVariant,
    PromoBanner,
    Review,
    SiteSettings,
    Testimonial,
    WishlistItem,
    mobile_validator,
)
from .storage import media_url

User = get_user_model()


class MediaURLField(serializers.Field):
    """Read-only absolute URL for an ImageField / FileField."""
    def __init__(self, **kwargs):
        kwargs['read_only'] = True
        super().__init__(**kwargs)

    def get_attribute(self, instance):
        return getattr(instance, self.source or self.field_name, None)

    def to_representation(self, value):
        return media_url(value, self.context.get('request'))


# ===========================================================================
# Site content
# ===========================================================================
class SiteSettingsSerializer(serializers.ModelSerializer):
    logo = MediaURLField()
    favicon = MediaURLField()
    login_image = MediaURLField()
    register_image = MediaURLField()
    auth_side_text = serializers.CharField(read_only=True)
    full_address = serializers.SerializerMethodField()

    class Meta:
        model = SiteSettings
        exclude = ('id', 'created_at', 'updated_at')

    def get_full_address(self, obj):
        parts = [obj.address_line1, obj.address_line2, f'{obj.city}, {obj.state} – {obj.pincode}', 'India']
        return ', '.join([p for p in parts if p])


class NavLinkSerializer(serializers.ModelSerializer):
    class Meta:
        model = NavLink
        fields = ('id', 'label', 'url', 'location', 'has_mega_menu', 'is_highlighted', 'order')


class HeroSlideSerializer(serializers.ModelSerializer):
    image = MediaURLField()
    model_3d = MediaURLField()

    class Meta:
        model = HeroSlide
        exclude = ('is_active',)


class HighlightSerializer(serializers.ModelSerializer):
    class Meta:
        model = Highlight
        fields = ('id', 'icon', 'title', 'subtitle', 'placement', 'order')


class PromoBannerSerializer(serializers.ModelSerializer):
    image = MediaURLField()

    class Meta:
        model = PromoBanner
        exclude = ('is_active',)


class TestimonialSerializer(serializers.ModelSerializer):
    avatar = MediaURLField()

    class Meta:
        model = Testimonial
        exclude = ('is_active',)


class FAQSerializer(serializers.ModelSerializer):
    category_label = serializers.CharField(source='get_category_display', read_only=True)

    class Meta:
        model = FAQ
        fields = ('id', 'category', 'category_label', 'question', 'answer', 'order')


class PageSectionSerializer(serializers.ModelSerializer):
    image = MediaURLField()

    class Meta:
        model = PageSection
        fields = ('id', 'title', 'text', 'image', 'image_on_left', 'order')


class PageSerializer(serializers.ModelSerializer):
    hero_image = MediaURLField()
    sections = PageSectionSerializer(many=True, read_only=True)

    class Meta:
        model = Page
        fields = ('slug', 'eyebrow', 'title', 'italic_title', 'subtitle', 'hero_image', 'content',
                  'meta_description', 'sections', 'updated_at')


class HomeSectionSerializer(serializers.ModelSerializer):
    class Meta:
        model = HomeSection
        fields = ('key', 'eyebrow', 'title', 'italic_title', 'subtitle', 'button_text', 'button_link',
                  'product_limit', 'order')


class AIAssistantSerializer(serializers.ModelSerializer):
    class Meta:
        model = AIAssistant
        fields = ('name', 'slug', 'description', 'welcome_message', 'is_default')


class ListingPageSerializer(serializers.ModelSerializer):
    banner_image = MediaURLField()
    category = serializers.SlugRelatedField(slug_field='slug', read_only=True)

    class Meta:
        model = ListingPage
        fields = ('slug', 'menu_label', 'eyebrow', 'title', 'italic_title', 'subtitle', 'banner_image',
                  'category', 'default_sort', 'meta_description')


# ===========================================================================
# Catalogue
# ===========================================================================
class CategorySerializer(serializers.ModelSerializer):
    image = MediaURLField()
    parent = serializers.SlugRelatedField(slug_field='slug', read_only=True)
    product_count = serializers.IntegerField(read_only=True, default=0)

    class Meta:
        model = Category
        fields = ('id', 'name', 'slug', 'parent', 'menu_group', 'description', 'image',
                  'show_in_menu', 'show_on_home', 'order', 'product_count')


class BrandSerializer(serializers.ModelSerializer):
    logo = MediaURLField()
    product_count = serializers.IntegerField(read_only=True, default=0)

    class Meta:
        model = Brand
        fields = ('id', 'name', 'slug', 'logo', 'product_count')


class ProductImageSerializer(serializers.ModelSerializer):
    image = MediaURLField()

    class Meta:
        model = ProductImage
        fields = ('id', 'image', 'alt_text', 'order')


class ProductVariantSerializer(serializers.ModelSerializer):
    label = serializers.CharField(read_only=True)
    effective_mrp = serializers.SerializerMethodField()
    discount_percent = serializers.SerializerMethodField()
    in_stock = serializers.SerializerMethodField()

    class Meta:
        model = ProductVariant
        fields = ('id', 'label', 'colour', 'colour_hex', 'capacity', 'sku', 'mrp', 'effective_mrp', 'price',
                  'discount_percent', 'stock', 'in_stock')

    def get_effective_mrp(self, obj):
        return str(obj.mrp or obj.product.mrp)

    def get_discount_percent(self, obj):
        mrp = obj.mrp or obj.product.mrp
        if mrp and obj.price < mrp:
            return int(round((mrp - obj.price) / mrp * 100))
        return 0

    def get_in_stock(self, obj):
        return obj.stock > 0


class ProductSpecificationSerializer(serializers.ModelSerializer):
    class Meta:
        model = ProductSpecification
        fields = ('label', 'value')


class CategoryMiniSerializer(serializers.ModelSerializer):
    class Meta:
        model = Category
        fields = ('id', 'name', 'slug')


class BrandMiniSerializer(serializers.ModelSerializer):
    class Meta:
        model = Brand
        fields = ('id', 'name', 'slug')


class ProductListSerializer(serializers.ModelSerializer):
    category = CategoryMiniSerializer(read_only=True)
    brand = BrandMiniSerializer(read_only=True)
    image = serializers.SerializerMethodField()
    hover_image = serializers.SerializerMethodField()
    discount_percent = serializers.IntegerField(read_only=True)
    in_stock = serializers.BooleanField(read_only=True)
    tag_label = serializers.CharField(source='get_tag_display', read_only=True)
    rating_avg = serializers.SerializerMethodField()
    review_count = serializers.SerializerMethodField()
    has_variants = serializers.SerializerMethodField()

    class Meta:
        model = Product
        fields = ('id', 'name', 'slug', 'sku', 'category', 'brand', 'short_description', 'mrp', 'sale_price',
                  'discount_percent', 'gst_rate', 'stock', 'in_stock', 'image', 'hover_image', 'badge_text', 'tag',
                  'tag_label', 'is_new', 'is_featured', 'capacity', 'colour', 'wattage', 'warranty',
                  'rating_avg', 'review_count', 'has_variants', 'created_at')

    def _images(self, obj):
        # uses prefetch_related('images') when available
        return list(obj.images.all())

    def get_image(self, obj):
        imgs = self._images(obj)
        return media_url(imgs[0].image, self.context.get('request')) if imgs else None

    def get_hover_image(self, obj):
        imgs = self._images(obj)
        return media_url(imgs[1].image, self.context.get('request')) if len(imgs) > 1 else None

    def get_rating_avg(self, obj):
        value = getattr(obj, 'rating_avg', None)
        return round(float(value), 1) if value else None

    def get_review_count(self, obj):
        return getattr(obj, 'review_count', 0) or 0

    def get_has_variants(self, obj):
        return any(v.is_active for v in obj.variants.all())


class ProductDetailSerializer(ProductListSerializer):
    images = ProductImageSerializer(many=True, read_only=True)
    variants = serializers.SerializerMethodField()
    specifications = serializers.SerializerMethodField()
    model_3d = MediaURLField()
    gst_amount = serializers.DecimalField(max_digits=10, decimal_places=2, read_only=True)
    rating_breakdown = serializers.SerializerMethodField()

    class Meta(ProductListSerializer.Meta):
        fields = ProductListSerializer.Meta.fields + (
            'description', 'images', 'variants', 'specifications', 'hsn_code', 'gst_amount', 'power_source',
            'dimensions', 'weight', 'material', 'cod_available', 'model_3d', 'meta_title', 'meta_description',
            'rating_breakdown',
        )

    def get_variants(self, obj):
        active = [v for v in obj.variants.all() if v.is_active]
        return ProductVariantSerializer(active, many=True, context=self.context).data

    def get_specifications(self, obj):
        base = [
            ('Brand', obj.brand.name if obj.brand else ''),
            ('Wattage', obj.wattage),
            ('Capacity', obj.capacity),
            ('Power source', obj.power_source),
            ('Colour', obj.colour),
            ('Material', obj.material),
            ('Dimensions', obj.dimensions),
            ('Weight', obj.weight),
            ('Warranty', obj.warranty),
            ('HSN code', obj.hsn_code),
            ('GST', f'{obj.gst_rate.normalize()}% (included in price)' if obj.gst_rate is not None else ''),
        ]
        rows = [{'label': k, 'value': v} for k, v in base if v]
        rows += [{'label': s.label, 'value': s.value} for s in obj.specifications.all()]
        return rows

    def get_rating_breakdown(self, obj):
        counts = obj.reviews.filter(is_approved=True).aggregate(
            **{f's{i}': Count('id', filter=Q(rating=i)) for i in range(1, 6)}
        )
        return {str(i): counts[f's{i}'] for i in range(5, 0, -1)}


class ReviewSerializer(serializers.ModelSerializer):
    user_name = serializers.SerializerMethodField()
    product = serializers.SlugRelatedField(slug_field='slug', queryset=Product.objects.filter(is_active=True))

    class Meta:
        model = Review
        fields = ('id', 'product', 'user_name', 'rating', 'title', 'comment', 'is_verified_purchase', 'created_at')
        read_only_fields = ('is_verified_purchase', 'created_at')

    def get_user_name(self, obj):
        u = obj.user
        if u.first_name:
            return f'{u.first_name} {u.last_name[:1]}.'.strip() if u.last_name else u.first_name
        return u.username

    def validate(self, attrs):
        request = self.context['request']
        if self.instance is None and Review.objects.filter(product=attrs['product'], user=request.user).exists():
            raise serializers.ValidationError('You have already reviewed this product.')
        return attrs


# ===========================================================================
# Cart & wishlist
# ===========================================================================
class CartItemSerializer(serializers.ModelSerializer):
    product = ProductListSerializer(read_only=True)
    variant = ProductVariantSerializer(read_only=True)
    unit_price = serializers.DecimalField(max_digits=10, decimal_places=2, read_only=True)
    unit_mrp = serializers.DecimalField(max_digits=10, decimal_places=2, read_only=True)
    line_total = serializers.DecimalField(max_digits=10, decimal_places=2, read_only=True)

    class Meta:
        model = CartItem
        fields = ('id', 'product', 'variant', 'quantity', 'unit_price', 'unit_mrp', 'line_total')


class CartItemWriteSerializer(serializers.Serializer):
    product = serializers.SlugRelatedField(slug_field='slug', queryset=Product.objects.filter(is_active=True))
    variant = serializers.PrimaryKeyRelatedField(
        queryset=ProductVariant.objects.filter(is_active=True), required=False, allow_null=True)
    quantity = serializers.IntegerField(min_value=1, max_value=10, default=1)

    def validate(self, attrs):
        product, variant = attrs['product'], attrs.get('variant')
        if variant and variant.product_id != product.id:
            raise serializers.ValidationError({'variant': 'This option does not belong to the product.'})
        stock = variant.stock if variant else product.stock
        if stock < 1:
            raise serializers.ValidationError('Sorry, this item is out of stock.')
        return attrs


class CartMergeSerializer(serializers.Serializer):
    items = CartItemWriteSerializer(many=True)


class WishlistItemSerializer(serializers.ModelSerializer):
    product = ProductListSerializer(read_only=True)
    product_slug = serializers.SlugRelatedField(
        slug_field='slug', source='product', queryset=Product.objects.filter(is_active=True), write_only=True)

    class Meta:
        model = WishlistItem
        fields = ('id', 'product', 'product_slug', 'created_at')


# ===========================================================================
# Addresses, orders
# ===========================================================================
class AddressSerializer(serializers.ModelSerializer):
    mobile_display = serializers.SerializerMethodField()

    class Meta:
        model = Address
        exclude = ('user',)
        read_only_fields = ('created_at', 'updated_at')

    def get_mobile_display(self, obj):
        return f'+91 {obj.mobile[:5]} {obj.mobile[5:]}' if obj.mobile else ''

    def validate_mobile(self, value):
        value = ''.join(ch for ch in value if ch.isdigit())[-10:]
        mobile_validator(value)
        return value


class OrderItemSerializer(serializers.ModelSerializer):
    product_slug = serializers.SerializerMethodField()

    class Meta:
        model = OrderItem
        fields = ('id', 'product_slug', 'product_name', 'variant_label', 'sku', 'hsn_code', 'gst_rate', 'image_url',
                  'unit_mrp', 'unit_price', 'quantity', 'line_total')

    def get_product_slug(self, obj):
        return obj.product.slug if obj.product_id and obj.product else None


class OrderSerializer(serializers.ModelSerializer):
    items = OrderItemSerializer(many=True, read_only=True)
    status_label = serializers.CharField(source='get_status_display', read_only=True)
    payment_status_label = serializers.CharField(source='get_payment_status_display', read_only=True)
    payment_method_label = serializers.CharField(source='get_payment_method_display', read_only=True)
    can_cancel = serializers.SerializerMethodField()

    class Meta:
        model = Order
        exclude = ('razorpay_signature', 'stock_deducted', 'user')

    def get_can_cancel(self, obj):
        return obj.status in ('pending_payment', 'placed', 'confirmed')


class CheckoutSerializer(serializers.Serializer):
    address_id = serializers.IntegerField(required=False)
    # Or a new address
    full_name = serializers.CharField(required=False, max_length=120)
    mobile = serializers.CharField(required=False, max_length=15)
    house = serializers.CharField(required=False, max_length=200)
    street = serializers.CharField(required=False, max_length=200)
    landmark = serializers.CharField(required=False, allow_blank=True, max_length=120)
    city = serializers.CharField(required=False, max_length=100)
    state = serializers.CharField(required=False, max_length=60)
    pincode = serializers.CharField(required=False, max_length=6)
    save_address = serializers.BooleanField(default=True)

    payment_method = serializers.ChoiceField(choices=['razorpay', 'cod'])
    notes = serializers.CharField(required=False, allow_blank=True, max_length=500)

    def validate(self, attrs):
        request = self.context['request']
        if attrs.get('address_id'):
            try:
                attrs['address'] = Address.objects.get(pk=attrs['address_id'], user=request.user)
            except Address.DoesNotExist:
                raise serializers.ValidationError({'address_id': 'Address not found.'})
            return attrs
        required = ['full_name', 'mobile', 'house', 'street', 'city', 'state', 'pincode']
        missing = [f for f in required if not attrs.get(f)]
        if missing:
            raise serializers.ValidationError({f: 'This field is required.' for f in missing})
        address = AddressSerializer(data={k: attrs.get(k, '') for k in required + ['landmark']})
        address.is_valid(raise_exception=True)
        attrs['address_data'] = address.validated_data
        return attrs


# ===========================================================================
# Auth
# ===========================================================================
class UserSerializer(serializers.ModelSerializer):
    mobile = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ('id', 'username', 'email', 'first_name', 'last_name', 'mobile', 'date_joined', 'is_staff')
        read_only_fields = ('id', 'username', 'date_joined', 'is_staff')

    def get_mobile(self, obj):
        profile = getattr(obj, 'profile', None)
        return profile.mobile if profile else ''


class ProfileUpdateSerializer(serializers.ModelSerializer):
    mobile = serializers.CharField(required=False, allow_blank=True, max_length=15)

    class Meta:
        model = User
        fields = ('first_name', 'last_name', 'email', 'mobile')

    def validate_email(self, value):
        if User.objects.filter(email__iexact=value).exclude(pk=self.instance.pk).exists():
            raise serializers.ValidationError('This email is already in use.')
        return value.lower()

    def validate_mobile(self, value):
        if not value:
            return ''
        value = ''.join(ch for ch in value if ch.isdigit())[-10:]
        mobile_validator(value)
        return value

    def update(self, instance, validated_data):
        mobile = validated_data.pop('mobile', None)
        instance = super().update(instance, validated_data)
        if mobile is not None:
            profile, _ = CustomerProfile.objects.get_or_create(user=instance)
            profile.mobile = mobile
            profile.save()
        return instance


class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, style={'input_type': 'password'})
    password2 = serializers.CharField(write_only=True, style={'input_type': 'password'})
    mobile = serializers.CharField(required=False, allow_blank=True, max_length=15)

    class Meta:
        model = User
        fields = ('username', 'email', 'first_name', 'last_name', 'mobile', 'password', 'password2')
        extra_kwargs = {'email': {'required': True}, 'first_name': {'required': True}}

    def validate_email(self, value):
        if User.objects.filter(email__iexact=value).exists():
            raise serializers.ValidationError('An account with this email already exists.')
        return value.lower()

    def validate_mobile(self, value):
        if not value:
            return ''
        value = ''.join(ch for ch in value if ch.isdigit())[-10:]
        mobile_validator(value)
        return value

    def validate(self, attrs):
        if attrs['password'] != attrs['password2']:
            raise serializers.ValidationError({'password2': 'Passwords do not match.'})
        temp_user = User(username=attrs.get('username'), email=attrs.get('email'),
                         first_name=attrs.get('first_name', ''), last_name=attrs.get('last_name', ''))
        validate_password(attrs['password'], user=temp_user)
        return attrs

    def create(self, validated_data):
        validated_data.pop('password2')
        mobile = validated_data.pop('mobile', '')
        password = validated_data.pop('password')
        user = User(**validated_data)
        user.set_password(password)
        user.save()
        CustomerProfile.objects.create(user=user, mobile=mobile)
        return user


class EmailOrUsernameTokenSerializer(TokenObtainPairSerializer):
    """Login with username OR email. Response also includes the user profile."""
    def validate(self, attrs):
        login = attrs.get(self.username_field, '')
        if '@' in login:
            user = User.objects.filter(email__iexact=login).first()
            if user:
                attrs[self.username_field] = user.get_username()
        data = super().validate(attrs)
        data['user'] = UserSerializer(self.user).data
        return data


class ChangePasswordSerializer(serializers.Serializer):
    old_password = serializers.CharField()
    new_password = serializers.CharField()

    def validate(self, attrs):
        user = self.context['request'].user
        if not user.check_password(attrs['old_password']):
            raise serializers.ValidationError({'old_password': 'Current password is incorrect.'})
        validate_password(attrs['new_password'], user=user)
        return attrs


class PasswordResetRequestSerializer(serializers.Serializer):
    email = serializers.EmailField()


class PasswordResetConfirmSerializer(serializers.Serializer):
    uid = serializers.CharField()
    token = serializers.CharField()
    new_password = serializers.CharField()


# ===========================================================================
# Leads
# ===========================================================================
class NewsletterSerializer(serializers.ModelSerializer):
    class Meta:
        model = NewsletterSubscriber
        fields = ('email',)
        extra_kwargs = {'email': {'validators': []}}


class ContactMessageSerializer(serializers.ModelSerializer):
    class Meta:
        model = ContactMessage
        fields = ('name', 'email', 'mobile', 'subject', 'message')

    def validate_mobile(self, value):
        if not value:
            return ''
        value = ''.join(ch for ch in value if ch.isdigit())[-10:]
        mobile_validator(value)
        return value
