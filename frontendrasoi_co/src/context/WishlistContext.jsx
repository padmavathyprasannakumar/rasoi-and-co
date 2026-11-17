import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import api from '../api/axios';
import { useAuth } from './AuthContext';
import { useToast } from './ToastContext';

const WishlistContext = createContext(null);
const GUEST_KEY = 'rasoi_guest_wishlist';

const readGuest = () => {
  try {
    return JSON.parse(localStorage.getItem(GUEST_KEY)) || [];
  } catch {
    return [];
  }
};

export function WishlistProvider({ children }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [slugs, setSlugs] = useState(() => readGuest());

  const load = useCallback(async () => {
    if (!user) {
      setSlugs(readGuest());
      return;
    }
    try {
      // merge guest hearts into the account
      const guest = readGuest();
      const { data } = await api.get('/wishlist/');
      const server = data.map((w) => w.product.slug);
      const missing = guest.filter((s) => !server.includes(s));
      for (const slug of missing) {
        try {
          await api.post('/wishlist/', { product_slug: slug });
          server.push(slug);
        } catch {
          /* product may be inactive */
        }
      }
      localStorage.removeItem(GUEST_KEY);
      setSlugs(server);
    } catch {
      /* ignore */
    }
  }, [user]);

  useEffect(() => {
    load();
  }, [load]);

  const has = (slug) => slugs.includes(slug);

  const toggle = async (product) => {
    const slug = product.slug;
    if (user) {
      try {
        const { data } = await api.post('/wishlist/toggle/', { product_slug: slug });
        setSlugs(data.slugs);
        toast(data.added ? 'Saved to wishlist ♥' : 'Removed from wishlist', data.added ? 'success' : 'info');
      } catch {
        toast('Could not update wishlist', 'error');
      }
    } else {
      const next = has(slug) ? slugs.filter((s) => s !== slug) : [...slugs, slug];
      localStorage.setItem(GUEST_KEY, JSON.stringify(next));
      setSlugs(next);
      toast(next.includes(slug) ? 'Saved — sign in to keep it on all devices ♥' : 'Removed from wishlist', 'info');
    }
  };

  return (
    <WishlistContext.Provider value={{ slugs, count: slugs.length, has, toggle, reload: load }}>
      {children}
    </WishlistContext.Provider>
  );
}

export const useWishlist = () => useContext(WishlistContext);
