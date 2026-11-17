from django.contrib import admin
from django.utils.html import format_html
from django.utils.safestring import mark_safe

from .constants import format_inr
from .models import (
    FAQ,
    AIAssistant,
    Address,
    Brand,
    Cart,
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
    ServiceablePincode,
    SiteSettings,
    Testimonial,
    WishlistItem,
)


def thumb(file_field, size=60):
    """Small image preview for list pages and forms."""
    if not file_field:
        return mark_safe('<span style="color:#999">—</span>')
    try:
        url = file_field.url
    except ValueError:
        return mark_safe('<span style="color:#999">—</span>')
    return format_html(
        '<img src="{}" style="width:{}px;height:{}px;object-fit:cover;border-radius:8px;border:1px solid #E6DDD1" />',
        url, size, size,
    )


class PreviewMixin:
    """Adds a large preview of the `image` field inside the edit form."""
    def image_preview(self, obj):
        return thumb(getattr(obj, 'image', None), 160)
    image_preview.short_description = 'Preview'


# ---------------------------------------------------------------------------
# Site content
# ---------------------------------------------------------------------------
@admin.register(SiteSettings)
class SiteSettingsAdmin(admin.ModelAdmin):
    readonly_fields = ('logo_preview', 'updated_at')
    fieldsets = (
        ('Brand', {'fields': ('store_name', 'tagline', 'logo_subtext', 'logo', 'logo_preview', 'favicon')}),
                ('Sign in / Create account pages', {'fields': ('login_image', 'register_image', 'auth_side_text')}),
        ('Announcement bar', {'fields': ('show_announcement', 'announcement_text', 'announcement_link')}),
        ('Contact (India)', {'fields': ('email', 'phone', 'whatsapp', 'address_line1', 'address_line2',
                                        'city', 'state', 'pincode', 'business_hours', 'gstin')}),
        ('Social links', {'fields': ('instagram_url', 'facebook_url', 'youtube_url', 'pinterest_url',
                                     'twitter_url', 'linkedin_url')}),
        ('Footer', {'fields': ('footer_eyebrow', 'footer_cta_title', 'footer_cta_italic', 'footer_cta_text',
                               'footer_button_text', 'footer_button_link', 'footer_ai_button_text',
                               'footer_about', 'copyright_text')}),
        ('Shipping & payments (₹)', {'fields': ('free_shipping_threshold', 'shipping_fee', 'cod_fee',
                                               'cod_max_order_value', 'deliver_all_india',
                                               'default_delivery_days', 'default_warranty_text')}),
        ('AI chat widget', {'fields': ('ai_enabled', 'ai_assistant_name', 'ai_tagline', 'ai_button_text',
                                       'ai_welcome_message'),
                            'description': 'The AI key itself lives in the .env file (AI_API_KEY) for security.'}),
        ('SEO', {'fields': ('meta_title', 'meta_description')}),
    )

    def logo_preview(self, obj):
        return thumb(obj.logo, 120)
    logo_preview.short_description = 'Logo preview'

    def has_add_permission(self, request):
        return not SiteSettings.objects.exists()

    def has_delete_permission(self, request, obj=None):
        return False


@admin.register(NavLink)
class NavLinkAdmin(admin.ModelAdmin):
    list_display = ('label', 'url', 'location', 'has_mega_menu', 'is_highlighted', 'order', 'is_active', 'added_by')
    list_editable = ('order', 'is_active', 'has_mega_menu', 'is_highlighted')
    list_filter = ('location', 'is_active')
    search_fields = ('label', 'url')

    @admin.display(description='Added by')
    def added_by(self, obj):
        if obj.source.startswith('listing:'):
            return 'Listing page'
        if obj.source.startswith('page:'):
            return 'Page'
        return 'Manual'


