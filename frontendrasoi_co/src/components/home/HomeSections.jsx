import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import Icon from '../ui/Icon';
import { AnimatedCounter, SectionHeading, SmartImage, Stars } from '../ui/Primitives';
import { Reveal, Stagger, StaggerItem } from '../ui/Reveal';

/* Trust points under the hero */
export function HighlightsRow({ items = [] }) {
  if (!items.length) return null;
  return (
    <Stagger className="container highlights-row">
      {items.map((h) => (
        <StaggerItem key={h.id} className="highlight">
          <span className="highlight-icon"><Icon name={h.icon} size={18} /></span>
          <div>
            <strong>{h.title}</strong>
            <small>{h.subtitle}</small>
          </div>
        </StaggerItem>
      ))}
    </Stagger>
  );
}

/* Animated store stats — real numbers from the API */
export function StatsBand({ products = 0, categories = 0, brands = 0 }) {
  if (!products) return null;
  return (
    <Reveal className="container stats-band">
      <div><strong><AnimatedCounter to={products} suffix="+" /></strong><span>Appliances in store</span></div>
      <div><strong><AnimatedCounter to={categories} /></strong><span>Kitchen categories</span></div>
      <div><strong><AnimatedCounter to={brands} /></strong><span>Trusted brands</span></div>
      <div><strong>₹</strong><span>Prices inclusive of GST</span></div>
    </Reveal>
  );
}

/* "Find your kind of kitchen" category grid */
export function SectionHead({ section, fallback = {} }) {
  const s = { ...fallback, ...Object.fromEntries(Object.entries(section || {}).filter(([, v]) => v)) };
  return (
    <SectionHeading
      eyebrow={s.eyebrow}
      title={s.title}
      italic={s.italic_title}
      subtitle={s.subtitle}
      align={s.align}
      action={
        s.button_text ? (
          <Link to={s.button_link || '/shop'} className="btn btn-ghost">
            {s.button_text} <Icon name="arrowUpRight" size={14} />
          </Link>
        ) : null
      }
    />
  );
}

export function CategoryGrid({ categories = [], section }) {
  if (!categories.length) return null;
  return (
    <section className="section container">
      <SectionHead
        section={section}
        fallback={{ eyebrow: 'So many ways to cook', title: 'Find your', italic_title: 'kind of kitchen.', button_text: 'Shop all collections', button_link: '/shop' }}
      />
      <Stagger className="category-grid" stagger={0.05}>
        {categories.map((c) => (
          <StaggerItem key={c.slug}>
            <Link to={`/category/${c.slug}`} className="category-card">
              <div className="category-media">
                <SmartImage src={c.image} alt={c.name} width={400} sizes="(max-width: 768px) 33vw, 16vw" />
                <span className="category-arrow"><Icon name="arrowUpRight" size={14} /></span>
              </div>
              <span className="category-name">{c.name}</span>
              {c.product_count > 0 && <small className="category-count">{c.product_count} products</small>}
            </Link>
          </StaggerItem>
        ))}
      </Stagger>
    </section>
  );
}

/* Two side-by-side promo banners */
export function PromoBanners({ banners = [] }) {
  if (!banners.length) return null;
  return (
    <section className="container promo-grid">
      {banners.slice(0, 2).map((b, i) => (
        <Reveal key={b.id} delay={i * 0.1}>
          <Link to={b.link} className="promo-card" style={{ background: b.background_color, color: b.text_color }}>
            <div className="promo-copy">
              {b.eyebrow && <span className="eyebrow">{b.eyebrow}</span>}
              <h3>
                {b.title} {b.italic_text && <em>{b.italic_text}</em>}
              </h3>
              {b.subtitle && <p>{b.subtitle}</p>}
              <span className="promo-link">{b.button_text} <Icon name="arrowRight" size={14} /></span>
            </div>
            <div className="promo-media">
              <SmartImage src={b.image} alt={b.title} width={500} sizes="(max-width: 768px) 40vw, 20vw" />
            </div>
          </Link>
        </Reveal>
      ))}
    </section>
  );
}

/* "Ask our kitchen expert" AI call-to-action */
export function AICta({ banner, assistantName = 'Rasoi AI' }) {
  const b = banner || {
    eyebrow: 'MEET YOUR KITCHEN EXPERT',
    title: 'Planning a new kitchen?',
    italic_text: "Let's find your fit.",
    subtitle: 'Tell us what you cook, your family size and budget in ₹ — get instant picks.',
    button_text: 'Ask our expert',
    background_color: '#F1E7DC',
  };
  const open = () => window.dispatchEvent(new Event('open-ask-ai'));
  return (
    <Reveal className="container">
      <div className="ai-cta" style={{ background: b.background_color }}>
        <div className="ai-cta-orb" aria-hidden="true">
          <motion.span animate={{ rotate: 360 }} transition={{ duration: 18, repeat: Infinity, ease: 'linear' }} className="orb-ring" />
          <Icon name="spark" size={34} />
          <small>{assistantName}</small>
        </div>
        <div className="ai-cta-copy">
          <span className="eyebrow">{b.eyebrow}</span>
          <h3>
            {b.title} <em>{b.italic_text}</em>
          </h3>
          <p>{b.subtitle}</p>
          <div className="ai-cta-actions">
            <button className="btn btn-primary" onClick={open}>
              {b.button_text} <Icon name="spark" size={14} />
            </button>
            <Link to="/shop" className="btn btn-ghost">Browse on my own <Icon name="arrowRight" size={14} /></Link>
          </div>
        </div>
      </div>
    </Reveal>
  );
}

/* Testimonials */
export function Testimonials({ items = [], section }) {
  if (!items.length) return null;
  return (
    <section className="section container">
      <SectionHead section={section} fallback={{ eyebrow: 'From Indian kitchens', title: 'Loved in', italic_title: 'homes like yours.', align: 'center' }} />
      <Stagger className="testimonial-grid">
        {items.map((t) => (
          <StaggerItem key={t.id} className="testimonial">
            <Stars value={t.rating} size={14} />
            <blockquote>“{t.quote}”</blockquote>
            <div className="testimonial-who">
              {t.avatar ? <img src={t.avatar} alt="" loading="lazy" /> : <span className="avatar-initial">{t.name?.[0]}</span>}
              <div>
                <strong>{t.name}</strong>
                <small>{[t.city, t.product_name].filter(Boolean).join(' · ')}</small>
              </div>
            </div>
          </StaggerItem>
        ))}
      </Stagger>
    </section>
  );
}

/* Closing statement */
export function BrandStatement({ section }) {
  const s = section || {};
  return (
    <Reveal className="container brand-statement">
      <span className="eyebrow">{s.eyebrow || 'The heart of Rasoi'}</span>
      <h2>
        {s.title || 'More than a kitchen.'}
        <br />
        <em>{s.italic_title || 'A little expression of you.'}</em>
      </h2>
      {s.subtitle && <p>{s.subtitle}</p>}
      <Link to={s.button_link || '/about'} className="btn btn-ghost">
        {s.button_text || 'Discover our story'} <Icon name="arrowRight" size={14} />
      </Link>
    </Reveal>
  );
}
