"""
Load sample content with Indian prices (₹) so the website is not empty.

    python manage.py seed_data

Safe to run more than once (it updates existing rows instead of duplicating).
Images are not included — upload them in Django admin (Products → Product images).
"""
from decimal import Decimal as D

from django.core.management.base import BaseCommand
from django.db import transaction

from kitchen.models import (
    FAQ,
    AIAssistant,
    Brand,
    Category,
    HeroSlide,
    Highlight,
    HomeSection,
    ListingPage,
    NavLink,
    Page,
    PageSection,
    Product,
    ProductSpecification,
    ProductVariant,
    PromoBanner,
    ServiceablePincode,
    SiteSettings,
    Testimonial,
)

CATEGORIES = [
    # name, slug, menu_group, description
    ('Mixer Grinders', 'mixer-grinders', 'Food prep', 'Powerful motors for chutneys, masalas and idli batter.'),
    ('Air Fryers', 'air-fryers', 'Cooking', 'Crispy samosas and fries with up to 90% less oil.'),
    ('Microwaves', 'microwaves', 'Cooking', 'Solo, grill and convection ovens for every kitchen.'),
    ('Refrigerators', 'refrigerators', 'Large appliances', 'Frost-free, inverter and side-by-side models.'),
    ('Induction Cooktops', 'induction-cooktops', 'Cooking', 'Fast, safe and energy-efficient cooking.'),
    ('Cookware', 'cookware', 'Cooking', 'Tri-ply, cast iron and non-stick essentials.'),
    ('Chimneys', 'chimneys', 'Large appliances', 'Auto-clean chimneys built for Indian tadka.'),
    ('Water Purifiers', 'water-purifiers', 'Cleaning & water', 'RO + UV + UF purification for safe drinking water.'),
    ('Coffee Makers', 'coffee-makers', 'Beverages', 'From filter kaapi to espresso at home.'),
    ('Toasters', 'toasters', 'Beverages', 'Golden toast and sandwiches in minutes.'),
    ('Kettles', 'kettles', 'Beverages', 'Boil water for chai in under 3 minutes.'),
    ('Dishwashers', 'dishwashers', 'Cleaning & water', 'Designed for Indian utensils and kadhais.'),
]

BRANDS = ['Rasoi Signature', 'Prestige', 'Philips', 'Bajaj', 'LG', 'Samsung', 'Faber', 'Kent', 'Morphy Richards', 'Bosch']

