"""
Rasoi & Co. — all website content and shop data.
Everything here is editable from Django admin (/admin), so nothing is hard-coded in React.
"""
import uuid
from decimal import Decimal

from django.conf import settings
from django.core.validators import (
    FileExtensionValidator,
    MaxValueValidator,
    MinValueValidator,
    RegexValidator,
)
from django.db import models
from django.db.models import Avg, Count
from django.utils import timezone
from django.utils.text import slugify

from .constants import GST_RATE_CHOICES, INDIAN_STATES

# ---------------------------------------------------------------------------
# Validators (India)
# ---------------------------------------------------------------------------
mobile_validator = RegexValidator(
    regex=r'^[6-9]\d{9}$',
    message='Enter a valid 10-digit Indian mobile number (starts with 6, 7, 8 or 9).',
)
pincode_validator = RegexValidator(
    regex=r'^[1-9]\d{5}$',
    message='Enter a valid 6-digit PIN code.',
)
hex_color_validator = RegexValidator(
    regex=r'^#(?:[0-9a-fA-F]{3}){1,2}$',
    message='Enter a hex colour like #F1E7DC.',
)
glb_validator = FileExtensionValidator(allowed_extensions=['glb', 'gltf'])

MONEY = {'max_digits': 10, 'decimal_places': 2}


def unique_slug(instance, value, slug_field='slug'):
    base = slugify(value)[:200] or uuid.uuid4().hex[:8]
    slug = base
    model = instance.__class__
    n = 2
    while model.objects.filter(**{slug_field: slug}).exclude(pk=instance.pk).exists():
        slug = f'{base}-{n}'
        n += 1
    return slug


RESERVED_SLUGS = {
    'admin', 'api', 'static', 'media', 'shop-all', 'category', 'product', 'search', 'cart', 'checkout',
    'order-success', 'account', 'login', 'register', 'forgot-password', 'reset-password', 'faq', 'contact',
}


def sync_menu_link(source, show, label, url, order=0, has_mega_menu=False):
    """Create / update / remove the header menu link for an admin-created page."""
    if show:
        link = NavLink.objects.filter(source=source).first() or NavLink.objects.filter(location='header', url=url).first()
        if link is None:
            link = NavLink(location='header')
        link.source = source
        link.label = label
        link.url = url
        link.order = order
        link.has_mega_menu = has_mega_menu
        link.is_active = True
        link.save()
    else:
        NavLink.objects.filter(source=source).delete()


class TimeStamped(models.Model):
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        abstract = True


