import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import useApi from '../hooks/useApi';
import useSeo from '../hooks/useSeo';
import { useCart } from '../context/CartContext';
import { useWishlist } from '../context/WishlistContext';
import { useSite } from '../context/SiteContext';
import ProductGallery from '../components/product/ProductGallery';
import PincodeChecker from '../components/product/PincodeChecker';
import Reviews from '../components/product/Reviews';
import ProductGrid from '../components/product/ProductGrid';
import Accordion from '../components/ui/Accordion';
import Icon from '../components/ui/Icon';
import { Breadcrumbs, EmptyState, Price, QuantityStepper, SectionHeading, Spinner, Stars } from '../components/ui/Primitives';
import { formatPrice } from '../utils/formatPrice';

export default function ProductDetail() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { settings } = useSite();
  const { addItem } = useCart();
  const { has, toggle } = useWishlist();
  const { data: p, loading, error } = useApi(`/products/${slug}/`);
  const { data: related } = useApi(`/products/${slug}/related/`);
  const [variantId, setVariantId] = useState(null);
  const [qty, setQty] = useState(1);
  const [busy, setBusy] = useState(false);
  const imgRef = useRef(null);
  const ctaRef = useRef(null);
  const [showSticky, setShowSticky] = useState(false);

  useSeo(p?.meta_title || p?.name, p?.meta_description || p?.short_description);

  useEffect(() => {
    setVariantId(p?.variants?.[0]?.id ?? null);
    setQty(1);
  }, [p]);

  useEffect(() => {
    if (!ctaRef.current) return undefined;
    const io = new IntersectionObserver(([e]) => setShowSticky(!e.isIntersecting), { threshold: 0 });
    io.observe(ctaRef.current);
    return () => io.disconnect();
  }, [p]);

  const variant = useMemo(() => p?.variants?.find((v) => v.id === variantId) || null, [p, variantId]);

  if (loading) return <div className="page-loading"><Spinner /></div>;
  if (error || !p) {
    return (
      <div className="container section">
        <EmptyState icon="search" title="Product not found" text="It may have been removed or renamed." action={<Link to="/shop" className="btn btn-primary">Back to shop</Link>} />
      </div>
    );
  }

  const price = variant ? Number(variant.price) : Number(p.sale_price);
  const mrp = variant ? Number(variant.effective_mrp) : Number(p.mrp);
  const stock = variant ? variant.stock : p.stock;
  const inStock = stock > 0;
  const wished = has(p.slug);
  const colours = [...new Map((p.variants || []).filter((v) => v.colour).map((v) => [v.colour, v])).values()];
  const threshold = Number(settings?.free_shipping_threshold || 1999);

  const add = async (buyNow = false) => {
    setBusy(true);
    const ok = await addItem(p, { variant, quantity: qty, sourceEl: buyNow ? null : imgRef.current, openDrawer: !buyNow });
    setBusy(false);
    if (ok && buyNow) navigate('/checkout');
  };

  const accordion = [
    { title: 'Description', content: p.description || `<p>${p.short_description}</p>` },
    {
      title: 'Specifications',
      content: `<table class="spec-table"><tbody>${p.specifications
        .map((s) => `<tr><th>${s.label}</th><td>${s.value}</td></tr>`)
        .join('')}</tbody></table>`,
    },
    {
      title: 'Delivery, returns & warranty',
      content: `<ul><li>Free shipping on orders over ${formatPrice(threshold)} · delivery across India.</li><li>7-day replacement for damaged or defective items.</li><li>${p.warranty || '2 years'} warranty — keep your GST invoice as proof.</li>${p.cod_available ? '<li>Cash on Delivery available on eligible PIN codes.</li>' : ''}</ul>`,
    },
  ];

  return (
    <div className="pdp">
      <div className="container">
        <Breadcrumbs
          items={[
            { label: 'Home', to: '/' },
            { label: p.category.name, to: `/category/${p.category.slug}` },
            { label: p.name },
          ]}
        />

        <div className="pdp-grid">
          <ProductGallery images={p.images} name={p.name} model3d={p.model_3d} imgRef={imgRef} />

          <motion.div className="pdp-info" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.6 }}>
            <span className="eyebrow">
              {p.category.name}
              {p.brand ? ` · ${p.brand.name}` : ''}
            </span>
            <h1 className="pdp-title">{p.name}</h1>
            {p.review_count > 0 && (
              <a href="#reviews" className="pdp-rating">
                <Stars value={p.rating_avg} size={15} /> <span>{p.rating_avg} · {p.review_count} reviews</span>
              </a>
            )}
            {(p.badge_text || p.tag_label) && <span className="pdp-tag">{p.badge_text || p.tag_label}</span>}

            <Price price={price} mrp={mrp} size="lg" showTax />
            {p.short_description && <p className="pdp-short">{p.short_description}</p>}

            {colours.length > 0 && (
              <div className="option-group">
                <span className="label">Colour: <strong>{variant?.colour}</strong></span>
                <div className="swatches">
                  {colours.map((c) => (
                    <button
                      key={c.colour}
                      className={`swatch ${variant?.colour === c.colour ? 'active' : ''}`}
                      style={{ background: c.colour_hex || 'var(--color-tint)' }}
                      onClick={() => {
                        const match = p.variants.find((v) => v.colour === c.colour && v.capacity === variant?.capacity) || c;
                        setVariantId(match.id);
                      }}
                      aria-label={c.colour}
                      title={c.colour}
                    />
                  ))}
                </div>
              </div>
            )}

            {p.variants?.length > 0 && (
              <div className="option-group">
                <span className="label">Choose your option</span>
                <div className="variant-grid">
                  {p.variants.map((v) => (
                    <button
                      key={v.id}
                      className={`variant-btn ${v.id === variantId ? 'active' : ''}`}
                      onClick={() => setVariantId(v.id)}
                      disabled={!v.in_stock}
                    >
                      <span>{v.capacity || v.colour || v.label}</span>
                      <small>{formatPrice(v.price)}</small>
                      {!v.in_stock && <em>Sold out</em>}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="option-group">
              <span className="label">Quantity</span>
              <QuantityStepper value={qty} onChange={setQty} max={Math.max(1, Math.min(10, stock))} />
              {inStock && stock <= 5 && <span className="low-stock">Only {stock} left — order soon</span>}
            </div>

            <div className="pdp-actions" ref={ctaRef}>
              <button className="btn btn-primary btn-lg" disabled={!inStock || busy} onClick={() => add(false)}>
                <Icon name="bag" size={17} /> {inStock ? 'Add to bag' : 'Out of stock'}
              </button>
              <button className="btn btn-accent btn-lg" disabled={!inStock || busy} onClick={() => add(true)}>
                Buy now <Icon name="arrowRight" size={16} />
              </button>
              <motion.button
                className={`icon-btn wish-big ${wished ? 'is-on' : ''}`}
                onClick={() => toggle(p)}
                whileTap={{ scale: 1.3 }}
                aria-label={wished ? 'Remove from wishlist' : 'Save to wishlist'}
                aria-pressed={wished}
              >
                <Icon name="heart" size={20} fill={wished ? 'currentColor' : 'none'} />
              </motion.button>
            </div>

            <PincodeChecker />

            <ul className="pdp-perks">
              <li><Icon name="warranty" size={16} /> {p.warranty || '2 years'} warranty</li>
              <li><Icon name="return" size={16} /> 7-day replacement</li>
              <li><Icon name="shield" size={16} /> Secure UPI / Card payments</li>
              {p.cod_available && <li><Icon name="rupee" size={16} /> Cash on Delivery</li>}
            </ul>

            <Accordion items={accordion} html />
            {p.hsn_code && <p className="tax-note">HSN {p.hsn_code} · GST {Number(p.gst_rate)}% included ({formatPrice(p.gst_amount, { paise: true })})</p>}
          </motion.div>
        </div>

        <Reviews product={p} />

        {related?.length > 0 && (
          <section className="section">
            <SectionHeading eyebrow="You may also like" title="Complete" italic="your kitchen." />
            <ProductGrid products={related.slice(0, 4)} />
          </section>
        )}
      </div>

      {/* Sticky add-to-bag bar on mobile */}
      <motion.div
        className="sticky-buy"
        initial={false}
        animate={{ y: showSticky ? 0 : 120 }}
        transition={{ type: 'tween', duration: 0.3 }}
        aria-hidden={!showSticky}
      >
        <div>
          <strong>{formatPrice(price)}</strong>
          {mrp > price && <small className="price-mrp">{formatPrice(mrp)}</small>}
        </div>
        <button className="btn btn-primary" disabled={!inStock || busy} onClick={() => add(false)} tabIndex={showSticky ? 0 : -1}>
          <Icon name="bag" size={16} /> Add to bag
        </button>
      </motion.div>
    </div>
  );
}
