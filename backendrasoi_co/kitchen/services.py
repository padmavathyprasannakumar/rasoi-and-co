"""Business logic shared by views: cart totals (₹), PIN code delivery check, Razorpay client."""
from datetime import timedelta
from decimal import Decimal

from django.conf import settings
from django.utils import timezone

from .models import ServiceablePincode, SiteSettings

TWO_PLACES = Decimal('0.01')


def money(value):
    return Decimal(value or 0).quantize(TWO_PLACES)


def compute_totals(lines, site=None, payment_method=None):
    """
    lines: iterable of dicts with unit_price, unit_mrp, quantity, gst_rate
    Prices are GST-inclusive (Indian MRP convention).
    """
    site = site or SiteSettings.load()
    subtotal = Decimal('0')
    mrp_total = Decimal('0')
    gst_amount = Decimal('0')
    item_count = 0
    for line in lines:
        qty = int(line['quantity'])
        price = Decimal(line['unit_price'])
        mrp = Decimal(line['unit_mrp'] or price)
        rate = Decimal(line.get('gst_rate') or 0)
        line_total = price * qty
        subtotal += line_total
        mrp_total += max(mrp, price) * qty
        gst_amount += line_total * rate / (Decimal('100') + rate) if rate else Decimal('0')
        item_count += qty

    threshold = site.free_shipping_threshold or Decimal('0')
    if subtotal == 0 or subtotal >= threshold:
        shipping = Decimal('0')
    else:
        shipping = site.shipping_fee or Decimal('0')
    cod_fee = (site.cod_fee or Decimal('0')) if payment_method == 'cod' and subtotal > 0 else Decimal('0')
    total = subtotal + shipping + cod_fee

    return {
        'item_count': item_count,
        'subtotal': money(subtotal),
        'mrp_total': money(mrp_total),
        'discount': money(mrp_total - subtotal),
        'shipping_fee': money(shipping),
        'cod_fee': money(cod_fee),
        'gst_amount': money(gst_amount),
        'total': money(total),
        'free_shipping_threshold': money(threshold),
        'amount_to_free_shipping': money(max(Decimal('0'), threshold - subtotal)) if subtotal > 0 else money(threshold),
        'cod_allowed': total <= (site.cod_max_order_value or Decimal('0')),
    }


def cart_lines(cart):
    lines = []
    for item in cart.items.select_related('product', 'variant'):
        lines.append({
            'unit_price': item.unit_price,
            'unit_mrp': item.unit_mrp,
            'quantity': item.quantity,
            'gst_rate': item.product.gst_rate,
        })
    return lines


def check_pincode(pincode):
    """Return delivery info for a 6-digit Indian PIN code."""
    site = SiteSettings.load()
    pincode = (pincode or '').strip()
    if not (len(pincode) == 6 and pincode.isdigit() and pincode[0] != '0'):
        return {'valid': False, 'serviceable': False, 'message': 'Please enter a valid 6-digit PIN code.'}

    record = ServiceablePincode.objects.filter(pincode=pincode, is_active=True).first()
    if record:
        days, cod, city, state = record.delivery_days, record.cod_available, record.city, record.state
    elif site.deliver_all_india:
        days, cod, city, state = site.default_delivery_days, True, '', ''
    else:
        return {
            'valid': True, 'serviceable': False, 'pincode': pincode,
            'message': 'Sorry, we do not deliver to this PIN code yet.',
        }

    eta = timezone.localdate() + timedelta(days=days)
    where = f' to {city}' if city else ''
    return {
        'valid': True,
        'serviceable': True,
        'pincode': pincode,
        'city': city,
        'state': state,
        'delivery_days': days,
        'cod_available': cod,
        'estimated_delivery': eta.isoformat(),
        'estimated_delivery_display': eta.strftime('%d/%m/%Y'),
        'message': f'Delivery{where} by {eta.strftime("%a, %d %b")}' + (' · Cash on Delivery available' if cod else ''),
    }


def razorpay_client():
    import razorpay

    if not (settings.RAZORPAY_KEY_ID and settings.RAZORPAY_KEY_SECRET):
        return None
    return razorpay.Client(auth=(settings.RAZORPAY_KEY_ID, settings.RAZORPAY_KEY_SECRET))