# ===========================================================================
# 1. SITE CONTENT
# ===========================================================================
class SiteSettings(TimeStamped):
    """Single row that controls logo, announcement bar, contact info, footer, etc."""
    store_name = models.CharField(max_length=100, default='Rasoi & Co.')
    tagline = models.CharField(max_length=200, default='Smart kitchens, beautifully made.')
    logo_subtext = models.CharField(max_length=120, default='KITCHEN APPLIANCES, THOUGHTFULLY CHOSEN')
    logo = models.ImageField(upload_to='site/', blank=True, null=True, max_length=500)
    favicon = models.ImageField(upload_to='site/', blank=True, null=True, max_length=500)
        # Sign in / Create account pages (left image panel)
    login_image = models.ImageField(upload_to='site/', blank=True, null=True, max_length=500,
                                    help_text='Image on the Sign in page. Portrait or square works best (e.g. 800×800).')
    register_image = models.ImageField(upload_to='site/', blank=True, null=True, max_length=500,
                                       help_text='Image on the Create account page. Leave empty to use the Sign in image.')
    auth_side_text = models.CharField(max_length=200, blank=True,
                                      default='Welcome to the Rasoi circle — saved addresses, faster checkout and order tracking.',
                                      help_text='Short line under the image on Sign in / Create account.')

    announcement_text = models.CharField(
        max_length=255,
        default='Free shipping over ₹1,999 · 2-year warranty on all appliances',
    )
    announcement_link = models.CharField(max_length=255, blank=True)
    show_announcement = models.BooleanField(default=True)

    # Contact (India)
    email = models.EmailField(default='hello@rasoiandco.in')
    phone = models.CharField(max_length=20, default='+91 98765 43210')
    whatsapp = models.CharField(max_length=20, default='+91 98765 43210', help_text='With country code, e.g. +91 98765 43210')
    address_line1 = models.CharField(max_length=200, default='12, Lotus Business Park, Andheri East')
    address_line2 = models.CharField(max_length=200, blank=True, default='Near Western Express Highway')
    city = models.CharField(max_length=100, default='Mumbai')
    state = models.CharField(max_length=60, choices=INDIAN_STATES, default='Maharashtra')
    pincode = models.CharField(max_length=6, default='400069', validators=[pincode_validator])
    business_hours = models.CharField(max_length=120, default='Mon – Sat, 10 AM – 7 PM IST')
    gstin = models.CharField('GSTIN', max_length=15, blank=True)

    # Social
    instagram_url = models.URLField(blank=True)
    facebook_url = models.URLField(blank=True)
    youtube_url = models.URLField(blank=True)
    pinterest_url = models.URLField(blank=True)
    twitter_url = models.URLField('X / Twitter URL', blank=True)
    linkedin_url = models.URLField(blank=True)

    # Footer
    footer_eyebrow = models.CharField(max_length=100, default='THE RASOI CIRCLE')
    footer_cta_title = models.CharField(max_length=150, default='Cook for yourself.')
    footer_cta_italic = models.CharField(max_length=100, default='Beautifully.')
    footer_cta_text = models.CharField(max_length=255, default='New launches, festive deals and recipes — curated with care.')
    footer_about = models.TextField(default='Everyday kitchen elegance. Appliances chosen for Indian homes.')
    copyright_text = models.CharField(max_length=200, default='© Rasoi & Co. All rights reserved.')
    footer_button_text = models.CharField(max_length=60, default='Find your next favourite')
    footer_button_link = models.CharField(max_length=255, default='/shop')
    footer_ai_button_text = models.CharField(max_length=60, default='Ask the AI expert')

    # Shop rules
    free_shipping_threshold = models.DecimalField(**MONEY, default=Decimal('1999.00'))
    shipping_fee = models.DecimalField(**MONEY, default=Decimal('99.00'))
    cod_fee = models.DecimalField(**MONEY, default=Decimal('0.00'))
    cod_max_order_value = models.DecimalField(**MONEY, default=Decimal('50000.00'))
    deliver_all_india = models.BooleanField(
        default=True,
        help_text='If ON, any valid PIN code not listed under Serviceable PIN codes is still deliverable with the default days below.',
    )
    default_delivery_days = models.PositiveSmallIntegerField(default=6)
    default_warranty_text = models.CharField(max_length=120, default='2-year warranty on all appliances')

    # AI widget
    ai_enabled = models.BooleanField('Show AI chat', default=True)
    ai_assistant_name = models.CharField(max_length=60, default='Rasoi AI')
    ai_tagline = models.CharField(max_length=80, default='Chat · Speak · Shop')
    ai_button_text = models.CharField(max_length=40, default='Ask Rasoi AI')
    ai_welcome_message = models.TextField(
        default="Namaste! I'm Rasoi AI. Tell me what you love to cook and I'll help you pick the right appliance."
    )

    # SEO
    meta_title = models.CharField(max_length=160, default='Rasoi & Co. — Smart kitchens, beautifully made')
    meta_description = models.CharField(
        max_length=300,
        default='Shop premium kitchen appliances online in India — mixer grinders, air fryers, chimneys and more. Free shipping over ₹1,999.',
    )

    class Meta:
        verbose_name = 'Site settings'
        verbose_name_plural = 'Site settings'

    def __str__(self):
        return self.store_name

    def save(self, *args, **kwargs):
        self.pk = 1  # always one row
        super().save(*args, **kwargs)

    @classmethod
    def load(cls):
        obj, _ = cls.objects.get_or_create(pk=1)
        return obj


class NavLink(models.Model):
    """Header / footer menu links."""
    LOCATION_CHOICES = [
        ('header', 'Header'),
        ('footer_shop', 'Footer — Shop'),
        ('footer_care', 'Footer — Customer care'),
    ]
    label = models.CharField(max_length=60)
    url = models.CharField(max_length=255, help_text='e.g. /shop, /new-arrivals, /offers, /about')
    location = models.CharField(max_length=20, choices=LOCATION_CHOICES, default='header')
    has_mega_menu = models.BooleanField(default=False, help_text='Show the categories mega menu on hover (header only).')
    is_highlighted = models.BooleanField(default=False)
    order = models.PositiveIntegerField(default=0)
    is_active = models.BooleanField(default=True)
    source = models.CharField(max_length=140, blank=True, editable=False,
                              help_text='Filled automatically when a Listing page / Page adds itself to the menu.')

    class Meta:
        ordering = ['location', 'order']

    def __str__(self):
        return f'{self.label} ({self.get_location_display()})'


class HeroSlide(models.Model):
    eyebrow = models.CharField(max_length=80, default='THE RASOI EDIT')
    title = models.CharField(max_length=150, help_text='e.g. "Smart kitchens."')
    italic_subtitle = models.CharField(max_length=150, blank=True, help_text='Shown in copper italics, e.g. "beautifully made."')
    description = models.TextField(blank=True)
    image = models.ImageField(upload_to='hero/', blank=True, null=True, max_length=500)
    model_3d = models.FileField(
        '3D model (.glb)', upload_to='models3d/', blank=True, null=True, max_length=500,
        validators=[glb_validator], help_text='Optional. If added, the hero shows a rotating 3D model.',
    )
    badge_text = models.CharField(max_length=80, blank=True, help_text='Small floating card text, e.g. "New season launches"')
    button_text = models.CharField(max_length=50, default='Find your next favourite')
    button_link = models.CharField(max_length=255, default='/shop')
    secondary_button_text = models.CharField(max_length=50, blank=True, default='Discover new arrivals')
    secondary_button_link = models.CharField(max_length=255, blank=True, default='/new-arrivals')
    order = models.PositiveIntegerField(default=0)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ['order']

    def __str__(self):
        return self.title