@admin.register(HeroSlide)
class HeroSlideAdmin(PreviewMixin, admin.ModelAdmin):
    list_display = ('thumbnail', 'title', 'italic_subtitle', 'has_3d', 'order', 'is_active')
    list_display_links = ('thumbnail', 'title')
    list_editable = ('order', 'is_active')
    readonly_fields = ('image_preview',)
    search_fields = ('title', 'italic_subtitle')

    def thumbnail(self, obj):
        return thumb(obj.image)

    @admin.display(boolean=True, description='3D')
    def has_3d(self, obj):
        return bool(obj.model_3d)


@admin.register(Highlight)
class HighlightAdmin(admin.ModelAdmin):
    list_display = ('title', 'subtitle', 'icon', 'placement', 'order', 'is_active')
    list_editable = ('order', 'is_active', 'placement')


@admin.register(PromoBanner)
class PromoBannerAdmin(PreviewMixin, admin.ModelAdmin):
    list_display = ('thumbnail', 'title', 'position', 'colour_swatch', 'order', 'is_active')
    list_display_links = ('thumbnail', 'title')
    list_editable = ('order', 'is_active')
    list_filter = ('position', 'is_active')
    readonly_fields = ('image_preview',)

    def thumbnail(self, obj):
        return thumb(obj.image)

    def colour_swatch(self, obj):
        return format_html(
            '<span style="display:inline-block;width:28px;height:18px;border-radius:4px;background:{};border:1px solid #ccc"></span> {}',
            obj.background_color, obj.background_color,
        )
    colour_swatch.short_description = 'Background'


@admin.register(Testimonial)
class TestimonialAdmin(admin.ModelAdmin):
    list_display = ('avatar_thumb', 'name', 'city', 'rating', 'order', 'is_active')
    list_editable = ('order', 'is_active')
    search_fields = ('name', 'quote', 'city')

    def avatar_thumb(self, obj):
        return thumb(obj.avatar, 40)
    avatar_thumb.short_description = ''


@admin.register(FAQ)
class FAQAdmin(admin.ModelAdmin):
    list_display = ('question', 'category', 'order', 'is_active')
    list_editable = ('order', 'is_active')
    list_filter = ('category', 'is_active')
    search_fields = ('question', 'answer')


class PageSectionInline(admin.StackedInline):
    model = PageSection
    extra = 0


@admin.register(Page)
class PageAdmin(admin.ModelAdmin):
    list_display = ('title', 'slug', 'web_address', 'show_in_header', 'menu_order', 'is_active', 'updated_at')
    list_editable = ('show_in_header', 'menu_order', 'is_active')
    prepopulated_fields = {'slug': ('title',)}
    search_fields = ('title', 'content')
    inlines = [PageSectionInline]
    fieldsets = (
        ('Page', {'fields': ('slug', 'eyebrow', 'title', 'italic_title', 'subtitle', 'hero_image', 'content',
                             'meta_description', 'is_active')}),
        ('Header menu', {'fields': ('show_in_header', 'menu_label', 'menu_order'),
                         'description': 'Tick "Show in header menu" and this page appears in the website menu automatically.'}),
    )

    @admin.display(description='Web address')
    def web_address(self, obj):
        return f'/{obj.slug}'


@admin.register(ListingPage)
class ListingPageAdmin(PreviewMixin, admin.ModelAdmin):
    list_display = ('menu_label', 'web_address', 'title', 'show_in_header', 'menu_order', 'is_active')
    list_display_links = ('menu_label',)
    list_editable = ('show_in_header', 'menu_order', 'is_active')
    prepopulated_fields = {'slug': ('menu_label',)}
    readonly_fields = ('banner_preview',)
    fieldsets = (
        ('Page', {'fields': ('menu_label', 'slug', 'eyebrow', 'title', 'italic_title', 'subtitle',
                             'banner_image', 'banner_preview', 'meta_description', 'is_active')}),
        ('Which products to show (leave empty = all products)', {
            'fields': ('category', 'brand', 'only_new', 'only_featured', 'only_on_sale', 'tag', 'min_discount',
                       'max_price', 'default_sort')}),
        ('Header menu', {'fields': ('show_in_header', 'has_mega_menu', 'menu_order')}),
    )

    @admin.display(description='Web address')
    def web_address(self, obj):
        return f'/{obj.slug}'

    @admin.display(description='Banner preview')
    def banner_preview(self, obj):
        return thumb(obj.banner_image, 200)


