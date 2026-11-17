import { useEffect, useMemo, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import api from '../api/axios';
import useApi from '../hooks/useApi';
import useSeo from '../hooks/useSeo';
import FilterPanel, { SORTS } from '../components/shop/FilterPanel';
import ProductGrid from '../components/product/ProductGrid';
import Icon from '../components/ui/Icon';
import { Breadcrumbs, EmptyState, Pagination, SmartImage } from '../components/ui/Primitives';
import { Reveal } from '../components/ui/Reveal';

const FILTER_KEYS = ['q', 'category', 'brand', 'capacity', 'colour', 'min_price', 'max_price', 'in_stock', 'on_sale', 'sort', 'is_featured', 'tag'];

const DEFAULT_LISTING = {
  eyebrow: 'The Rasoi collection',
  title: 'Discover your',
  italic_title: 'next favourite',
  subtitle: 'Thoughtfully curated appliances — every price in ₹, inclusive of GST, with delivery across India.',
  default_sort: 'newest',
};

/**
 * mode="listing"  → admin-created Listing page (Collections, New arrivals, Offers, Diwali deals …)
 * mode="category" → /category/:slug
 * mode="search"   → /search?q=
 */
export default function Shop({ mode = 'listing', listingSlug }) {
  const params0 = useParams();
  const slug = mode === 'category' ? params0.slug : listingSlug;
  const [params, setParams] = useSearchParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [facets, setFacets] = useState(null);
  const [drawer, setDrawer] = useState(false);
  const { data: categories } = useApi('/categories/');
  const { data: category } = useApi(mode === 'category' && slug ? `/categories/${slug}/` : null);
  const { data: listingData } = useApi(mode === 'listing' && slug ? `/listing-pages/${slug}/` : null);
  const listing = mode === 'listing' ? listingData || DEFAULT_LISTING : null;

  const paramString = params.toString();
  const values = useMemo(() => {
    const v = {};
    FILTER_KEYS.forEach((k) => {
      if (params.get(k)) v[k] = params.get(k);
    });
    return v;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paramString]);
  const page = Number(params.get('page') || 1);
  const defaultSort = listing?.default_sort || 'newest';

  const header =
    mode === 'category'
      ? { eyebrow: category?.menu_group || 'Collection', title: category?.name || '', italic_title: '', subtitle: category?.description }
      : mode === 'search'
        ? { eyebrow: 'Search results', title: 'You searched for', italic_title: `“${values.q || ''}”`, subtitle: '' }
        : listing;

  useSeo(header ? `${header.title} ${header.italic_title || ''}`.trim() : 'Shop', listing?.meta_description || category?.description);

  // Products
  useEffect(() => {
    const query = { sort: defaultSort, ...values, page };
    if (query.q) {
      query.search = query.q;
      delete query.q;
    }
    if (mode === 'category' && slug) query.category = slug;
    if (mode === 'listing' && slug) query.listing = slug;
    let alive = true;
    setLoading(true);
    api
      .get('/products/', { params: query })
      .then(({ data: res }) => alive && setData(res))
      .catch(() => alive && setData({ results: [], count: 0, total_pages: 0 }))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paramString, mode, slug, defaultSort]);

  // Filter options
  const facetCategory = mode === 'category' ? slug : values.category;
  useEffect(() => {
    const q = {};
    if (facetCategory) q.category = facetCategory;
    if (mode === 'listing' && slug) q.listing = slug;
    api.get('/products/facets/', { params: q }).then(({ data: f }) => setFacets(f)).catch(() => {});
  }, [facetCategory, mode, slug]);

  const apply = (next) => {
    const p = new URLSearchParams();
    Object.entries(next).forEach(([k, v]) => v && p.set(k, v));
    setParams(p);
    setDrawer(false);
  };
  const clear = () => {
    setParams(new URLSearchParams());
    setDrawer(false);
  };
  const goPage = (n) => {
    const p = new URLSearchParams(params);
    p.set('page', String(n));
    setParams(p);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const activeChips = Object.entries(values).filter(([k]) => !['sort', 'q'].includes(k));
  const panelValues = { sort: defaultSort, ...values };

  return (
    <div className="shop-page">
      <section className={`shop-hero ${listing?.banner_image ? 'has-banner' : ''}`}>
        {listing?.banner_image && (
          <div className="shop-banner" aria-hidden="true">
            <SmartImage src={listing.banner_image} alt="" width={1600} sizes="100vw" eager />
          </div>
        )}
        <div className="container shop-hero-inner">
          <Breadcrumbs
            items={[
              { label: 'Home', to: '/' },
              ...(mode === 'category' ? [{ label: 'Shop', to: '/shop' }, { label: category?.name || '…' }] : []),
              ...(mode === 'search' ? [{ label: 'Search' }] : []),
              ...(mode === 'listing' ? [{ label: listing?.menu_label || 'Shop' }] : []),
            ]}
          />
          {header && (
            <Reveal key={`${mode}-${slug}`}>
              {header.eyebrow && <span className="eyebrow">{header.eyebrow}</span>}
              <h1 className="shop-title">
                {header.title} {header.italic_title && <em>{header.italic_title}</em>}
              </h1>
              {header.subtitle && <p className="shop-sub">{header.subtitle}</p>}
            </Reveal>
          )}
        </div>
      </section>

      <div className="container shop-layout">
        <aside className="shop-sidebar">
          <FilterPanel values={panelValues} facets={facets} categories={categories || []} onApply={apply} onClear={clear} lockCategory={mode === 'category'} />
        </aside>

        <div className="shop-results">
          <div className="shop-toolbar">
            <button className="btn btn-outline mobile-filter-btn" onClick={() => setDrawer(true)}>
              <Icon name="filter" size={15} /> Filters {activeChips.length > 0 && <span className="badge-count badge-inline">{activeChips.length}</span>}
            </button>
            <p className="result-count">
              {loading ? 'Loading…' : `${data?.count ?? 0} ${data?.count === 1 ? 'product' : 'products'}`}
            </p>
            <label className="sort-inline">
              <span className="sr-only">Sort by</span>
              <select className="select" value={values.sort || defaultSort} onChange={(e) => apply({ ...values, sort: e.target.value })}>
                {SORTS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </label>
          </div>

          {activeChips.length > 0 && (
            <div className="active-filters">
              {activeChips.map(([k, v]) => (
                <button key={k} className="chip chip-active" onClick={() => apply({ ...values, [k]: '' })}>
                  {k.replace('_', ' ')}: {v === 'true' ? 'yes' : v} <Icon name="close" size={12} />
                </button>
              ))}
              <button className="chip" onClick={clear}>Clear all</button>
            </div>
          )}

          {!loading && data?.results?.length === 0 ? (
            <EmptyState
              icon="search"
              title="No appliances match these filters"
              text="Try removing a filter or widening the price range."
              action={<button className="btn btn-primary" onClick={clear}>Clear filters</button>}
            />
          ) : (
            <ProductGrid products={data?.results} loading={loading} skeletonCount={9} className="product-grid-3" />
          )}

          <Pagination page={data?.current_page || page} totalPages={data?.total_pages} onChange={goPage} />
        </div>
      </div>

      <AnimatePresence>
        {drawer && (
          <>
            <motion.div className="overlay" onClick={() => setDrawer(false)} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} />
            <motion.div
              className="filter-sheet"
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'tween', duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
              role="dialog"
              aria-label="Filters"
            >
              <div className="sheet-handle" />
              <button className="icon-btn sheet-close" onClick={() => setDrawer(false)} aria-label="Close filters">
                <Icon name="close" size={20} />
              </button>
              <FilterPanel values={panelValues} facets={facets} categories={categories || []} onApply={apply} onClear={clear} lockCategory={mode === 'category'} />
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