class Highlight(models.Model):
    """Small trust points: Free shipping, Easy returns, Secure payments, Expert help."""
    ICON_CHOICES = [
        ('truck', 'Truck (shipping)'),
        ('return', 'Return arrow'),
        ('shield', 'Shield (secure)'),
        ('spark', 'Sparkle (AI)'),
        ('warranty', 'Warranty badge'),
        ('support', 'Headset (support)'),
        ('leaf', 'Leaf'),
        ('rupee', 'Rupee'),
    ]
    PLACEMENT_CHOICES = [('hero', 'Below hero'), ('footer', 'Footer strip'), ('both', 'Both')]
    icon = models.CharField(max_length=20, choices=ICON_CHOICES, default='truck')
    title = models.CharField(max_length=60)
    subtitle = models.CharField(max_length=120, blank=True)
    placement = models.CharField(max_length=10, choices=PLACEMENT_CHOICES, default='both')
    order = models.PositiveIntegerField(default=0)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ['order']

    def __str__(self):
        return self.title


class PromoBanner(models.Model):
    POSITION_CHOICES = [
        ('home_top', 'Home — after categories (2 side-by-side)'),
        ('home_ai', 'Home — AI expert call-to-action'),
        ('shop_top', 'Shop page — top'),
    ]
    eyebrow = models.CharField(max_length=80, blank=True, default='A NEW KITCHEN STORY')
    title = models.CharField(max_length=120)
    italic_text = models.CharField(max_length=120, blank=True)
    subtitle = models.CharField(max_length=255, blank=True)
    image = models.ImageField(upload_to='banners/', blank=True, null=True, max_length=500)
    button_text = models.CharField(max_length=50, default='Shop now')
    link = models.CharField(max_length=255, default='/shop')
    background_color = models.CharField(max_length=9, default='#F1E7DC', validators=[hex_color_validator])
    text_color = models.CharField(max_length=9, default='#1F2326', validators=[hex_color_validator])
    position = models.CharField(max_length=20, choices=POSITION_CHOICES, default='home_top')
    order = models.PositiveIntegerField(default=0)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ['position', 'order']

    def __str__(self):
        return self.title


class Testimonial(models.Model):
    name = models.CharField(max_length=80)
    city = models.CharField(max_length=80, blank=True)
    quote = models.TextField()
    rating = models.PositiveSmallIntegerField(default=5, validators=[MinValueValidator(1), MaxValueValidator(5)])
    avatar = models.ImageField(upload_to='testimonials/', blank=True, null=True, max_length=500)
    product_name = models.CharField(max_length=120, blank=True)
    order = models.PositiveIntegerField(default=0)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ['order']

    def __str__(self):
        return f'{self.name} — {self.city}'


class FAQ(models.Model):
    CATEGORY_CHOICES = [
        ('orders', 'Orders & payments'),
        ('shipping', 'Shipping & delivery'),
        ('returns', 'Returns & refunds'),
        ('warranty', 'Warranty & service'),
        ('products', 'Products'),
    ]
    category = models.CharField(max_length=20, choices=CATEGORY_CHOICES, default='orders')
    question = models.CharField(max_length=255)
    answer = models.TextField()
    order = models.PositiveIntegerField(default=0)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ['category', 'order']
        verbose_name = 'FAQ'
        verbose_name_plural = 'FAQs'

    def __str__(self):
        return self.question


class Page(TimeStamped):
    """Content pages: Our Story (about), Shipping & Returns, Warranty, Privacy, Terms."""
    slug = models.SlugField(unique=True, help_text='about, shipping-returns, warranty, privacy, terms')
    eyebrow = models.CharField(max_length=80, blank=True)
    title = models.CharField(max_length=150)
    italic_title = models.CharField(max_length=150, blank=True)
    subtitle = models.CharField(max_length=255, blank=True)
    hero_image = models.ImageField(upload_to='pages/', blank=True, null=True, max_length=500)
    content = models.TextField(help_text='HTML allowed: <h2>, <p>, <ul>, <strong>, <img> …')
    meta_description = models.CharField(max_length=300, blank=True)
    is_active = models.BooleanField(default=True)
    show_in_header = models.BooleanField('Show in header menu', default=False)
    menu_label = models.CharField(max_length=60, blank=True, help_text='Menu text, e.g. "Our story". Defaults to the title.')
    menu_order = models.PositiveIntegerField(default=10)

    class Meta:
        ordering = ['title']

    def __str__(self):
        return self.title

    def clean(self):
        from django.core.exceptions import ValidationError
        if self.slug in RESERVED_SLUGS:
            raise ValidationError({'slug': f'"{self.slug}" is used by the website. Choose another slug.'})

    def save(self, *args, **kwargs):
        super().save(*args, **kwargs)
        sync_menu_link(f'page:{self.pk}', self.show_in_header and self.is_active,
                       self.menu_label or self.title, f'/{self.slug}', self.menu_order)


