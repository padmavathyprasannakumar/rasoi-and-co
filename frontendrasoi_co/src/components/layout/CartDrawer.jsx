import { useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { useCart } from '../../context/CartContext';
import Icon from '../ui/Icon';
import { EmptyState, QuantityStepper, SmartImage } from '../ui/Primitives';
import { formatPrice } from '../../utils/formatPrice';

export function FreeShippingBar({ totals }) {
  const threshold = Number(totals.free_shipping_threshold || 0);
  if (!threshold) return null;
  const pct = Math.min(100, (Number(totals.subtotal) / threshold) * 100);
  const left = Number(totals.amount_to_free_shipping || 0);
  return (
    <div className="ship-progress">
      <p>
        {left > 0 ? (
          <>Add <strong>{formatPrice(left)}</strong> more for <strong>free shipping</strong></>
        ) : (
          <>🎉 You've unlocked <strong>free shipping</strong> across India</>
        )}
      </p>
      <div className="ship-track">
        <motion.div className="ship-fill" initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.8 }} />
      </div>
    </div>
  );
}

export default function CartDrawer() {
  const { items, totals, drawerOpen, setDrawerOpen, updateQty, removeItem } = useCart();
  const navigate = useNavigate();
  const close = () => setDrawerOpen(false);

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && setDrawerOpen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [setDrawerOpen]);

  return (
    <AnimatePresence>
      {drawerOpen && (
        <>
          <motion.div className="overlay" onClick={close} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} />
          <motion.aside
            className="drawer drawer-right cart-drawer"
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'tween', duration: 0.38, ease: [0.22, 1, 0.36, 1] }}
            aria-label="Shopping bag"
          >
            <div className="drawer-head">
              <h3>
                Your <em>bag</em> <small>({totals.item_count || 0})</small>
              </h3>
              <button className="icon-btn" onClick={close} aria-label="Close bag">
                <Icon name="close" size={22} />
              </button>
            </div>

            {items.length === 0 ? (
              <EmptyState
                title="Your bag is empty"
                text="Discover appliances that make everyday cooking a joy."
                action={<button className="btn btn-primary" onClick={() => { close(); navigate('/shop'); }}>Start shopping</button>}
              />
            ) : (
              <>
                <FreeShippingBar totals={totals} />
                <ul className="mini-cart">
                  <AnimatePresence initial={false}>
                    {items.map((item) => (
                      <motion.li key={item.key} layout initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }}>
                        <Link to={`/product/${item.slug}`} onClick={close} className="mini-img">
                          <SmartImage src={item.image} alt={item.name} width={200} sizes="80px" />
                        </Link>
                        <div className="mini-info">
                          <Link to={`/product/${item.slug}`} onClick={close} className="mini-name">{item.name}</Link>
                          {item.variantLabel && <span className="mini-variant">{item.variantLabel}</span>}
                          <div className="mini-row">
                            <QuantityStepper size="sm" value={item.quantity} max={Math.min(10, item.stock || 10)} onChange={(q) => updateQty(item.key, q)} />
                            <span className="mini-price">{formatPrice(item.unitPrice * item.quantity)}</span>
                          </div>
                        </div>
                        <button className="icon-btn mini-remove" onClick={() => removeItem(item.key)} aria-label={`Remove ${item.name}`}>
                          <Icon name="trash" size={16} />
                        </button>
                      </motion.li>
                    ))}
                  </AnimatePresence>
                </ul>
                <div className="drawer-total">
                  <div className="sum-row"><span>Subtotal</span><strong>{formatPrice(totals.subtotal)}</strong></div>
                  {Number(totals.discount) > 0 && (
                    <div className="sum-row sum-save"><span>You save</span><span>− {formatPrice(totals.discount)}</span></div>
                  )}
                  <p className="tax-note">Inclusive of all taxes (GST). Shipping calculated at checkout.</p>
                  <button className="btn btn-primary btn-block" onClick={() => { close(); navigate('/checkout'); }}>
                    Checkout securely <Icon name="arrowRight" size={16} />
                  </button>
                  <Link to="/cart" className="btn btn-outline btn-block" onClick={close}>View bag</Link>
                </div>
              </>
            )}
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