@admin.register(HomeSection)
class HomeSectionAdmin(admin.ModelAdmin):
    list_display = ('key', 'title', 'italic_title', 'product_limit', 'order', 'is_active')
    list_editable = ('order', 'is_active', 'product_limit')
    list_display_links = ('key',)


@admin.register(AIAssistant)
class AIAssistantAdmin(admin.ModelAdmin):
    list_display = ('name', 'slug', 'description', 'is_default', 'order', 'is_active')
    list_editable = ('order', 'is_active')
    prepopulated_fields = {'slug': ('name',)}


# ---------------------------------------------------------------------------
# Catalogue
# ---------------------------------------------------------------------------
@admin.register(Category)
class CategoryAdmin(PreviewMixin, admin.ModelAdmin):
    list_display = ('thumbnail', 'name', 'parent', 'menu_group', 'product_total', 'show_in_menu', 'show_on_home', 'order', 'is_active')
    list_display_links = ('thumbnail', 'name')
    list_editable = ('order', 'is_active', 'show_in_menu', 'show_on_home')
    list_filter = ('is_active', 'parent', 'menu_group')
    search_fields = ('name', 'description')
    prepopulated_fields = {'slug': ('name',)}
    readonly_fields = ('image_preview',)

    def thumbnail(self, obj):
        return thumb(obj.image)

    def product_total(self, obj):
        return obj.products.count()
    product_total.short_description = 'Products'


@admin.register(Brand)
class BrandAdmin(admin.ModelAdmin):
    list_display = ('logo_thumb', 'name', 'slug', 'is_active')
    list_display_links = ('logo_thumb', 'name')
    list_editable = ('is_active',)
    prepopulated_fields = {'slug': ('name',)}
    search_fields = ('name',)

    def logo_thumb(self, obj):
        return thumb(obj.logo, 40)
    logo_thumb.short_description = ''


class ProductImageInline(admin.TabularInline):
    model = ProductImage
    extra = 1
    fields = ('preview', 'image', 'alt_text', 'order')
    readonly_fields = ('preview',)

    def preview(self, obj):
        return thumb(obj.image, 70)


class ProductVariantInline(admin.TabularInline):
    model = ProductVariant
    extra = 0
    fields = ('colour', 'colour_hex', 'capacity', 'sku', 'mrp', 'price', 'stock', 'order', 'is_active')


class ProductSpecificationInline(admin.TabularInline):
    model = ProductSpecification
    extra = 1
    fields = ('label', 'value', 'order')