class PageSection(models.Model):
    """Optional image + text blocks for the Our Story page."""
    page = models.ForeignKey(Page, related_name='sections', on_delete=models.CASCADE)
    title = models.CharField(max_length=150)
    text = models.TextField()
    image = models.ImageField(upload_to='pages/', blank=True, null=True, max_length=500)
    image_on_left = models.BooleanField(default=True)
    order = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ['order']

    def __str__(self):
        return self.title


class HomeSection(models.Model):
    """Controls which sections appear on the home page, their order and their headings."""
    KEY_CHOICES = [
        ('hero', 'Hero slider'),
        ('highlights', 'Highlights row (free shipping, returns…)'),
        ('categories', 'Category grid'),
        ('featured', 'Featured products'),
        ('promo_banners', 'Promo banners'),
        ('new_arrivals', 'New arrivals'),
        ('ai_cta', 'AI expert call-to-action'),
        ('stats', 'Animated store numbers'),
        ('bestsellers', 'Bestsellers'),
        ('offers', 'Products on offer'),
        ('testimonials', 'Testimonials'),
        ('brand_statement', 'Closing brand statement'),
    ]
    key = models.CharField(max_length=30, choices=KEY_CHOICES, unique=True)
    eyebrow = models.CharField(max_length=80, blank=True)
    title = models.CharField(max_length=150, blank=True)
    italic_title = models.CharField(max_length=150, blank=True, help_text='Shown in copper italics after the title.')
    subtitle = models.CharField(max_length=255, blank=True)
    button_text = models.CharField(max_length=60, blank=True)
    button_link = models.CharField(max_length=255, blank=True)
    product_limit = models.PositiveSmallIntegerField(default=8, help_text='For product sections (max 12).')
    order = models.PositiveIntegerField(default=0)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ['order']
        verbose_name = 'Home page section'

    def __str__(self):
        return self.get_key_display()


class AIAssistant(models.Model):
    """Assistants shown in the chat dropdown ("Choose an assistant")."""
    name = models.CharField(max_length=60)
    slug = models.SlugField(unique=True)
    description = models.CharField(max_length=160, blank=True)
    welcome_message = models.TextField(blank=True, help_text='Optional greeting when this assistant is chosen.')
    system_prompt = models.TextField(
        help_text='Instructions for the AI, e.g. "You are a friendly kitchen-appliance expert for Indian homes…"')
    is_default = models.BooleanField(default=False)
    order = models.PositiveIntegerField(default=0)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ['order']
        verbose_name = 'AI assistant'

    def __str__(self):
        return self.name

    def save(self, *args, **kwargs):
        if self.is_default:
            AIAssistant.objects.exclude(pk=self.pk).update(is_default=False)
        super().save(*args, **kwargs)


# ===========================================================================
# 2. CATALOGUE
# ===========================================================================
class Category(TimeStamped):
    name = models.CharField(max_length=100)
    slug = models.SlugField(max_length=120, unique=True, blank=True)
    parent = models.ForeignKey(
        'self', null=True, blank=True, related_name='children', on_delete=models.SET_NULL,
        help_text='Leave empty for a main category.',
    )
    menu_group = models.CharField(
        max_length=60, blank=True,
        help_text='Mega-menu column heading, e.g. "Cooking", "Food prep", "Cleaning & water".',
    )
    description = models.TextField(blank=True)
    image = models.ImageField(upload_to='categories/', blank=True, null=True, max_length=500)
    show_in_menu = models.BooleanField(default=True)
    show_on_home = models.BooleanField(default=True)
    order = models.PositiveIntegerField(default=0)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ['order', 'name']
        verbose_name_plural = 'Categories'

    def __str__(self):
        return self.name

    def save(self, *args, **kwargs):
        if not self.slug:
            self.slug = unique_slug(self, self.name)
        super().save(*args, **kwargs)


class Brand(TimeStamped):
    name = models.CharField(max_length=100)
    slug = models.SlugField(max_length=120, unique=True, blank=True)
    logo = models.ImageField(upload_to='brands/', blank=True, null=True, max_length=500)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ['name']

    def __str__(self):
        return self.name

    def save(self, *args, **kwargs):
        if not self.slug:
            self.slug = unique_slug(self, self.name)
        super().save(*args, **kwargs)


