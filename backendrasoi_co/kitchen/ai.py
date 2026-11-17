"""
Rasoi AI — the chat assistant behind the "Ask Rasoi AI" widget.

How it answers:
1. It always searches YOUR catalogue (products, prices in ₹, FAQs, the customer's orders).
2. If an AI key is set in .env (AI_API_KEY), it sends that context to the AI model, which writes
   a natural reply in the customer's language (English, Hindi, Tamil, Telugu, Bengali, Marathi…).
3. If no key is set (or the AI service is down) it still replies using smart search — so the
   chat always works.

.env options:
    AI_PROVIDER=anthropic          # or: openai  (any OpenAI-compatible API: OpenAI, Gemini, Groq…)
    AI_API_KEY=your-secret-key
    AI_MODEL=claude-haiku-5-5      # e.g. gpt-4o-mini, gemini-2.0-flash …
    AI_BASE_URL=                   # only for OpenAI-compatible providers
"""
import logging
import re

from django.conf import settings
from django.db.models import Count, Q

from .constants import format_inr
from .models import FAQ, AIAssistant, Category, Order, Product, SiteSettings

log = logging.getLogger(__name__)

LANGUAGES = {
    'en': 'English', 'hi': 'Hindi', 'ta': 'Tamil', 'te': 'Telugu', 'bn': 'Bengali', 'mr': 'Marathi',
    'kn': 'Kannada', 'ml': 'Malayalam', 'gu': 'Gujarati',
}

STOPWORDS = {
    'the', 'and', 'for', 'with', 'under', 'below', 'above', 'best', 'good', 'need', 'want', 'which', 'what',
    'show', 'please', 'kitchen', 'small', 'large', 'family', 'home', 'buy', 'some', 'have', 'from', 'that',
    'this', 'your', 'you', 'can', 'suggest', 'recommend', 'looking', 'gift', 'price', 'budget', 'rupees',
    'about', 'like', 'any', 'one', 'get', 'how', 'much', 'cost', 'tell', 'give', 'me', 'my', 'is', 'are',
    'many', 'there', 'product', 'products', 'item', 'items', 'available', 'availability', 'stock', 'store',
    'shop', 'all', 'list', 'see', 'know', 'does', 'do', 'has', 'sell', 'selling', 'appliance', 'appliances',
    'option', 'options', 'model', 'models', 'brand', 'brands', 'type', 'types', 'kind', 'kinds', 'total',
    'number', 'count', 'cheap', 'cheapest', 'costly', 'expensive', 'top', 'new', 'latest', 'which', 'where',
    'when', 'why', 'will', 'would', 'could', 'should', 'need', 'thing', 'things', 'hai', 'hello', 'hii', 'thanks',
}

# Common spellings customers type -> how products are named in the catalogue
SYNONYMS = {
    r'\bair\s*-?\s*fryers?\b': 'air fryer',
    r'\bmixies?\b': 'mixer grinder',
    r'\bmixers?\s*-?\s*grinders?\b': 'mixer grinder',
    r'\bchimn(?:e|i)?y?s?\b': 'chimney',
    r'\bchimneys\b': 'chimney',
    r'\botg\b': 'oven toaster grill',
    r'\bcooker\b': 'pressure cooker',
    r'\bice\s*-?\s*creams?\b': 'ice cream',
    r'\bcoffee\s*machines?\b': 'coffee maker',
    r'\bwafflemaker\b': 'waffle maker',
    r'\bro\b|\bwater\s*filters?\b': 'water purifier',
    r'\binduction\s*stoves?\b': 'induction cooktop',
    r'\bfridge\b': 'refrigerator',
}
COUNT_WORDS = ('how many', 'number of', 'count of', 'total products', 'kitne', 'evvalavu', 'ethanai')
CART_WORDS = ('add to cart', 'add to my cart', 'add it', 'add this', 'add that', 'add to bag', 'add to my bag',
              'add in cart', 'add in my cart', 'put it in', 'put in cart', 'i will take',
              "i'll take", 'add one', 'cart la add', 'cart me add', 'add pannu', 'add karo', 'add kar do')
GREETINGS = ('hi', 'hii', 'hello', 'hey', 'namaste', 'vanakkam', 'good morning', 'good evening')


def normalise(text):
    t = (text or '').lower()
    for pattern, repl in SYNONYMS.items():
        t = re.sub(pattern, repl, t)
    return t
ORDER_WORDS = ('order', 'track', 'delivery status', 'where is my', 'shipped', 'cancel', 'refund')


