import { Link, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import useSeo from '../hooks/useSeo';
import { useCart } from '../context/CartContext';
import { useWishlist } from '../context/WishlistContext';
import { FreeShippingBar } from '../components/layout/CartDrawer';
import Icon from '../components/ui/Icon';
import { EmptyState, QuantityStepper, SmartImage } from '../components/ui/Primitives';
import { formatPrice } from '../utils/formatPrice';

export function OrderSummary({ totals, children, title = 'Order summary' }) {
  return (
    <div className="summary card">
      <h3>{title}</h3>
      <div className="sum-row"><span>Total MRP</span><span>{formatPrice(totals.mrp_total)}</span></div>
      {Number(totals.discount) > 0 && (
        <div className="sum-row sum-save"><span>Discount on MRP</span><span>− {formatPrice(totals.discount)}</span></div>
      )}
      <div className="sum-row"><span>Subtotal</span><span>{formatPrice(totals.subtotal)}</span></div>
      <div className="sum-row">
        <span>Shipping</span>
        <span>{Number(totals.shipping_fee) === 0 ? <em className="free">FREE</em> : formatPrice(totals.shipping_fee)}</span>
      </div>
      {Number(totals.cod_fee) > 0 && <div className="sum-row"><span>COD fee</span><span>{formatPrice(totals.cod_fee)}</span></div>}
      <div className="sum-row sum-total"><span>Total</span><strong>{formatPrice(totals.total)}</strong></div>
      <p className="tax-note">Inclusive of GST {formatPrice(totals.gst_amount, { paise: true })}</p>
      {children}
    </div>
  );
}

export default function Cart() {
  useSeo('Your bag');
  const { items, totals, updateQty, removeItem } = useCart();
  const { toggle, has } = useWishlist();
  const navigate = useNavigate();

  if (!items.length) {
    return (
      <div className="container section">
        <EmptyState title="Your bag is empty" text="Add a little something special to your kitchen." action={<Link to="/shop" className="btn btn-primary">Start shopping</Link>} />
      </div>
    );
  }

  return (
    <div className="container section cart-page">
      <h1 className="page-title">Your <em>bag</em></h1>
      <div className="cart-layout">
        <div>
          <FreeShippingBar totals={totals} />
          <ul className="cart-list">
            <AnimatePresence initial={false}>
              {items.map((item) => (
                <motion.li key={item.key} layout initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, x: -40 }} className="cart-row card">
                  <Link to={`/product/${item.slug}`} className="cart-img">
                    <SmartImage src={item.image} alt={item.name} width={300} sizes="120px" />
                  </Link>
                  <div className="cart-info">
                    <span className="card-eyebrow">{item.category}</span>
                    <Link to={`/product/${item.slug}`} className="cart-name">{item.name}</Link>
                    {item.variantLabel && <span className="mini-variant">{item.variantLabel}</span>}
                    <div className="price-row">
                      <span className="price">{formatPrice(item.unitPrice)}</span>
                      {item.unitMrp > item.unitPrice && <span className="price-mrp">{formatPrice(item.unitMrp)}</span>}
                    </div>
                    <div className="cart-actions">
                      <QuantityStepper value={item.quantity} max={Math.min(10, item.stock || 10)} onChange={(q) => updateQty(item.key, q)} />
                      <button
                        className="link-btn"
                        onClick={() => {
                          if (!has(item.slug)) toggle({ slug: item.slug });
                          removeItem(item.key);
                        }}
                      >
                        <Icon name="heart" size={14} /> Move to wishlist
                      </button>
                      <button className="link-btn" onClick={() => removeItem(item.key)}>
                        <Icon name="trash" size={14} /> Remove
                      </button>
                    </div>
                  </div>
                  <strong className="cart-line">{formatPrice(item.unitPrice * item.quantity)}</strong>
                </motion.li>
              ))}
            </AnimatePresence>
          </ul>
        </div>
        <aside className="cart-aside">
          <OrderSummary totals={totals}>
            <button className="btn btn-primary btn-block btn-lg" onClick={() => navigate('/checkout')}>
              Proceed to checkout <Icon name="arrowRight" size={16} />
            </button>
            <div className="pay-badges pay-badges-dark">
              {['UPI', 'Visa', 'Mastercard', 'RuPay', 'COD'].map((b) => <span key={b} className="pay-badge">{b}</span>)}
            </div>
          </OrderSummary>
        </aside>
      </div>
    </div>
  );
}