class ListingPage(TimeStamped):
    """
    A product-listing page you create in admin — e.g. Collections (/shop), New arrivals,
    Offers, Diwali deals, Under ₹2,000. Tick "Show in header menu" and it appears in the menu.
    """
    SORT_CHOICES = [('newest', 'Newest first'), ('popular', 'Most popular'), ('price_low', 'Price: low to high'),
                    ('price_high', 'Price: high to low'), ('rating', 'Top rated')]
    slug = models.SlugField(max_length=80, unique=True, help_text='Web address: shop, new-arrivals, offers, diwali-deals …')
    menu_label = models.CharField(max_length=60, help_text='Text in the menu, e.g. "Collections"')
    eyebrow = models.CharField(max_length=80, blank=True)
    title = models.CharField(max_length=150)
    italic_title = models.CharField(max_length=150, blank=True)
    subtitle = models.CharField(max_length=255, blank=True)
    banner_image = models.ImageField(upload_to='listing/', blank=True, null=True, max_length=500)

    # Which products to show (leave empty for all products)
    category = models.ForeignKey('Category', null=True, blank=True, on_delete=models.SET_NULL)
    brand = models.ForeignKey('Brand', null=True, blank=True, on_delete=models.SET_NULL)
    only_new = models.BooleanField('Only new arrivals', default=False)
    only_featured = models.BooleanField(default=False)
    only_on_sale = models.BooleanField('Only products on offer (price below MRP)', default=False)
    tag = models.CharField(max_length=20, blank=True, help_text='Only products with this tag (bestseller, festive, diwali…)')
    min_discount = models.PositiveSmallIntegerField('Minimum % off', null=True, blank=True)
    max_price = models.DecimalField('Maximum price (₹)', **MONEY, null=True, blank=True)
    default_sort = models.CharField(max_length=20, choices=SORT_CHOICES, default='newest')

    # Menu
    show_in_header = models.BooleanField('Show in header menu', default=True)
    has_mega_menu = models.BooleanField('Open categories mega menu on hover', default=False)
    menu_order = models.PositiveIntegerField(default=5)
    is_active = models.BooleanField(default=True)
    meta_description = models.CharField(max_length=300, blank=True)

    class Meta:
        ordering = ['menu_order']
        verbose_name = 'Listing page (Collections / Offers …)'

    def __str__(self):
        return f'{self.menu_label} (/{self.slug})'

    def clean(self):
        from django.core.exceptions import ValidationError
        if self.slug in RESERVED_SLUGS:
            raise ValidationError({'slug': f'"{self.slug}" is used by the website. Choose another slug.'})

    def save(self, *args, **kwargs):
        super().save(*args, **kwargs)
        sync_menu_link(f'listing:{self.pk}', self.show_in_header and self.is_active, self.menu_label,
                       f'/{self.slug}', self.menu_order, self.has_mega_menu)

    def apply(self, queryset):
        """Filter a Product queryset with this page's rules."""
        from django.db.models import F
        if self.category_id:
            ids = [self.category_id] + list(Category.objects.filter(parent_id=self.category_id).values_list('id', flat=True))
            queryset = queryset.filter(category_id__in=ids)
        if self.brand_id:
            queryset = queryset.filter(brand_id=self.brand_id)
        if self.only_new:
            queryset = queryset.filter(is_new=True)
        if self.only_featured:
            queryset = queryset.filter(is_featured=True)
        if self.only_on_sale:
            queryset = queryset.filter(sale_price__lt=F('mrp'))
        if self.tag:
            queryset = queryset.filter(tag=self.tag)
        if self.max_price:
            queryset = queryset.filter(sale_price__lte=self.max_price)
        if self.min_discount:
            factor = Decimal('1') - Decimal(self.min_discount) / Decimal('100')
            queryset = queryset.filter(sale_price__lte=models.ExpressionWrapper(
                F('mrp') * models.Value(factor), output_field=models.DecimalField(max_digits=12, decimal_places=2)))
        return queryset


class ProductQuerySet(models.QuerySet):
    def active(self):
        return self.filter(is_active=True)

    def with_ratings(self):
        return self.annotate(
            rating_avg=Avg('reviews__rating', filter=models.Q(reviews__is_approved=True)),
            review_count=Count('reviews', filter=models.Q(reviews__is_approved=True), distinct=True),
        )