@admin.register(Product)
class ProductAdmin(admin.ModelAdmin):
    list_display = ('thumbnail', 'name', 'category', 'brand', 'mrp_inr', 'price_inr', 'discount', 'stock',
                    'is_featured', 'is_new', 'is_active')
    list_display_links = ('thumbnail', 'name')
    list_editable = ('stock', 'is_featured', 'is_new', 'is_active')
    list_filter = ('is_active', 'is_featured', 'is_new', 'category', 'brand', 'tag', 'gst_rate')
    search_fields = ('name', 'sku', 'hsn_code', 'short_description', 'description')
    prepopulated_fields = {'slug': ('name',)}
    list_select_related = ('category', 'brand')
    list_per_page = 30
    readonly_fields = ('sold_count', 'gst_included', 'created_at', 'updated_at')
    inlines = [ProductImageInline, ProductVariantInline, ProductSpecificationInline]
    fieldsets = (
        ('Product', {'fields': ('name', 'slug', 'sku', 'category', 'brand', 'short_description', 'description')}),
        ('Price (₹, inclusive of GST)', {'fields': ('mrp', 'sale_price', 'gst_rate', 'gst_included', 'hsn_code')}),
        ('Specifications', {'fields': ('wattage', 'capacity', 'warranty', 'power_source', 'dimensions',
                                       'weight', 'colour', 'material')}),
        ('Inventory & labels', {'fields': ('stock', 'sold_count', 'tag', 'badge_text', 'is_featured', 'is_new',
                                           'is_active', 'cod_available')}),
        ('3D model', {'fields': ('model_3d',), 'classes': ('collapse',)}),
        ('SEO', {'fields': ('meta_title', 'meta_description'), 'classes': ('collapse',)}),
        ('Dates', {'fields': ('created_at', 'updated_at'), 'classes': ('collapse',)}),
    )

    def get_queryset(self, request):
        return super().get_queryset(request).prefetch_related('images')

    def thumbnail(self, obj):
        first = obj.images.all()[:1]
        return thumb(first[0].image if first else None)
    thumbnail.short_description = ''

    @admin.display(description='MRP', ordering='mrp')
    def mrp_inr(self, obj):
        return format_inr(obj.mrp)

    @admin.display(description='Price', ordering='sale_price')
    def price_inr(self, obj):
        return format_inr(obj.sale_price)

    @admin.display(description='Off')
    def discount(self, obj):
        return f'{obj.discount_percent}%' if obj.discount_percent else '—'

    @admin.display(description='GST included in price')
    def gst_included(self, obj):
        if not obj.pk:
            return '—'
        return format_inr(obj.gst_amount)


@admin.register(Review)
class ReviewAdmin(admin.ModelAdmin):
    list_display = ('product', 'user', 'rating', 'is_verified_purchase', 'is_approved', 'created_at')
    list_editable = ('is_approved',)
    list_filter = ('rating', 'is_approved', 'is_verified_purchase')
    search_fields = ('product__name', 'user__username', 'comment')
    list_select_related = ('product', 'user')


# ---------------------------------------------------------------------------
# Customers
# ---------------------------------------------------------------------------
@admin.register(CustomerProfile)
class CustomerProfileAdmin(admin.ModelAdmin):
    list_display = ('user', 'mobile_display', 'marketing_opt_in', 'created_at')
    search_fields = ('user__username', 'user__email', 'mobile')

    def mobile_display(self, obj):
        return f'+91 {obj.mobile[:5]} {obj.mobile[5:]}' if obj.mobile else '—'
    mobile_display.short_description = 'Mobile'


@admin.register(Address)
class AddressAdmin(admin.ModelAdmin):
    list_display = ('full_name', 'user', 'city', 'state', 'pincode', 'mobile', 'is_default')
    list_filter = ('state', 'address_type', 'is_default')
    search_fields = ('full_name', 'city', 'pincode', 'mobile', 'user__username')


class CartItemInline(admin.TabularInline):
    model = CartItem
    extra = 0


@admin.register(Cart)
class CartAdmin(admin.ModelAdmin):
    list_display = ('user', 'item_count', 'updated_at')
    inlines = [CartItemInline]
    search_fields = ('user__username', 'user__email')

    def item_count(self, obj):
        return obj.items.count()
    item_count.short_description = 'Items'


@admin.register(WishlistItem)
class WishlistItemAdmin(admin.ModelAdmin):
    list_display = ('user', 'product', 'created_at')
    search_fields = ('user__username', 'product__name')


# ---------------------------------------------------------------------------
# Orders
# ---------------------------------------------------------------------------
class OrderItemInline(admin.TabularInline):
    model = OrderItem
    extra = 0
    can_delete = False
    fields = ('product_name', 'variant_label', 'sku', 'hsn_code', 'gst_rate', 'unit_price_inr', 'quantity', 'line_total_inr')
    readonly_fields = fields

    def has_add_permission(self, request, obj=None):
        return False

    @admin.display(description='Unit price')
    def unit_price_inr(self, obj):
        return format_inr(obj.unit_price)

    @admin.display(description='Line total')
    def line_total_inr(self, obj):
        return format_inr(obj.line_total)


