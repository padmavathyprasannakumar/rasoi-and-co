from decimal import Decimal

import django_filters
from django.db.models import DecimalField, ExpressionWrapper, F, Q, Value

from .models import Category, ListingPage, Product


class ProductFilter(django_filters.FilterSet):
    """
    /api/products/?category=air-fryers&brand=rasoi,philips&min_price=1000&max_price=25000
                  &capacity=4&colour=black&in_stock=true&on_sale=true&is_new=true&tag=festive
    """
    category = django_filters.CharFilter(method='filter_category')
    brand = django_filters.CharFilter(method='filter_brand')
    min_price = django_filters.NumberFilter(field_name='sale_price', lookup_expr='gte')
    max_price = django_filters.NumberFilter(field_name='sale_price', lookup_expr='lte')
    capacity = django_filters.CharFilter(method='filter_capacity')
    colour = django_filters.CharFilter(method='filter_colour')
    in_stock = django_filters.BooleanFilter(method='filter_in_stock')
    on_sale = django_filters.BooleanFilter(method='filter_on_sale')
    min_discount = django_filters.NumberFilter(method='filter_min_discount')
    is_new = django_filters.BooleanFilter()
    is_featured = django_filters.BooleanFilter()
    tag = django_filters.CharFilter(field_name='tag')
    listing = django_filters.CharFilter(method='filter_listing')

    class Meta:
        model = Product
        fields = ['category', 'brand', 'min_price', 'max_price', 'capacity', 'colour', 'in_stock',
                  'on_sale', 'min_discount', 'is_new', 'is_featured', 'tag', 'listing']

    def filter_listing(self, queryset, name, value):
        page = ListingPage.objects.filter(slug=value, is_active=True).first()
        return page.apply(queryset) if page else queryset

    def filter_category(self, queryset, name, value):
        slugs = [s.strip() for s in value.split(',') if s.strip()]
        if not slugs:
            return queryset
        ids = set(Category.objects.filter(slug__in=slugs).values_list('id', flat=True))
        # include sub-categories
        ids |= set(Category.objects.filter(parent_id__in=ids).values_list('id', flat=True))
        return queryset.filter(category_id__in=ids)

    def filter_brand(self, queryset, name, value):
        slugs = [s.strip() for s in value.split(',') if s.strip()]
        return queryset.filter(brand__slug__in=slugs) if slugs else queryset

    def filter_capacity(self, queryset, name, value):
        values = [s.strip() for s in value.split(',') if s.strip()]
        q = Q()
        for v in values:
            q |= Q(capacity__icontains=v) | Q(variants__capacity__icontains=v)
        return queryset.filter(q).distinct() if values else queryset

    def filter_colour(self, queryset, name, value):
        values = [s.strip() for s in value.split(',') if s.strip()]
        q = Q()
        for v in values:
            q |= Q(colour__iexact=v) | Q(variants__colour__iexact=v)
        return queryset.filter(q).distinct() if values else queryset

    def filter_in_stock(self, queryset, name, value):
        return queryset.filter(stock__gt=0) if value else queryset

    def filter_on_sale(self, queryset, name, value):
        return queryset.filter(sale_price__lt=F('mrp')) if value else queryset

    def filter_min_discount(self, queryset, name, value):
        # sale_price <= mrp * (1 - value/100)
        factor = Decimal('1') - (Decimal(str(value)) / Decimal('100'))
        return queryset.filter(sale_price__lte=ExpressionWrapper(
            F('mrp') * Value(factor), output_field=DecimalField(max_digits=12, decimal_places=2)))