class Product(TimeStamped):
    TAG_CHOICES = [
        ('', '—'),
        ('bestseller', 'Bestseller'),
        ('festive', 'Festive deal'),
        ('diwali', 'Diwali special'),
        ('wedding', 'Wedding gifting'),
        ('limited', 'Limited edition'),
        ('energy', 'Energy saver'),
        ('new', 'New launch'),
    ]
    name = models.CharField(max_length=200)
    slug = models.SlugField(max_length=220, unique=True, blank=True)
    sku = models.CharField('SKU', max_length=60, blank=True)
    category = models.ForeignKey(Category, related_name='products', on_delete=models.PROTECT)
    brand = models.ForeignKey(Brand, related_name='products', null=True, blank=True, on_delete=models.SET_NULL)

    short_description = models.CharField(max_length=255, blank=True)
    description = models.TextField(blank=True, help_text='HTML allowed.')

    # Pricing (₹, inclusive of GST)
    mrp = models.DecimalField('MRP (₹)', **MONEY, validators=[MinValueValidator(Decimal('0'))])
    sale_price = models.DecimalField('Selling price (₹)', **MONEY, validators=[MinValueValidator(Decimal('0'))])
    gst_rate = models.DecimalField('GST rate (%)', max_digits=5, decimal_places=2, default=Decimal('18.00'),
                                   choices=[(Decimal(f'{v}.00'), label) for v, label in GST_RATE_CHOICES])
    hsn_code = models.CharField('HSN code', max_length=12, blank=True, help_text='e.g. 8509 for mixer grinders')

    # Key specifications
    wattage = models.CharField(max_length=50, blank=True, help_text='e.g. 750 W')
    capacity = models.CharField(max_length=50, blank=True, help_text='e.g. 1.5 L, 4.2 L, 30 L')
    warranty = models.CharField(max_length=80, blank=True, default='2 years')
    power_source = models.CharField(max_length=60, blank=True, default='Electric (230 V)')
    dimensions = models.CharField(max_length=80, blank=True, help_text='e.g. 32 × 22 × 28 cm')
    weight = models.CharField(max_length=40, blank=True, help_text='e.g. 3.2 kg')
    colour = models.CharField(max_length=40, blank=True)
    material = models.CharField(max_length=80, blank=True)

    stock = models.PositiveIntegerField(default=0)
    sold_count = models.PositiveIntegerField(default=0, editable=False)
    tag = models.CharField('Tag / occasion', max_length=20, choices=TAG_CHOICES, blank=True)
    badge_text = models.CharField(max_length=40, blank=True, help_text='Small label on the card, e.g. "THE CURATED EDIT"')

    is_featured = models.BooleanField(default=False)
    is_new = models.BooleanField('New arrival', default=False)
    is_active = models.BooleanField(default=True)
    cod_available = models.BooleanField('COD available', default=True)

    model_3d = models.FileField(
        '3D model (.glb)', upload_to='models3d/', blank=True, null=True, max_length=500,
        validators=[glb_validator],
    )

    meta_title = models.CharField(max_length=160, blank=True)
    meta_description = models.CharField(max_length=300, blank=True)

    objects = ProductQuerySet.as_manager()

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['is_active', 'is_featured']),
            models.Index(fields=['is_active', 'is_new']),
            models.Index(fields=['sale_price']),
        ]

    def __str__(self):
        return self.name

    def save(self, *args, **kwargs):
        if not self.slug:
            self.slug = unique_slug(self, self.name)
        if not self.sku:
            self.sku = f'RC-{uuid.uuid4().hex[:8].upper()}'
        super().save(*args, **kwargs)

    @property
    def discount_percent(self):
        if self.mrp and self.sale_price and self.sale_price < self.mrp:
            return int(round((self.mrp - self.sale_price) / self.mrp * 100))
        return 0

    @property
    def in_stock(self):
        return self.stock > 0

    @property
    def gst_amount(self):
        """GST included in the selling price."""
        rate = self.gst_rate or Decimal('0')
        return (self.sale_price * rate / (Decimal('100') + rate)).quantize(Decimal('0.01'))


class ProductImage(models.Model):
    product = models.ForeignKey(Product, related_name='images', on_delete=models.CASCADE)
    image = models.ImageField(upload_to='products/', max_length=500)
    alt_text = models.CharField(max_length=200, blank=True)
    order = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ['order', 'id']

    def __str__(self):
        return self.alt_text or f'Image of {self.product.name}'


class ProductVariant(models.Model):
    product = models.ForeignKey(Product, related_name='variants', on_delete=models.CASCADE)
    colour = models.CharField(max_length=40, blank=True)
    colour_hex = models.CharField(max_length=9, blank=True, validators=[hex_color_validator])
    capacity = models.CharField('Capacity / size', max_length=50, blank=True)
    sku = models.CharField('SKU', max_length=60, blank=True)
    mrp = models.DecimalField('MRP (₹)', **MONEY, null=True, blank=True, help_text='Leave empty to use product MRP.')
    price = models.DecimalField('Selling price (₹)', **MONEY)
    stock = models.PositiveIntegerField(default=0)
    is_active = models.BooleanField(default=True)
    order = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ['order', 'id']

    def __str__(self):
        return f'{self.product.name} — {self.label}'

    @property
    def label(self):
        return ' / '.join([p for p in [self.colour, self.capacity] if p]) or 'Default'


class ProductSpecification(models.Model):
    """Extra rows for the specs table (e.g. Jars: 3, Motor: Copper, Speed settings: 3)."""
    product = models.ForeignKey(Product, related_name='specifications', on_delete=models.CASCADE)
    label = models.CharField(max_length=80)
    value = models.CharField(max_length=200)
    order = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ['order', 'id']

    def __str__(self):
        return f'{self.label}: {self.value}'


