import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import api from '../api/axios';
import { useAuth } from './AuthContext';
import { useSite } from './SiteContext';
import { useToast } from './ToastContext';
import { flyToBag } from '../utils/flyToBag';
import { parseApiError } from '../utils/errors';

const CartContext = createContext(null);
const GUEST_KEY = 'rasoi_guest_cart';

const readGuest = () => {
  try {
    return JSON.parse(localStorage.getItem(GUEST_KEY)) || [];
  } catch {
    return [];
  }
};
const writeGuest = (items) => localStorage.setItem(GUEST_KEY, JSON.stringify(items));

function fromServer(item) {
  return {
    key: `s-${item.id}`,
    id: item.id,
    slug: item.product.slug,
    variantId: item.variant?.id ?? null,
    variantLabel: item.variant?.label || '',
    name: item.product.name,
    image: item.product.image,
    category: item.product.category?.name || '',
    unitPrice: Number(item.unit_price),
    unitMrp: Number(item.unit_mrp),
    gstRate: Number(item.product.gst_rate || 0),
    quantity: item.quantity,
    stock: item.variant ? item.variant.stock : item.product.stock,
  };
}

/** Same rules as the Django backend (services.compute_totals), for guest carts. */
function computeGuestTotals(items, settings) {
  const threshold = Number(settings?.free_shipping_threshold ?? 1999);
  const fee = Number(settings?.shipping_fee ?? 99);
  let subtotal = 0;
  let mrpTotal = 0;
  let gst = 0;
  let count = 0;
  items.forEach((i) => {
    const line = i.unitPrice * i.quantity;
    subtotal += line;
    mrpTotal += Math.max(i.unitMrp || i.unitPrice, i.unitPrice) * i.quantity;
    gst += i.gstRate ? (line * i.gstRate) / (100 + i.gstRate) : 0;
    count += i.quantity;
  });
  const shipping = subtotal === 0 || subtotal >= threshold ? 0 : fee;
  return {
    item_count: count,
    subtotal,
    mrp_total: mrpTotal,
    discount: mrpTotal - subtotal,
    shipping_fee: shipping,
    cod_fee: 0,
    gst_amount: gst,
    total: subtotal + shipping,
    free_shipping_threshold: threshold,
    amount_to_free_shipping: Math.max(0, threshold - subtotal),
  };
}

export function CartProvider({ children }) {
  const { user } = useAuth();
  const { settings } = useSite();
  const { toast } = useToast();
  const [items, setItems] = useState(() => readGuest());
  const [serverTotals, setServerTotals] = useState(null);
  const [loading, setLoading] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const mergedFor = useRef(null);

  const applyServer = useCallback((data) => {
    setItems(data.items.map(fromServer));
    setServerTotals(data.totals);
  }, []);

  const refresh = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data } = await api.get('/cart/');
      applyServer(data);
    } finally {
      setLoading(false);
    }
  }, [user, applyServer]);

  // When the user logs in: merge guest bag into their account bag
  useEffect(() => {
    if (!user) {
      mergedFor.current = null;
      setServerTotals(null);
      setItems(readGuest());
      return;
    }
    if (mergedFor.current === user.id) return;
    mergedFor.current = user.id;
    const guest = readGuest();
    const run = async () => {
      setLoading(true);
      try {
        if (guest.length) {
          const { data } = await api.post('/cart/items/merge/', {
            items: guest.map((g) => ({ product: g.slug, variant: g.variantId, quantity: g.quantity })),
          });
          writeGuest([]);
          applyServer(data);
        } else {
          const { data } = await api.get('/cart/');
          applyServer(data);
        }
      } catch {
        /* keep guest items visible if the server is unreachable */
      } finally {
        setLoading(false);
      }
    };
    run();
  }, [user, applyServer]);

  /**
   * addItem(product, { variant, quantity, sourceEl, openDrawer })
   * product: object from the API (needs slug, name, image, sale_price, mrp, gst_rate)
   */
  const addItem = async (product, { variant = null, quantity = 1, sourceEl = null, openDrawer = true } = {}) => {
    if (sourceEl) flyToBag(sourceEl);
    try {
      if (user) {
        const { data } = await api.post('/cart/items/', {
          product: product.slug,
          variant: variant?.id ?? null,
          quantity,
        });
        applyServer(data);
      } else {
        const guest = readGuest();
        const key = `g-${product.slug}-${variant?.id ?? 0}`;
        const stock = variant ? variant.stock : product.stock;
        const existing = guest.find((g) => g.key === key);
        if (existing) {
          existing.quantity = Math.min(existing.quantity + quantity, 10, stock || 10);
        } else {
          guest.push({
            key,
            id: null,
            slug: product.slug,
            variantId: variant?.id ?? null,
            variantLabel: variant?.label || '',
            name: product.name,
            image: product.image || product.images?.[0]?.image || null,
            category: product.category?.name || '',
            unitPrice: Number(variant ? variant.price : product.sale_price),
            unitMrp: Number(variant ? variant.effective_mrp || product.mrp : product.mrp),
            gstRate: Number(product.gst_rate || 0),
            quantity: Math.min(quantity, 10, stock || 10),
            stock,
          });
        }
        writeGuest(guest);
        setItems([...guest]);
      }
      toast(`Added to bag — ${product.name}`);
      if (openDrawer) setTimeout(() => setDrawerOpen(true), sourceEl ? 650 : 0);
      return true;
    } catch (err) {
      toast(parseApiError(err).message, 'error');
      return false;
    }
  };

  const updateQty = async (key, quantity) => {
    const item = items.find((i) => i.key === key);
    if (!item) return;
    if (user && item.id) {
      try {
        const { data } = await api.patch(`/cart/items/${item.id}/`, { quantity });
        applyServer(data);
      } catch (err) {
        toast(parseApiError(err).message, 'error');
      }
    } else {
      const guest = readGuest()
        .map((g) => (g.key === key ? { ...g, quantity: Math.max(1, Math.min(quantity, 10, g.stock || 10)) } : g))
        .filter((g) => g.quantity > 0);
      writeGuest(guest);
      setItems(guest);
    }
  };

  const removeItem = async (key) => {
    const item = items.find((i) => i.key === key);
    if (!item) return;
    if (user && item.id) {
      const { data } = await api.delete(`/cart/items/${item.id}/`);
      applyServer(data);
    } else {
      const guest = readGuest().filter((g) => g.key !== key);
      writeGuest(guest);
      setItems(guest);
    }
    toast('Removed from bag', 'info');
  };

  const clearLocal = () => {
    writeGuest([]);
    setItems([]);
    setServerTotals(null);
  };

  const totals = useMemo(() => {
    if (user && serverTotals) {
      const t = {};
      Object.entries(serverTotals).forEach(([k, v]) => {
        t[k] = typeof v === 'string' && !Number.isNaN(Number(v)) ? Number(v) : v;
      });
      return t;
    }
    return computeGuestTotals(items, settings);
  }, [user, serverTotals, items, settings]);

  const count = items.reduce((n, i) => n + i.quantity, 0);

  return (
    <CartContext.Provider
      value={{ items, totals, count, loading, addItem, updateQty, removeItem, refresh, clearLocal, drawerOpen, setDrawerOpen }}
    >
      {children}
    </CartContext.Provider>
  );
}

export const useCart = () => useContext(CartContext);