def parse_budget(text):
    t = text.lower().replace(',', '')
    m = re.search(r'(?:₹|rs\.?|inr|under|below|within|less than|upto|up to)\s*(\d{3,7})(\s*k)?', t)
    if not m:
        m = re.search(r'(\d{1,3})\s*k\b', t)
        return int(m.group(1)) * 1000 if m else None
    value = int(m.group(1))
    return value * 1000 if m.group(2) else value


def keywords(text):
    words = re.findall(r'[a-zA-Z]{3,}', normalise(text))
    out = []
    for w in words:
        if w in STOPWORDS:
            continue
        out.append(w[:-1] if w.endswith('s') and len(w) > 4 else w)  # fryers -> fryer
    return out


def _word_q(w):
    return (Q(name__icontains=w) | Q(category__name__icontains=w) | Q(category__parent__name__icontains=w)
            | Q(brand__name__icontains=w) | Q(short_description__icontains=w) | Q(capacity__icontains=w)
            | Q(colour__iexact=w) | Q(tag__icontains=w))


def find_products(text, limit=4):
    """Returns (products, budget, total_matching)."""
    qs = (Product.objects.active().select_related('category', 'brand').prefetch_related('images', 'variants')
          .with_ratings())
    budget = parse_budget(text)
    if budget:
        qs = qs.filter(sale_price__lte=budget)
    words = keywords(text)
    if words:
        # Prefer products matching ALL words (e.g. "air" AND "fryer"), then ANY word.
        q_all, q_any = Q(), Q()
        for w in words:
            q_all &= _word_q(w)
            q_any |= _word_q(w)
        matched = qs.filter(q_all).distinct()
        if not matched.exists():
            matched = qs.filter(q_any).distinct()
        if matched.exists():
            qs = matched
        elif not budget:
            return [], budget, 0
    elif not budget:
        return [], budget, 0
    total = qs.count()
    return list(qs.order_by('-sold_count', '-is_featured', 'sale_price')[:limit]), budget, total


def find_faqs(text, limit=2):
    words = set(keywords(text))
    if not words:
        return []
    scored = []
    for f in FAQ.objects.filter(is_active=True):
        in_q = len(words & set(keywords(f.question)))
        in_a = len(words & set(keywords(f.answer)))
        score = in_q * 2 + in_a
        if in_q >= 1 and score >= 2:          # must match the QUESTION, not just a word in the answer
            scored.append((score, f))
    scored.sort(key=lambda x: -x[0])
    return [f for _, f in scored[:limit]]


def recent_orders(user, limit=3):
    if not user or not user.is_authenticated:
        return []
    return list(Order.objects.filter(user=user).prefetch_related('items')[:limit])


# ---------------------------------------------------------------------------
# AI providers
# ---------------------------------------------------------------------------
def call_llm(system, messages):
    """Return the model's reply text, or None if AI is not configured / fails."""
    key = getattr(settings, 'AI_API_KEY', '')
    if not key:
        return None
    import requests

    provider = getattr(settings, 'AI_PROVIDER', 'anthropic').lower()
    model = getattr(settings, 'AI_MODEL', '') or ('claude-haiku-5-5' if provider == 'anthropic' else 'gpt-4o-mini')
    try:
        if provider == 'anthropic':
            r = requests.post(
                'https://api.anthropic.com/v1/messages',
                headers={'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json'},
                json={'model': model, 'max_tokens': 700, 'system': system, 'messages': messages},
                timeout=40,
            )
            r.raise_for_status()
            data = r.json()
            return ''.join(block.get('text', '') for block in data.get('content', []) if block.get('type') == 'text').strip()
        # OpenAI-compatible
        base = (getattr(settings, 'AI_BASE_URL', '') or 'https://api.openai.com/v1').rstrip('/')
        payload = {'model': model, 'max_tokens': 1500, 'temperature': 0.5,
                   'messages': [{'role': 'system', 'content': system}] + messages}
        if 'gpt-oss' in model:                       # Groq reasoning models: keep thinking short & hidden
            payload['reasoning_effort'] = 'low'
            payload['include_reasoning'] = False
        r = requests.post(
            f'{base}/chat/completions',
            headers={'Authorization': f'Bearer {key}', 'Content-Type': 'application/json'},
            json=payload,
            timeout=40,
        )
        if r.status_code >= 400:
            log.warning('AI provider error %s: %s', r.status_code, r.text[:300])
            return None
        content = r.json()['choices'][0]['message'].get('content') or ''
        return content.strip() or None
    except Exception as exc:  # network error, bad key, quota …
        log.warning('AI provider failed: %s', exc)
        return None