class Review(TimeStamped):
    product = models.ForeignKey(Product, related_name='reviews', on_delete=models.CASCADE)
    user = models.ForeignKey(settings.AUTH_USER_MODEL, related_name='reviews', on_delete=models.CASCADE)
    rating = models.PositiveSmallIntegerField(validators=[MinValueValidator(1), MaxValueValidator(5)])
    title = models.CharField(max_length=120, blank=True)
    comment = models.TextField()
    is_verified_purchase = models.BooleanField(default=False)
    is_approved = models.BooleanField(default=True)

    class Meta:
        ordering = ['-created_at']
        unique_together = ('product', 'user')

    def __str__(self):
        return f'{self.product.name} — {self.rating}★'


# ===========================================================================
# 3. CUSTOMERS, CART, WISHLIST, ADDRESSES
# ===========================================================================
class CustomerProfile(TimeStamped):
    user = models.OneToOneField(settings.AUTH_USER_MODEL, related_name='profile', on_delete=models.CASCADE)
    mobile = models.CharField(max_length=10, blank=True, validators=[mobile_validator])
    marketing_opt_in = models.BooleanField(default=False)

    def __str__(self):
        return f'Profile of {self.user}'


class Address(TimeStamped):
    TYPE_CHOICES = [('home', 'Home'), ('work', 'Work'), ('other', 'Other')]
    user = models.ForeignKey(settings.AUTH_USER_MODEL, related_name='addresses', on_delete=models.CASCADE)
    full_name = models.CharField(max_length=120)
    mobile = models.CharField(max_length=10, validators=[mobile_validator], help_text='10 digits, without +91')
    alternate_mobile = models.CharField(max_length=10, blank=True, validators=[mobile_validator])
    house = models.CharField('House / Flat / Building', max_length=200)
    street = models.CharField('Street / Area / Locality', max_length=200)
    landmark = models.CharField(max_length=120, blank=True)
    city = models.CharField(max_length=100)
    state = models.CharField(max_length=60, choices=INDIAN_STATES)
    pincode = models.CharField('PIN code', max_length=6, validators=[pincode_validator])
    address_type = models.CharField(max_length=10, choices=TYPE_CHOICES, default='home')
    is_default = models.BooleanField(default=False)

    class Meta:
        ordering = ['-is_default', '-updated_at']
        verbose_name_plural = 'Addresses'

    def __str__(self):
        return f'{self.full_name}, {self.city} — {self.pincode}'

    def save(self, *args, **kwargs):
        if self.is_default:
            Address.objects.filter(user=self.user, is_default=True).exclude(pk=self.pk).update(is_default=False)
        elif not Address.objects.filter(user=self.user).exclude(pk=self.pk).exists():
            self.is_default = True
        super().save(*args, **kwargs)


class Cart(TimeStamped):
    user = models.OneToOneField(settings.AUTH_USER_MODEL, related_name='cart', on_delete=models.CASCADE)

    def __str__(self):
        return f'Cart of {self.user}'


class CartItem(TimeStamped):
    cart = models.ForeignKey(Cart, related_name='items', on_delete=models.CASCADE)
    product = models.ForeignKey(Product, on_delete=models.CASCADE)
    variant = models.ForeignKey(ProductVariant, null=True, blank=True, on_delete=models.CASCADE)
    quantity = models.PositiveIntegerField(default=1, validators=[MinValueValidator(1), MaxValueValidator(10)])

    class Meta:
        ordering = ['created_at']
        unique_together = ('cart', 'product', 'variant')

    def __str__(self):
        return f'{self.quantity} × {self.product.name}'

    @property
    def unit_price(self):
        return self.variant.price if self.variant else self.product.sale_price

    @property
    def unit_mrp(self):
        if self.variant and self.variant.mrp:
            return self.variant.mrp
        return self.product.mrp

    @property
    def line_total(self):
        return self.unit_price * self.quantity


class WishlistItem(TimeStamped):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, related_name='wishlist', on_delete=models.CASCADE)
    product = models.ForeignKey(Product, related_name='wishlisted_by', on_delete=models.CASCADE)

    class Meta:
        ordering = ['-created_at']
        unique_together = ('user', 'product')
        verbose_name = 'Wishlist item'

    def __str__(self):
        return f'{self.user} ♥ {self.product}'