@admin.register(Order)
class OrderAdmin(admin.ModelAdmin):
    list_display = ('order_number', 'full_name', 'city', 'total_inr', 'payment_method', 'payment_badge',
                    'status', 'created_at')
    list_editable = ('status',)
    list_filter = ('status', 'payment_status', 'payment_method', 'state', 'created_at')
    search_fields = ('order_number', 'full_name', 'email', 'mobile', 'pincode', 'razorpay_order_id', 'razorpay_payment_id')
    date_hierarchy = 'created_at'
    inlines = [OrderItemInline]
    readonly_fields = ('order_number', 'user', 'subtotal_inr', 'discount_inr', 'shipping_inr', 'cod_fee_inr',
                       'gst_inr', 'total_inr', 'razorpay_order_id', 'razorpay_payment_id', 'razorpay_signature',
                       'created_at', 'updated_at')
    fieldsets = (
        ('Order', {'fields': ('order_number', 'user', 'email', 'status', 'created_at', 'updated_at')}),
        ('Ship to', {'fields': ('full_name', 'mobile', 'house', 'street', 'landmark', 'city', 'state', 'pincode')}),
        ('Amounts (₹)', {'fields': ('subtotal_inr', 'discount_inr', 'shipping_inr', 'cod_fee_inr', 'gst_inr', 'total_inr')}),
        ('Payment', {'fields': ('payment_method', 'payment_status', 'razorpay_order_id', 'razorpay_payment_id',
                                'razorpay_signature')}),
        ('Delivery', {'fields': ('estimated_delivery', 'courier_name', 'tracking_number', 'notes')}),
    )

    @admin.display(description='Total', ordering='total')
    def total_inr(self, obj):
        return format_inr(obj.total)

    @admin.display(description='Subtotal')
    def subtotal_inr(self, obj):
        return format_inr(obj.subtotal)

    @admin.display(description='Discount (MRP − price)')
    def discount_inr(self, obj):
        return format_inr(obj.discount)

    @admin.display(description='Shipping')
    def shipping_inr(self, obj):
        return format_inr(obj.shipping_fee)

    @admin.display(description='COD fee')
    def cod_fee_inr(self, obj):
        return format_inr(obj.cod_fee)

    @admin.display(description='GST included')
    def gst_inr(self, obj):
        return format_inr(obj.gst_amount)

    @admin.display(description='Payment')
    def payment_badge(self, obj):
        colours = {'paid': '#4F7A4A', 'pending': '#B87333', 'failed': '#B3412E', 'refunded': '#6B6660'}
        return format_html(
            '<span style="padding:2px 10px;border-radius:999px;color:#fff;background:{};font-size:11px">{}</span>',
            colours.get(obj.payment_status, '#6B6660'), obj.get_payment_status_display(),
        )


# ---------------------------------------------------------------------------
# Delivery & leads
# ---------------------------------------------------------------------------
@admin.register(ServiceablePincode)
class ServiceablePincodeAdmin(admin.ModelAdmin):
    list_display = ('pincode', 'city', 'state', 'delivery_days', 'cod_available', 'is_active')
    list_editable = ('delivery_days', 'cod_available', 'is_active')
    list_filter = ('state', 'cod_available', 'is_active')
    search_fields = ('pincode', 'city')


@admin.register(NewsletterSubscriber)
class NewsletterSubscriberAdmin(admin.ModelAdmin):
    list_display = ('email', 'is_active', 'created_at')
    list_filter = ('is_active',)
    search_fields = ('email',)


@admin.register(ContactMessage)
class ContactMessageAdmin(admin.ModelAdmin):
    list_display = ('name', 'email', 'subject', 'is_resolved', 'created_at')
    list_editable = ('is_resolved',)
    list_filter = ('is_resolved',)
    search_fields = ('name', 'email', 'subject', 'message')
    readonly_fields = ('name', 'email', 'mobile', 'subject', 'message', 'created_at')