# ---------------------------------------------------------------------------
# Main entry
# ---------------------------------------------------------------------------
def product_line(p):
    off = f', {p.discount_percent}% off MRP {format_inr(p.mrp)}' if p.discount_percent else ''
    specs = ', '.join(x for x in [p.capacity, p.wattage, p.colour] if x)
    stock = 'in stock' if p.stock > 0 else 'out of stock'
    return (f'- {p.name} | {p.category.name}{" | " + p.brand.name if p.brand else ""} | '
            f'{format_inr(p.sale_price)}{off} | {specs} | warranty {p.warranty or "2 years"} | {stock} | '
            f'link /product/{p.slug}')


def build_context(message, user):
    site = SiteSettings.load()
    products, budget, total = find_products(message, limit=6)
    faqs = find_faqs(message)
    orders = recent_orders(user) if any(w in message.lower() for w in ORDER_WORDS) else []
    categories = ', '.join(
        f'{c.name} ({c.n})' for c in Category.objects.filter(is_active=True)
        .annotate(n=Count('products', filter=Q(products__is_active=True))).filter(n__gt=0))
    all_count = Product.objects.active().count()

    lines = [
        f'STORE: {site.store_name} — {site.tagline}. Indian online store; all prices in Indian Rupees (₹), '
        f'inclusive of GST. Free shipping over {format_inr(site.free_shipping_threshold)} '
        f'(otherwise {format_inr(site.shipping_fee)}). Payments: UPI, cards, RuPay, net banking, wallets '
        f'(Razorpay) and Cash on Delivery. {site.default_warranty_text}. Support: {site.phone}, {site.email}, '
        f'{site.business_hours}.',
        f'CATEGORIES (number of products): {categories}. TOTAL PRODUCTS IN STORE: {all_count}.',
    ]
    if budget:
        lines.append(f'CUSTOMER BUDGET: up to {format_inr(budget)}.')
    lines.append(f'TOTAL MATCHING PRODUCTS: {total} (showing up to {len(products)}).')
    lines.append('MATCHING PRODUCTS:\n' + ('\n'.join(product_line(p) for p in products) if products
                                          else '(none matched — ask a clarifying question or suggest categories)'))
    if faqs:
        lines.append('RELEVANT FAQS:\n' + '\n'.join(f'Q: {f.question}\nA: {f.answer}' for f in faqs))
    if orders:
        lines.append('CUSTOMER ORDERS:\n' + '\n'.join(
            f'- #{o.order_number}: {o.get_status_display()}, payment {o.get_payment_status_display()}, '
            f'total {format_inr(o.total)}, placed {o.created_at:%d/%m/%Y}'
            + (f', expected {o.estimated_delivery:%d/%m/%Y}' if o.estimated_delivery else '')
            for o in orders))
    elif any(w in message.lower() for w in ORDER_WORDS):
        lines.append('CUSTOMER ORDERS: ' + ('none found.' if user and user.is_authenticated
                                          else 'customer is not signed in — ask them to sign in to see orders.'))
    return '\n\n'.join(lines), products, faqs, orders, total


def fallback_reply(message, products, faqs, orders, user, budget, total=0):
    text = normalise(message)
    words = set(re.findall(r'[a-z]+', text))
    if words and words <= set(GREETINGS) | {'there', 'rasoi', 'ai'}:
        return ("Hello! I'm Rasoi AI. Tell me what you're looking for — an air fryer, mixer grinder, chimney — "
                "and your budget in ₹, and I'll suggest the best options.")
    if any(w in text for w in ORDER_WORDS) and not products:
        if not (user and user.is_authenticated):
            return 'Please sign in so I can check your orders. You can also track them anytime under My account → My orders.'
        if not orders:
            return "I couldn't find any orders on your account yet."
        return 'Here are your latest orders:\n' + '\n'.join(
            f'• #{o.order_number} — {o.get_status_display()} ({format_inr(o.total)})' for o in orders)
    if any(w in text for w in COUNT_WORDS):
        if products:
            noun = 'product' if total == 1 else 'products'
            return f'We have {total} matching {noun} right now' + (
                f' within {format_inr(budget)}' if budget else '') + '. Here are the top picks — all prices include GST:'
        if not keywords(message):
            n = Product.objects.active().count()
            return f'We have {n} products in the store right now. Tell me the appliance you need and I\'ll show the best ones.'
        return "We don't have that appliance in the store right now. Try air fryers, mixer grinders, coffee makers or waffle makers."
    if products:
        intro = f'Here are my top picks within {format_inr(budget)}' if budget else 'Here are some great picks for you'
        return intro + ' — all prices include GST:'
    if faqs:
        return faqs[0].answer
    return ("I'd love to help! Tell me the appliance you need (like air fryer, mixer grinder or chimney), "
            "your family size and your budget in ₹ — I'll suggest the best options.")


def wants_add_to_cart(message):
    t = (message or '').lower()
    return any(w in t for w in CART_WORDS)


