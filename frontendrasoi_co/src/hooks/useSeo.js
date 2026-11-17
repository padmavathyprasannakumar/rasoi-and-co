import { useEffect } from 'react';
import { useSite } from '../context/SiteContext';

/** Sets <title> and meta description for each page (SEO). */
export default function useSeo(title, description) {
  const { settings } = useSite() || {};
  useEffect(() => {
    const store = settings?.store_name || 'Rasoi & Co.';
    document.title = title ? `${title} · ${store}` : settings?.meta_title || `${store} — Smart kitchens, beautifully made`;
    const desc = description || settings?.meta_description;
    if (desc) {
      let tag = document.querySelector('meta[name="description"]');
      if (!tag) {
        tag = document.createElement('meta');
        tag.name = 'description';
        document.head.appendChild(tag);
      }
      tag.content = desc;
    }
  }, [title, description, settings]);
}