PRODUCTS = [
    # name, category, brand, mrp, sale, gst, hsn, wattage, capacity, colour, stock, featured, new, tag, badge, short
    ('Rasoi Pro Mixer Grinder 750W', 'mixer-grinders', 'Rasoi Signature', 5999, 3499, 18, '8509', '750 W', '3 jars', 'Copper Black', 40, True, True, 'bestseller', 'THE CURATED EDIT', 'Copper motor with 3 stainless-steel jars for wet and dry grinding.'),
    ('Prestige Iris 750W Juicer Mixer Grinder', 'mixer-grinders', 'Prestige', 4495, 2899, 18, '8509', '750 W', '4 jars', 'White', 25, False, False, '', '', 'Juicer jar plus 3 grinding jars for every kitchen task.'),
    ('Philips Essential Air Fryer 4.1L', 'air-fryers', 'Philips', 9995, 6499, 18, '8516', '1400 W', '4.1 L', 'Black', 30, True, True, 'festive', 'FESTIVE PICK', 'Rapid Air technology for crisp results with little oil.'),
    ('Rasoi Digital Air Fryer 6.2L', 'air-fryers', 'Rasoi Signature', 11990, 7499, 18, '8516', '1700 W', '6.2 L', 'Matte Grey', 18, True, False, '', '', 'Touch panel with 8 presets — perfect for family portions.'),
    ('LG 28L Convection Microwave', 'microwaves', 'LG', 18990, 13990, 18, '8516', '900 W', '28 L', 'Black', 15, True, False, 'bestseller', '', 'Diet fry, 301 auto-cook menus and a tandoor-style grill.'),
    ('Samsung 23L Solo Microwave', 'microwaves', 'Samsung', 7990, 5990, 18, '8516', '800 W', '23 L', 'White', 22, False, True, '', '', 'Ceramic enamel cavity that is easy to clean.'),
    ('Samsung 653L Side-by-Side Refrigerator', 'refrigerators', 'Samsung', 124990, 89990, 18, '8418', '', '653 L', 'Silver', 6, True, True, 'limited', 'FLAGSHIP', 'SpaceMax technology with digital inverter compressor.'),
    ('LG 343L Frost-Free Double Door Refrigerator', 'refrigerators', 'LG', 46990, 36490, 18, '8418', '', '343 L', 'Shiny Steel', 10, False, False, 'energy', '', 'Smart inverter compressor and multi-air flow cooling.'),
    ('Rasoi Glide Induction Cooktop 2000W', 'induction-cooktops', 'Rasoi Signature', 3995, 2299, 18, '8516', '2000 W', '', 'Black', 50, False, True, '', '', 'Feather-touch controls with 8 Indian cooking presets.'),
    ('Prestige PIC 20 Induction Cooktop', 'induction-cooktops', 'Prestige', 3195, 1999, 18, '8516', '1600 W', '', 'Black', 45, False, False, '', '', 'Anti-magnetic wall and automatic voltage regulator.'),
    ('Rasoi Tri-Ply Cookware Set (5 pcs)', 'cookware', 'Rasoi Signature', 9999, 5999, 5, '7323', '', '5 pieces', 'Steel', 35, True, True, 'wedding', 'GIFT READY', 'Kadhai, tope, fry pan and saucepan — induction friendly.'),
    ('Prestige Cast Iron Tawa 28cm', 'cookware', 'Prestige', 1995, 1299, 5, '7323', '', '28 cm', 'Black', 60, False, False, '', '', 'Pre-seasoned tawa for perfect dosas and rotis.'),
    ('Faber 90cm Auto-Clean Chimney', 'chimneys', 'Faber', 32990, 21990, 18, '8414', '', '1350 m³/hr', 'Black Glass', 12, True, False, 'festive', '', 'Filterless design with motion-sensor controls.'),
    ('Rasoi Curve 60cm Chimney', 'chimneys', 'Rasoi Signature', 18990, 12490, 18, '8414', '', '1200 m³/hr', 'Black', 14, False, True, '', '', 'Thermal auto-clean with oil collector.'),
    ('Kent Grand Plus RO+UV+UF Purifier', 'water-purifiers', 'Kent', 21000, 15999, 18, '8421', '60 W', '9 L', 'White', 20, True, False, 'bestseller', '', 'Mineral RO technology retains essential minerals.'),
    ('Rasoi Pure Copper+ RO Purifier', 'water-purifiers', 'Rasoi Signature', 18990, 11990, 18, '8421', '36 W', '8 L', 'Copper White', 16, False, True, '', '', 'Copper infusion with 7-stage purification.'),
    ('Morphy Richards Europa Espresso Maker', 'coffee-makers', 'Morphy Richards', 11995, 7999, 18, '8516', '800 W', '4 cups', 'Black', 12, True, False, '', '', 'Steam wand for cappuccinos and lattes at home.'),
    ('Rasoi Filter Kaapi Brewer', 'coffee-makers', 'Rasoi Signature', 4995, 2999, 18, '8516', '600 W', '6 cups', 'Copper', 25, False, True, 'diwali', '', 'Authentic South Indian decoction, ready in minutes.'),
    ('Bajaj 2-Slice Pop-Up Toaster', 'toasters', 'Bajaj', 2195, 1399, 18, '8516', '750 W', '2 slices', 'White', 40, False, False, '', '', '7 browning levels with auto pop-up.'),
    ('Philips Daily Collection Toaster', 'toasters', 'Philips', 2995, 1999, 18, '8516', '830 W', '2 slices', 'Black', 28, False, True, '', '', 'Bun warmer rack and defrost function.'),
    ('Rasoi Copper Glow Kettle 1.5L', 'kettles', 'Rasoi Signature', 2495, 1299, 18, '8516', '1500 W', '1.5 L', 'Copper', 70, True, True, 'bestseller', '', 'Stainless-steel body with auto shut-off.'),
    ('Prestige Electric Kettle 1.8L', 'kettles', 'Prestige', 1795, 999, 18, '8516', '1500 W', '1.8 L', 'Steel', 80, False, False, '', '', 'Concealed heating element for easy cleaning.'),
    ('Bosch 13 Place Setting Dishwasher', 'dishwashers', 'Bosch', 54990, 38990, 18, '8422', '2400 W', '13 place settings', 'Silver', 8, True, False, 'energy', '', 'Intensive Kadhai programme for Indian cooking.'),
    ('LG 14 Place TrueSteam Dishwasher', 'dishwashers', 'LG', 62990, 46990, 18, '8422', '1800 W', '14 place settings', 'Silver', 5, False, True, '', '', 'TrueSteam removes 99.9% of germs.'),
]