def resolve_cart_product(message, context_slugs):
    """Which product does 'add it to my cart' mean? Message first, then the products shown in the last reply."""
    products, _, _ = find_products(message, limit=3)
    if len(products) == 1:
        return products[0], []
    if context_slugs:
        ctx = list(Product.objects.active().filter(slug__in=context_slugs[:4]))
        ctx.sort(key=lambda p: context_slugs.index(p.slug))
        if products:
            named = [p for p in ctx if p in products]
            if len(named) == 1:
                return named[0], []
        if len(ctx) == 1:
            return ctx[0], []
        if ctx:
            return None, ctx           # several shown -> ask which one
    if products:
        return None, products
    return None, []


def cart_reply(message, context_slugs):
    product, options = resolve_cart_product(message, context_slugs)
    if product is None:
        if options:
            names = '\n'.join(f'• {p.name} — {format_inr(p.sale_price)}' for p in options)
            return {'reply': f'Which one should I add to your bag?\n{names}\n\nOr tap **Add** on the product card below.',
                    'products': options, 'cart_action': None}
        return {'reply': "Tell me which appliance you'd like and I'll add it to your bag — for example "
                         '"add the electric kettle to my cart".', 'products': [], 'cart_action': None}
    if product.stock <= 0:
        return {'reply': f'Sorry, **{product.name}** is out of stock right now. Would you like a similar option?',
                'products': [product], 'cart_action': None}
    return {'reply': f'Done! **{product.name}** ({format_inr(product.sale_price)}, GST included) is in your bag. '
                     'Tap the bag icon to check out, or keep shopping.',
            'products': [product], 'cart_action': product}


def chat(message, history=None, assistant_slug=None, language='en', user=None, context_products=None):
    message = (message or '').strip()[:1000]
    if wants_add_to_cart(message):
        # Real action: the website adds this product to the bag (the AI never just *says* it did).
        result = cart_reply(message, [str(s) for s in (context_products or []) if s])
        result.update({'source': 'cart', 'assistant': 'Rasoi AI'})
        return result
    assistant = (AIAssistant.objects.filter(slug=assistant_slug, is_active=True).first()
                 or AIAssistant.objects.filter(is_default=True, is_active=True).first()
                 or AIAssistant.objects.filter(is_active=True).first())
    context, products, faqs, orders, total = build_context(message, user)
    budget = parse_budget(message)
    lang_name = LANGUAGES.get((language or 'en')[:2], 'English')

    persona = assistant.system_prompt if assistant else (
        'You are Rasoi AI, a warm and knowledgeable kitchen-appliance expert for Indian homes.')
    system = (
        f'{persona}\n\nRULES:\n'
        f'- Reply in {lang_name}. Keep it short (2–5 sentences or a few bullets), friendly and practical.\n'
        f'- Recommend ONLY products listed under MATCHING PRODUCTS. Never invent products, prices or stock.\n'
        f'- Always write prices in Indian format with ₹ (e.g. ₹1,49,999) and mention they include GST when relevant.\n'
        f'- Mention key reasons (capacity, wattage, family size, Indian cooking like idli batter, tadka, rotis).\n'
        f'- For "how many" questions use TOTAL MATCHING PRODUCTS / CATEGORIES counts exactly.\n'
        f'- If nothing matches, say so honestly and ask one clarifying question (appliance type, budget, family size).\n'
        f'- You cannot add items to the cart yourself. Never say an item was added. If the customer wants it, '
        f'tell them to say "add it to my cart" or tap the Add button on the product card.\n'
        f'- Answer only questions about this store, kitchen appliances and cooking; politely decline anything else.\n'
        f'- For orders, use only CUSTOMER ORDERS. For policies use STORE and FAQS.\n\n'
        f'CONTEXT:\n{context}'
    )

    messages = []
    for h in (history or [])[-8:]:
        role = 'assistant' if h.get('role') in ('assistant', 'ai') else 'user'
        content = str(h.get('content', ''))[:1000]
        if content:
            if messages and messages[-1]['role'] == role:
                messages[-1]['content'] += '\n' + content
            else:
                messages.append({'role': role, 'content': content})
    if messages and messages[0]['role'] == 'assistant':
        messages = messages[1:]
    if messages and messages[-1]['role'] == 'user':
        messages[-1]['content'] += '\n' + message
    else:
        messages.append({'role': 'user', 'content': message})

    reply = call_llm(system, messages)
    source = 'ai'
    if not reply:
        reply = fallback_reply(message, products, faqs, orders, user, budget, total)
        source = 'smart-search'

    return {
        'reply': reply,
        'products': products[:4],
        'source': source,
        'assistant': assistant.name if assistant else 'Rasoi AI',
        'cart_action': None,
    }