# ===========================================================================
# 4. ORDERS & PAYMENTS
# ===========================================================================
class Order(TimeStamped):
    PAYMENT_METHOD_CHOICES = [('razorpay', 'Razorpay (UPI / Cards / Net banking / Wallets)'), ('cod', 'Cash on Delivery')]
    PAYMENT_STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('paid', 'Paid'),
        ('failed', 'Failed'),
        ('refunded', 'Refunded'),
    ]
    STATUS_CHOICES = [
        ('pending_payment', 'Awaiting payment'),
        ('placed', 'Placed'),
        ('confirmed', 'Confirmed'),
        ('packed', 'Packed'),
        ('shipped', 'Shipped'),
        ('out_for_delivery', 'Out for delivery'),
        ('delivered', 'Delivered'),
        ('cancelled', 'Cancelled'),
        ('returned', 'Returned'),
    ]

    order_number = models.CharField(max_length=20, unique=True, editable=False)
    user = models.ForeignKey(settings.AUTH_USER_MODEL, related_name='orders', null=True, on_delete=models.SET_NULL)
    email = models.EmailField()

    # Shipping address snapshot (Indian format)
    full_name = models.CharField(max_length=120)
    mobile = models.CharField(max_length=10, validators=[mobile_validator])
    house = models.CharField(max_length=200)
    street = models.CharField(max_length=200)
    landmark = models.CharField(max_length=120, blank=True)
    city = models.CharField(max_length=100)
    state = models.CharField(max_length=60, choices=INDIAN_STATES)
    pincode = models.CharField(max_length=6, validators=[pincode_validator])

    # Amounts in ₹ (GST inclusive)
    subtotal = models.DecimalField(**MONEY, default=Decimal('0'))
    mrp_total = models.DecimalField(**MONEY, default=Decimal('0'))
    discount = models.DecimalField(**MONEY, default=Decimal('0'))
    shipping_fee = models.DecimalField(**MONEY, default=Decimal('0'))
    cod_fee = models.DecimalField(**MONEY, default=Decimal('0'))
    gst_amount = models.DecimalField('GST included', **MONEY, default=Decimal('0'))
    total = models.DecimalField(**MONEY, default=Decimal('0'))

    payment_method = models.CharField(max_length=20, choices=PAYMENT_METHOD_CHOICES, default='razorpay')
    payment_status = models.CharField(max_length=20, choices=PAYMENT_STATUS_CHOICES, default='pending')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending_payment')

    razorpay_order_id = models.CharField(max_length=100, blank=True)
    razorpay_payment_id = models.CharField(max_length=100, blank=True)
    razorpay_signature = models.CharField(max_length=255, blank=True)

    estimated_delivery = models.DateField(null=True, blank=True)
    tracking_number = models.CharField(max_length=100, blank=True)
    courier_name = models.CharField(max_length=80, blank=True)
    notes = models.TextField(blank=True)
    stock_deducted = models.BooleanField(default=False, editable=False)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return self.order_number

    def save(self, *args, **kwargs):
        if not self.order_number:
            stamp = timezone.localtime().strftime('%y%m%d')
            self.order_number = f'RC{stamp}{uuid.uuid4().hex[:6].upper()}'
        super().save(*args, **kwargs)

    @property
    def amount_in_paise(self):
        return int((self.total * 100).quantize(Decimal('1')))

    def deduct_stock(self):
        """Reduce stock once the order is confirmed (COD placed or online payment verified)."""
        if self.stock_deducted:
            return
        for item in self.items.select_related('product', 'variant'):
            if item.variant_id:
                v = item.variant
                v.stock = max(0, v.stock - item.quantity)
                v.save(update_fields=['stock'])
            if item.product_id:
                p = item.product
                p.stock = max(0, p.stock - item.quantity)
                p.sold_count = p.sold_count + item.quantity
                p.save(update_fields=['stock', 'sold_count'])
        self.stock_deducted = True
        self.save(update_fields=['stock_deducted'])


class OrderItem(models.Model):
    order = models.ForeignKey(Order, related_name='items', on_delete=models.CASCADE)
    product = models.ForeignKey(Product, null=True, on_delete=models.SET_NULL)
    variant = models.ForeignKey(ProductVariant, null=True, blank=True, on_delete=models.SET_NULL)
    product_name = models.CharField(max_length=200)
    variant_label = models.CharField(max_length=100, blank=True)
    sku = models.CharField(max_length=60, blank=True)
    hsn_code = models.CharField(max_length=12, blank=True)
    gst_rate = models.DecimalField(max_digits=5, decimal_places=2, default=Decimal('18.00'))
    image_url = models.URLField(max_length=600, blank=True)
    unit_mrp = models.DecimalField(**MONEY)
    unit_price = models.DecimalField(**MONEY)
    quantity = models.PositiveIntegerField(default=1)
    line_total = models.DecimalField(**MONEY)

    def __str__(self):
        return f'{self.quantity} × {self.product_name}'


# ===========================================================================
# 5. DELIVERY & LEADS
# ===========================================================================
class ServiceablePincode(models.Model):
    pincode = models.CharField('PIN code', max_length=6, unique=True, validators=[pincode_validator])
    city = models.CharField(max_length=100)
    state = models.CharField(max_length=60, choices=INDIAN_STATES)
    delivery_days = models.PositiveSmallIntegerField(default=4)
    cod_available = models.BooleanField('COD available', default=True)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ['pincode']
        verbose_name = 'Serviceable PIN code'
        verbose_name_plural = 'Serviceable PIN codes'

    def __str__(self):
        return f'{self.pincode} — {self.city}'


class NewsletterSubscriber(models.Model):
    email = models.EmailField(unique=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return self.email


class ContactMessage(models.Model):
    name = models.CharField(max_length=120)
    email = models.EmailField()
    mobile = models.CharField(max_length=10, blank=True, validators=[mobile_validator])
    subject = models.CharField(max_length=200)
    message = models.TextField()
    is_resolved = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f'{self.name}: {self.subject}'
