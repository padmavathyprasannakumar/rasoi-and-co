import { useParams } from 'react-router-dom';
import useApi from '../hooks/useApi';
import Shop from './Shop';
import { ContentPage, NotFound } from './InfoPages';
import { Spinner } from '../components/ui/Primitives';

/**
 * Any page created in Django admin opens at /<slug>:
 *  - Listing pages (Collections /shop, New arrivals, Offers, Diwali deals …) → product grid with filters
 *  - Pages (Our story /about, Shipping & returns, Warranty …)               → content page
 */
export default function DynamicPage() {
  const { slug } = useParams();
  const { data, loading, error } = useApi(`/resolve/${slug}/`);

  if (loading) return <div className="page-loading"><Spinner /></div>;
  if (data?.type === 'listing') return <Shop key={slug} mode="listing" listingSlug={slug} />;
  if (data?.type === 'page') return <ContentPage key={slug} slug={slug} />;
  // Keep /shop working even before a "shop" listing page exists in admin
  if (slug === 'shop' && error) return <Shop mode="listing" />;
  return <NotFound />;
}
