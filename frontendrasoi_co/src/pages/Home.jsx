import useApi from '../hooks/useApi';
import useSeo from '../hooks/useSeo';
import { useSite } from '../context/SiteContext';
import Hero from '../components/home/Hero';
import {
  AICta,
  BrandStatement,
  CategoryGrid,
  HighlightsRow,
  PromoBanners,
  SectionHead,
  StatsBand,
  Testimonials,
} from '../components/home/HomeSections';
import ProductGrid from '../components/product/ProductGrid';
import { Spinner } from '../components/ui/Primitives';

/* Used only until "Home page sections" are added in Django admin */
const DEFAULT_SECTIONS = [
  'hero', 'highlights', 'categories', 'featured', 'promo_banners', 'new_arrivals',
  'ai_cta', 'stats', 'bestsellers', 'testimonials', 'brand_statement',
].map((key) => ({ key }));

const PRODUCT_DEFAULTS = {
  featured: { eyebrow: 'The curated edit', title: 'Selected with care.', italic_title: 'Loved by you.', button_text: 'Explore the edit', button_link: '/shop' },
  new_arrivals: { eyebrow: 'Just landed', title: 'A fresh chapter.', italic_title: 'For your kitchen.', button_text: 'See all new arrivals', button_link: '/new-arrivals' },
  bestsellers: { eyebrow: 'Most loved', title: 'Bestsellers', italic_title: 'across India.', button_text: 'Shop bestsellers', button_link: '/shop?sort=popular' },
  offers: { eyebrow: 'Festive deals', title: 'Offers', italic_title: 'worth celebrating.', button_text: 'See all offers', button_link: '/offers' },
};

export default function Home() {
  useSeo();
  const { settings } = useSite();
  const { data, loading, error, reload } = useApi('/home/');

  if (error) {
    return (
      <div className="container section center-text">
        <h2>We couldn't load the store</h2>
        <p>Make sure the Django backend is running at <code>{import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000/api'}</code>.</p>
        <button className="btn btn-primary" onClick={reload}>Try again</button>
      </div>
    );
  }
  if (loading && !data) return <div className="page-loading"><Spinner /></div>;

  const d = data || {};
  const sections = d.sections?.length ? d.sections : DEFAULT_SECTIONS;

  const productSection = (s, products, tinted = false) => {
    if (!products?.length) return null;
    return (
      <section key={s.key} className={`section ${tinted ? 'section-tint' : ''}`}>
        <div className="container">
          <SectionHead section={s} fallback={PRODUCT_DEFAULTS[s.key]} />
          <ProductGrid products={products} />
        </div>
      </section>
    );
  };

  const render = (s) => {
    switch (s.key) {
      case 'hero':
        return <Hero key="hero" slides={d.hero_slides || []} />;
      case 'highlights':
        return <HighlightsRow key="hl" items={d.highlights || []} />;
      case 'categories':
        return <CategoryGrid key="cat" categories={d.categories || []} section={s} />;
      case 'featured':
        return productSection(s, d.featured, true);
      case 'new_arrivals':
        return productSection(s, d.new_arrivals);
      case 'bestsellers':
        return productSection(s, d.bestsellers);
      case 'offers':
        return productSection(s, d.offers, true);
      case 'promo_banners':
        return (
          <div key="promo" className="section-sm">
            <PromoBanners banners={d.banners || []} />
          </div>
        );
      case 'ai_cta':
        return settings?.ai_enabled === false ? null : (
          <AICta key="ai" banner={d.ai_banner} assistantName={settings?.ai_assistant_name} />
        );
      case 'stats':
        return <StatsBand key="stats" products={d.stats?.products} categories={d.stats?.categories} brands={d.stats?.brands} />;
      case 'testimonials':
        return <Testimonials key="t" items={d.testimonials || []} section={s} />;
      case 'brand_statement':
        return <BrandStatement key="bs" section={s} />;
      default:
        return null;
    }
  };

  return <>{sections.map(render)}</>;
}