PINCODES = [
    ('400001', 'Mumbai', 'Maharashtra', 2), ('400069', 'Mumbai', 'Maharashtra', 2),
    ('110001', 'New Delhi', 'Delhi', 3), ('560001', 'Bengaluru', 'Karnataka', 3),
    ('600001', 'Chennai', 'Tamil Nadu', 3), ('700001', 'Kolkata', 'West Bengal', 4),
    ('500001', 'Hyderabad', 'Telangana', 3), ('411001', 'Pune', 'Maharashtra', 3),
    ('380001', 'Ahmedabad', 'Gujarat', 4), ('302001', 'Jaipur', 'Rajasthan', 4),
    ('682001', 'Kochi', 'Kerala', 5), ('641001', 'Coimbatore', 'Tamil Nadu', 4),
]


class Command(BaseCommand):
    help = 'Load sample Rasoi & Co. content with Indian prices (₹).'

    @transaction.atomic
    def handle(self, *args, **options):
        SiteSettings.load()  # creates defaults
        self.stdout.write('✓ Site settings')

        nav = [
            ('Home', '/', 'header', False, 0), ('Contact', '/contact', 'header', False, 9),
            ('All collections', '/shop', 'footer_shop', False, 0), ('New arrivals', '/new-arrivals', 'footer_shop', False, 1),
            ('Festive deals', '/offers', 'footer_shop', False, 2), ('Air fryers', '/category/air-fryers', 'footer_shop', False, 3),
            ('Mixer grinders', '/category/mixer-grinders', 'footer_shop', False, 4),
            ('My orders & tracking', '/account', 'footer_care', False, 0), ('Shipping & returns', '/shipping-returns', 'footer_care', False, 1),
            ('Warranty', '/warranty', 'footer_care', False, 2), ('FAQs', '/faq', 'footer_care', False, 3),
            ('Contact us', '/contact', 'footer_care', False, 4),
        ]
        for label, url, loc, mega, order in nav:
            NavLink.objects.update_or_create(label=label, location=loc, defaults={'url': url, 'has_mega_menu': mega, 'order': order})
        self.stdout.write('✓ Menu links')

        HeroSlide.objects.update_or_create(order=0, defaults={
            'eyebrow': 'THE RASOI EDIT', 'title': 'Smart kitchens,', 'italic_subtitle': 'beautifully made.',
            'description': 'Appliances chosen for Indian homes — powerful, beautiful and built to last. Delivery across India.',
            'badge_text': 'New festive launches', 'button_text': 'Find your next favourite', 'button_link': '/shop',
            'secondary_button_text': 'Discover new arrivals', 'secondary_button_link': '/new-arrivals',
        })
        self.stdout.write('✓ Hero slide (upload an image or .glb in admin)')

        for i, (icon, title, sub, placement) in enumerate([
            ('truck', 'Free shipping', 'On orders over ₹1,999', 'both'),
            ('return', 'Easy returns', '7-day replacement', 'both'),
            ('shield', 'Secure payments', 'UPI, cards & netbanking', 'both'),
            ('warranty', '2-year warranty', 'On all appliances', 'hero'),
            ('spark', 'AI expert 24/7', 'Chat, speak & shop', 'footer'),
        ]):
            Highlight.objects.update_or_create(title=title, defaults={
                'icon': icon, 'subtitle': sub, 'order': i, 'placement': placement})
        self.stdout.write('✓ Highlights')

        cats = {}
        for i, (name, slug, group, desc) in enumerate(CATEGORIES):
            cats[slug], _ = Category.objects.update_or_create(
                slug=slug, defaults={'name': name, 'menu_group': group, 'description': desc, 'order': i})
        self.stdout.write(f'✓ {len(cats)} categories')

        brands = {}
        for name in BRANDS:
            brands[name], _ = Brand.objects.get_or_create(name=name)
        self.stdout.write(f'✓ {len(brands)} brands')

        for (name, cat, brand, mrp, sale, gst, hsn, watt, cap, colour, stock,
             featured, new, tag, badge, short) in PRODUCTS:
            p, _ = Product.objects.update_or_create(name=name, defaults={
                'category': cats[cat], 'brand': brands[brand], 'mrp': D(mrp), 'sale_price': D(sale),
                'gst_rate': D(gst), 'hsn_code': hsn, 'wattage': watt, 'capacity': cap, 'colour': colour,
                'stock': stock, 'is_featured': featured, 'is_new': new, 'tag': tag, 'badge_text': badge,
                'short_description': short,
                'description': f'<p>{short}</p><p>Backed by a 2-year warranty and doorstep service across India. '
                               f'Price is inclusive of all taxes (GST).</p>',
                'warranty': '2 years', 'dimensions': '', 'cod_available': sale <= 50000,
            })
            ProductSpecification.objects.get_or_create(product=p, label='In the box', defaults={'value': '1 unit, user manual, warranty card'})
        self.stdout.write(f'✓ {len(PRODUCTS)} products')

        # Variants examples
        kettle = Product.objects.get(name='Rasoi Copper Glow Kettle 1.5L')
        for i, (colour, hexv, cap, price) in enumerate([('Copper', '#B87333', '1.5 L', 1299),
                                                         ('Sage', '#7A8B6F', '1.5 L', 1349),
                                                         ('Charcoal', '#1F2326', '1.8 L', 1499)]):
            ProductVariant.objects.update_or_create(product=kettle, colour=colour, capacity=cap,
                                                    defaults={'colour_hex': hexv, 'price': D(price), 'stock': 25, 'order': i})
        fryer = Product.objects.get(name='Rasoi Digital Air Fryer 6.2L')
        for i, (cap, price, mrp) in enumerate([('4.5 L', 5999, 9990), ('6.2 L', 7499, 11990), ('8 L', 9499, 14990)]):
            ProductVariant.objects.update_or_create(product=fryer, capacity=cap, colour='Matte Grey',
                                                    defaults={'colour_hex': '#6B6660', 'price': D(price), 'mrp': D(mrp),
                                                              'stock': 12, 'order': i})
        self.stdout.write('✓ Variants')

        for code, city, state, days in PINCODES:
            ServiceablePincode.objects.update_or_create(pincode=code, defaults={'city': city, 'state': state, 'delivery_days': days})
        self.stdout.write('✓ Serviceable PIN codes')

        PromoBanner.objects.update_or_create(title='Festive kitchen', position='home_top', defaults={
            'eyebrow': 'A NEW KITCHEN STORY', 'italic_text': 'ready.', 'subtitle': 'Up to 40% off on festive favourites',
            'button_text': 'Shop the deals', 'link': '/offers', 'background_color': '#F1E7DC', 'order': 0})
        PromoBanner.objects.update_or_create(title='Everyday', position='home_top', defaults={
            'eyebrow': 'A NEW KITCHEN STORY', 'italic_text': 'elevated.', 'subtitle': 'Copper-finish essentials for daily chai',
            'button_text': 'Explore', 'link': '/category/kettles', 'background_color': '#E3E8DE', 'order': 1})
        PromoBanner.objects.update_or_create(title='Planning a new kitchen?', position='home_ai', defaults={
            'eyebrow': 'MEET YOUR KITCHEN EXPERT', 'italic_text': "Let's find your fit.",
            'subtitle': 'Tell Rasoi AI what you cook, your family size and budget in ₹ — get instant picks.',
            'button_text': 'Ask our expert', 'link': '#ask-ai', 'background_color': '#F1E7DC'})
        self.stdout.write('✓ Promo banners')

        for i, (name, city, quote, prod) in enumerate([
            ('Priya S.', 'Chennai', 'The mixer grinder makes the smoothest idli batter. Delivered in 3 days!', 'Rasoi Pro Mixer Grinder'),
            ('Arjun M.', 'Pune', 'Air fryer samosas every weekend now. Paid with UPI, super smooth checkout.', 'Philips Air Fryer'),
            ('Fatima K.', 'Hyderabad', 'Beautiful copper kettle — gets compliments from every guest.', 'Copper Glow Kettle'),
        ]):
            Testimonial.objects.update_or_create(name=name, defaults={'city': city, 'quote': quote, 'product_name': prod, 'order': i})
        self.stdout.write('✓ Testimonials')

        faqs = [
            ('orders', 'Which payment methods do you accept?', 'UPI (GPay, PhonePe, Paytm), debit/credit cards including RuPay, net banking, wallets via Razorpay, and Cash on Delivery on eligible orders.'),
            ('orders', 'Are prices inclusive of GST?', 'Yes. All prices shown in ₹ are inclusive of GST. A GST invoice is emailed with every order.'),
            ('shipping', 'Do you deliver across India?', 'Yes, we deliver to most PIN codes in India. Check delivery time on any product page using the PIN code checker.'),
            ('shipping', 'Is shipping free?', 'Shipping is free on orders over ₹1,999. A small fee applies below that.'),
            ('returns', 'What is your return policy?', 'Damaged or defective products can be replaced within 7 days of delivery.'),
            ('warranty', 'How do I claim warranty?', 'Contact us with your order number. We arrange a service visit or replacement as per the brand warranty.'),
        ]
        for i, (cat, q, a) in enumerate(faqs):
            FAQ.objects.update_or_create(question=q, defaults={'category': cat, 'answer': a, 'order': i})
        self.stdout.write('✓ FAQs')

        about, _ = Page.objects.update_or_create(slug='about', defaults={
            'eyebrow': 'OUR STORY', 'title': 'More than a kitchen.', 'italic_title': 'A little expression of you.',
            'subtitle': 'Rasoi & Co. began with a simple idea — Indian kitchens deserve appliances that are both hardworking and beautiful.',
            'content': '<p>We test every appliance in real Indian kitchens — grinding masalas, frying pakoras and brewing filter kaapi — before it earns a place in our store.</p>'
                       '<p>From Mumbai to Guwahati, we deliver across India with secure payments, GST invoices and a 2-year warranty.</p>'})
        PageSection.objects.update_or_create(page=about, title='Thoughtfully chosen', defaults={
            'text': 'Only appliances that pass our kitchen tests make it to the shelf.', 'order': 0})
        PageSection.objects.update_or_create(page=about, title='Made for Indian cooking', defaults={
            'text': 'High-torque motors, tadka-proof chimneys and kadhai-friendly dishwashers.', 'image_on_left': False, 'order': 1})
        Page.objects.update_or_create(slug='shipping-returns', defaults={
            'eyebrow': 'CUSTOMER CARE', 'title': 'Shipping &', 'italic_title': 'returns',
            'content': '<h2>Shipping</h2><ul><li>Free shipping on orders over ₹1,999.</li><li>Delivery in 2–7 working days depending on your PIN code.</li>'
                       '<li>Large appliances include free installation in metro cities.</li></ul>'
                       '<h2>Returns</h2><ul><li>7-day replacement for damaged or defective items.</li><li>Refunds are processed to the original payment method within 5–7 working days.</li></ul>'})
        Page.objects.update_or_create(slug='warranty', defaults={
            'eyebrow': 'PEACE OF MIND', 'title': 'Warranty', 'italic_title': '& service',
            'content': '<p>All appliances carry a minimum 2-year warranty. Keep your GST invoice — it is your warranty proof.</p>'
                       '<h2>How to claim</h2><ol><li>Contact us with your order number.</li><li>We schedule a technician visit within 48 hours.</li><li>Repair or replacement as per brand policy.</li></ol>'})
        Page.objects.update_or_create(slug='privacy', defaults={
            'title': 'Privacy policy', 'content': '<p>We collect only the information needed to process your orders and never sell your data.</p>'})
        Page.objects.update_or_create(slug='terms', defaults={
            'title': 'Terms & conditions', 'content': '<p>By placing an order you agree to our terms of sale. All prices are in Indian Rupees (₹) and inclusive of GST.</p>'})
        self.stdout.write('✓ Pages')

        # Listing pages → appear in the header menu automatically
        for slug, label, eyebrow, title, italic, extra, order, mega in [
            ('shop', 'Collections', 'The Rasoi collection', 'Discover your', 'next favourite', {}, 1, True),
            ('new-arrivals', 'New arrivals', 'Just landed', 'New', 'arrivals', {'only_new': True}, 2, False),
            ('offers', 'Offers', 'Festive deals', 'Offers &', 'savings', {'only_on_sale': True, 'default_sort': 'price_low'}, 3, False),
        ]:
            ListingPage.objects.update_or_create(slug=slug, defaults={
                'menu_label': label, 'eyebrow': eyebrow, 'title': title, 'italic_title': italic,
                'subtitle': 'Thoughtfully curated appliances — every price in ₹, inclusive of GST, with delivery across India.',
                'menu_order': order, 'has_mega_menu': mega, 'show_in_header': True, **extra})
        about_page = Page.objects.get(slug='about')
        about_page.show_in_header = True
        about_page.menu_label = 'Our story'
        about_page.menu_order = 4
        about_page.save()
        self.stdout.write('✓ Listing pages (Collections, New arrivals, Offers) + Our story in menu')

        sections = [
            ('hero', '', '', '', '', '', ''),
            ('highlights', '', '', '', '', '', ''),
            ('categories', 'So many ways to cook', 'Find your', 'kind of kitchen.', '', 'Shop all collections', '/shop'),
            ('featured', 'The curated edit', 'Selected with care.', 'Loved by you.', '', 'Explore the edit', '/shop'),
            ('promo_banners', '', '', '', '', '', ''),
            ('new_arrivals', 'Just landed', 'A fresh chapter.', 'For your kitchen.', '', 'See all new arrivals', '/new-arrivals'),
            ('ai_cta', '', '', '', '', '', ''),
            ('stats', '', '', '', '', '', ''),
            ('bestsellers', 'Most loved', 'Bestsellers', 'across India.', '', 'Shop bestsellers', '/shop?sort=popular'),
            ('testimonials', 'From Indian kitchens', 'Loved in', 'homes like yours.', '', '', ''),
            ('brand_statement', 'The heart of Rasoi', 'More than a kitchen.', 'A little expression of you.', '', 'Discover our story', '/about'),
        ]
        for i, (key, eyebrow, title, italic, sub, btn, link) in enumerate(sections):
            HomeSection.objects.update_or_create(key=key, defaults={
                'eyebrow': eyebrow, 'title': title, 'italic_title': italic, 'subtitle': sub,
                'button_text': btn, 'button_link': link, 'order': i,
                'product_limit': 4 if key == 'bestsellers' else 8})
        HomeSection.objects.get_or_create(key='offers', defaults={
            'eyebrow': 'Festive deals', 'title': 'Offers', 'italic_title': 'worth celebrating.',
            'button_text': 'See all offers', 'button_link': '/offers', 'order': 8, 'is_active': False})
        self.stdout.write('✓ Home page sections')

        for i, (name, slug, desc, prompt, default) in enumerate([
            ('Smart Assistant (Auto)', 'smart', 'Helps with anything — products, orders, delivery',
             'You are Rasoi AI, a warm, knowledgeable assistant for an Indian kitchen-appliance store. '
             'Help customers choose appliances, compare options, and answer questions about orders, delivery, '
             'payments and warranty.', True),
            ('Appliance Expert', 'expert', 'Compares models and specs for your cooking style',
             'You are a kitchen-appliance expert for Indian homes. Compare wattage, capacity, jars, motor and '
             'features, and match them to Indian cooking (idli/dosa batter, masalas, tadka, rotis, chai).', False),
            ('Order Help', 'orders', 'Track orders, payments, returns',
             'You are a polite customer-care agent. Help with order status, payments (UPI, cards, COD), delivery '
             'and returns using only the order data provided.', False),
            ('Recipe & Gifting Guide', 'gifting', 'Gift ideas and recipes for your new appliance',
             'You are a cheerful guide who suggests appliances as gifts for Diwali, weddings and housewarmings in India, '
             'and shares quick Indian recipe ideas for the recommended appliance.', False),
        ]):
            AIAssistant.objects.update_or_create(slug=slug, defaults={
                'name': name, 'description': desc, 'system_prompt': prompt, 'is_default': default, 'order': i})
        self.stdout.write('✓ AI assistants')

        self.stdout.write(self.style.SUCCESS('\nSample data loaded. Open /admin to add images and edit content.'))
