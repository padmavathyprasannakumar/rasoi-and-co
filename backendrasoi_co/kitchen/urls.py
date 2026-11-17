from django.urls import include, path
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import TokenRefreshView

from . import views

router = DefaultRouter()
router.register('hero-slides', views.HeroSlideViewSet, basename='hero-slide')
router.register('highlights', views.HighlightViewSet, basename='highlight')
router.register('promo-banners', views.PromoBannerViewSet, basename='promo-banner')
router.register('testimonials', views.TestimonialViewSet, basename='testimonial')
router.register('faqs', views.FAQViewSet, basename='faq')
router.register('pages', views.PageViewSet, basename='page')
router.register('listing-pages', views.ListingPageViewSet, basename='listing-page')
router.register('categories', views.CategoryViewSet, basename='category')
router.register('brands', views.BrandViewSet, basename='brand')
router.register('products', views.ProductViewSet, basename='product')
router.register('reviews', views.ReviewViewSet, basename='review')
router.register('cart/items', views.CartItemViewSet, basename='cart-item')
router.register('wishlist', views.WishlistViewSet, basename='wishlist')
router.register('addresses', views.AddressViewSet, basename='address')
router.register('orders', views.OrderViewSet, basename='order')

urlpatterns = [
    path('health/', views.health, name='health'),
    path('settings/', views.SiteSettingsView.as_view(), name='site-settings'),
    path('menu/', views.MenuView.as_view(), name='menu'),
    path('home/', views.HomeView.as_view(), name='home'),
    path('states/', views.indian_states, name='indian-states'),
    path('search/suggest/', views.search_suggest, name='search-suggest'),
    path('pincode-check/<str:pincode>/', views.pincode_check, name='pincode-check'),
    path('cart/', views.CartView.as_view(), name='cart'),
    path('resolve/<slug:slug>/', views.resolve_slug, name='resolve-slug'),

    # AI assistant
    path('ai/assistants/', views.AIAssistantListView.as_view(), name='ai-assistants'),
    path('ai/chat/', views.AIChatView.as_view(), name='ai-chat'),

    # Payments
    path('payments/razorpay/create-order/', views.RazorpayCreateOrderView.as_view(), name='razorpay-create'),
    path('payments/razorpay/verify/', views.RazorpayVerifyView.as_view(), name='razorpay-verify'),
    path('payments/razorpay/failed/', views.RazorpayFailedView.as_view(), name='razorpay-failed'),

    # Auth (JWT)
    path('auth/register/', views.RegisterView.as_view(), name='register'),
    path('auth/login/', views.LoginView.as_view(), name='login'),
    path('auth/token/refresh/', TokenRefreshView.as_view(), name='token-refresh'),
    path('auth/me/', views.MeView.as_view(), name='me'),
    path('auth/change-password/', views.ChangePasswordView.as_view(), name='change-password'),
    path('auth/password-reset/', views.PasswordResetRequestView.as_view(), name='password-reset'),
    path('auth/password-reset/confirm/', views.PasswordResetConfirmView.as_view(), name='password-reset-confirm'),

    # Leads
    path('newsletter/', views.NewsletterView.as_view(), name='newsletter'),
    path('contact/', views.ContactMessageView.as_view(), name='contact'),

    path('', include(router.urls)),
]
