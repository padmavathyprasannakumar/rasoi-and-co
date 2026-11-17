"""Clear cached API data whenever content is changed in Django admin."""
from django.core.cache import cache
from django.db.models.signals import post_delete, post_save
from django.dispatch import receiver

from .models import (
    Brand,
    Category,
    HeroSlide,
    Highlight,
    HomeSection,
    ListingPage,
    NavLink,
    Page,
    Product,
    ProductImage,
    ProductVariant,
    PromoBanner,
    SiteSettings,
    Testimonial,
)

CONTENT_MODELS = (SiteSettings, NavLink, HeroSlide, Highlight, PromoBanner, Testimonial, HomeSection,
                  ListingPage, Page, Category, Brand, Product, ProductImage, ProductVariant)


@receiver(post_save)
@receiver(post_delete)
def clear_content_cache(sender, **kwargs):
    if sender in CONTENT_MODELS:
        cache.delete_many(['site_settings', 'menu', 'home'])


@receiver(post_delete, sender=ListingPage)
def remove_listing_menu_link(sender, instance, **kwargs):
    NavLink.objects.filter(source=f'listing:{instance.pk}').delete()


@receiver(post_delete, sender=Page)
def remove_page_menu_link(sender, instance, **kwargs):
    NavLink.objects.filter(source=f'page:{instance.pk}').delete()
