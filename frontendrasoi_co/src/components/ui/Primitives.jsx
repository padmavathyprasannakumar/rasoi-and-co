import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { animate, useInView } from 'framer-motion';
import Icon from './Icon';
import { discountPercent, formatPrice } from '../../utils/formatPrice';
import { cldSrcSet, cldUrl } from '../../utils/image';

/* ------------------------------------------------------------------ */
/* Section heading: eyebrow + serif title with copper italic accent    */
/* ------------------------------------------------------------------ */
export function SectionHeading({ eyebrow, title, italic, subtitle, action, align = 'left' }) {
  return (
    <div className={`section-head ${align === 'center' ? 'section-head-center' : ''}`}>
      <div>
        {eyebrow && <span className="eyebrow">{eyebrow}</span>}
        <h2 className="section-title">
          {title} {italic && <em>{italic}</em>}
        </h2>
        {subtitle && <p className="section-subtitle">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Price: ₹ sale price, struck-through MRP, % off, GST note            */
/* ------------------------------------------------------------------ */
export function Price({ price, mrp, size = 'md', showTax = false }) {
  const off = discountPercent(mrp, price);
  return (
    <div className={`price-block price-${size}`}>
      <div className="price-row">
        <span className="price">{formatPrice(price)}</span>
        {off > 0 && <span className="price-mrp">MRP {formatPrice(mrp)}</span>}
        {off > 0 && <span className="price-off">{off}% off</span>}
      </div>
      {showTax && <p className="tax-note">Inclusive of all taxes (GST)</p>}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Star rating                                                         */
/* ------------------------------------------------------------------ */
export function Stars({ value = 0, count, size = 14 }) {
  const rounded = Math.round(value * 2) / 2;
  return (
    <span className="stars" aria-label={`${value || 0} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Icon key={i} name="star" size={size} fill={i <= rounded ? 'currentColor' : 'none'} className={i <= rounded ? 'star-on' : 'star-off'} />
      ))}
      {count !== undefined && <span className="stars-count">({count})</span>}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Product image with Cloudinary srcset + elegant placeholder           */
/* ------------------------------------------------------------------ */
export function SmartImage({ src, alt, width = 600, className = '', sizes = '(max-width: 768px) 50vw, 25vw', eager = false, imgRef }) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) {
    return (
      <div className={`img-placeholder ${className}`} role="img" aria-label={alt}>
        <svg viewBox="0 0 120 120" width="42%" aria-hidden="true">
          <defs>
            <linearGradient id="cu" x1="0" x2="1" y1="0" y2="1">
              <stop offset="0" stopColor="#D9A273" />
              <stop offset="1" stopColor="#9A5E28" />
            </linearGradient>
          </defs>
          <path d="M30 52h60l-6 44a8 8 0 0 1-8 7H44a8 8 0 0 1-8-7l-6-44Z" fill="url(#cu)" opacity=".9" />
          <path d="M26 52h68" stroke="#1F2326" strokeWidth="4" strokeLinecap="round" />
          <path d="M50 44c0-8 20-8 20 0" stroke="#1F2326" strokeWidth="4" fill="none" strokeLinecap="round" />
          <path d="M48 30c-3-5 3-8 0-13M60 30c-3-5 3-8 0-13M72 30c-3-5 3-8 0-13" stroke="#7A8B6F" strokeWidth="3" fill="none" strokeLinecap="round" className="steam-line" />
        </svg>
        <span>{alt}</span>
      </div>
    );
  }
  return (
    <img
      ref={imgRef}
      src={cldUrl(src, width)}
      srcSet={cldSrcSet(src)}
      sizes={sizes}
      alt={alt}
      loading={eager ? 'eager' : 'lazy'}
      decoding="async"
      className={className}
      onError={() => setFailed(true)}
    />
  );
}

/* ------------------------------------------------------------------ */
/* Skeleton loaders                                                    */
/* ------------------------------------------------------------------ */
export function SkeletonCard() {
  return (
    <div className="skeleton-card">
      <div className="skeleton" style={{ aspectRatio: '4 / 5' }} />
      <div className="skeleton" style={{ height: 12, width: '45%', marginTop: 14 }} />
      <div className="skeleton" style={{ height: 18, width: '85%', marginTop: 10 }} />
      <div className="skeleton" style={{ height: 14, width: '55%', marginTop: 10 }} />
    </div>
  );
}

export function SkeletonGrid({ count = 8 }) {
  return (
    <div className="product-grid">
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i} />
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Breadcrumbs                                                         */
/* ------------------------------------------------------------------ */
export function Breadcrumbs({ items }) {
  return (
    <nav className="breadcrumbs" aria-label="Breadcrumb">
      <ol>
        {items.map((item, i) => (
          <li key={i}>
            {item.to && i < items.length - 1 ? <Link to={item.to}>{item.label}</Link> : <span aria-current="page">{item.label}</span>}
            {i < items.length - 1 && <Icon name="chevronRight" size={12} />}
          </li>
        ))}
      </ol>
    </nav>
  );
}

/* ------------------------------------------------------------------ */
/* Pagination                                                          */
/* ------------------------------------------------------------------ */
export function Pagination({ page, totalPages, onChange }) {
  if (!totalPages || totalPages <= 1) return null;
  const pages = [];
  for (let i = 1; i <= totalPages; i++) {
    if (i === 1 || i === totalPages || Math.abs(i - page) <= 1) pages.push(i);
    else if (pages[pages.length - 1] !== '…') pages.push('…');
  }
  return (
    <nav className="pagination" aria-label="Pagination">
      <button className="page-btn" disabled={page <= 1} onClick={() => onChange(page - 1)} aria-label="Previous page">
        <Icon name="chevronLeft" size={16} />
      </button>
      {pages.map((p, i) =>
        p === '…' ? (
          <span key={`e${i}`} className="page-ellipsis">…</span>
        ) : (
          <button key={p} className={`page-btn ${p === page ? 'active' : ''}`} onClick={() => onChange(p)} aria-current={p === page ? 'page' : undefined}>
            {p}
          </button>
        )
      )}
      <button className="page-btn" disabled={page >= totalPages} onClick={() => onChange(page + 1)} aria-label="Next page">
        <Icon name="chevronRight" size={16} />
      </button>
    </nav>
  );
}

/* ------------------------------------------------------------------ */
/* Quantity stepper                                                    */
/* ------------------------------------------------------------------ */
export function QuantityStepper({ value, onChange, min = 1, max = 10, size = 'md' }) {
  return (
    <div className={`qty qty-${size}`}>
      <button type="button" onClick={() => onChange(Math.max(min, value - 1))} disabled={value <= min} aria-label="Decrease quantity">
        <Icon name="minus" size={14} />
      </button>
      <span aria-live="polite">{value}</span>
      <button type="button" onClick={() => onChange(Math.min(max, value + 1))} disabled={value >= max} aria-label="Increase quantity">
        <Icon name="plus" size={14} />
      </button>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Empty state                                                         */
/* ------------------------------------------------------------------ */
export function EmptyState({ icon = 'bag', title, text, action }) {
  return (
    <div className="empty-state">
      <div className="empty-icon">
        <Icon name={icon} size={34} />
      </div>
      <h3>{title}</h3>
      {text && <p>{text}</p>}
      {action}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Animated counter (counts up when visible)                            */
/* ------------------------------------------------------------------ */
export function AnimatedCounter({ to = 0, suffix = '', duration = 1.6 }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true });
  const [value, setValue] = useState(0);
  useEffect(() => {
    if (!inView) return undefined;
    const controls = animate(0, to, {
      duration,
      ease: [0.22, 1, 0.36, 1],
      onUpdate: (v) => setValue(Math.round(v)),
    });
    return () => controls.stop();
  }, [inView, to, duration]);
  return (
    <span ref={ref}>
      {new Intl.NumberFormat('en-IN').format(value)}
      {suffix}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Spinner                                                             */
/* ------------------------------------------------------------------ */
export function Spinner({ label = 'Loading…' }) {
  return (
    <div className="spinner-wrap" role="status">
      <span className="spinner" />
      <span className="sr-only">{label}</span>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Logo (text logo from admin, or uploaded image)                       */
/* ------------------------------------------------------------------ */
export function Logo({ settings, compact = false }) {
  return (
    <Link to="/" className={`logo ${compact ? 'logo-compact' : ''}`} aria-label={`${settings?.store_name || 'Rasoi & Co.'} home`}>
      {settings?.logo ? (
        <img src={settings.logo} alt={settings.store_name} className="logo-img" />
      ) : (
        <>
          <span className="logo-name">
            <span className="logo-spark">✦</span> {settings?.store_name || 'Rasoi & Co.'}
          </span>
          {!compact && <span className="logo-sub">{settings?.logo_subtext || 'KITCHEN APPLIANCES, THOUGHTFULLY CHOSEN'}</span>}
        </>
      )}
    </Link>
  );
}
