import { Link, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import useApi from '../hooks/useApi';
import useSeo from '../hooks/useSeo';
import Icon from '../components/ui/Icon';
import { SmartImage, Spinner } from '../components/ui/Primitives';
import { formatDate, formatPhone, formatPrice } from '../utils/formatPrice';

const CONFETTI = Array.from({ length: 18 }, (_, i) => ({ x: (i - 9) * 22, r: (i * 47) % 360, d: (i % 5) * 0.08 }));

export default function OrderSuccess() {
  const { orderNumber } = useParams();
  const { data: order, loading } = useApi(`/orders/${orderNumber}/`);
  useSeo('Order confirmed');

  if (loading) return <div className="page-loading"><Spinner /></div>;
  if (!order) return <div className="container section center-text"><h2>Order not found</h2></div>;

  return (
    <div className="container section success-page">
      <div className="success-hero">
        <div className="success-burst" aria-hidden="true">
          {CONFETTI.map((c, i) => (
            <motion.span
              key={i}
              initial={{ opacity: 0, x: 0, y: 0, rotate: 0 }}
              animate={{ opacity: [0, 1, 0], x: c.x * 2, y: [-10, -110, 40], rotate: c.r }}
              transition={{ duration: 1.6, delay: 0.3 + c.d, ease: 'easeOut' }}
            />
          ))}
        </div>
        <motion.div className="success-check" initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 260, damping: 16 }}>
          <Icon name="check" size={38} strokeWidth={2.2} />
        </motion.div>
        <span className="eyebrow">Thank you</span>
        <h1>
          Your order is <em>confirmed.</em>
        </h1>
        <p>
          Order <strong>#{order.order_number}</strong> · placed on {formatDate(order.created_at)}
          {order.estimated_delivery && <> · estimated delivery <strong>{formatDate(order.estimated_delivery)}</strong></>}
        </p>
      </div>

      <div className="success-grid">
        <div className="card success-card">
          <h3>Items</h3>
          <ul className="checkout-items">
            {order.items.map((i) => (
              <li key={i.id}>
                <SmartImage src={i.image_url} alt={i.product_name} width={120} sizes="48px" />
                <span>{i.product_name} {i.variant_label && <small>({i.variant_label})</small>} × {i.quantity}</span>
                <strong>{formatPrice(i.line_total)}</strong>
              </li>
            ))}
          </ul>
          <div className="sum-row"><span>Shipping</span><span>{Number(order.shipping_fee) ? formatPrice(order.shipping_fee) : 'FREE'}</span></div>
          {Number(order.cod_fee) > 0 && <div className="sum-row"><span>COD fee</span><span>{formatPrice(order.cod_fee)}</span></div>}
          <div className="sum-row sum-total"><span>Total</span><strong>{formatPrice(order.total)}</strong></div>
          <p className="tax-note">Inclusive of GST {formatPrice(order.gst_amount, { paise: true })}</p>
        </div>
        <div className="card success-card">
          <h3>Delivering to</h3>
          <p><strong>{order.full_name}</strong><br />{order.house}, {order.street}{order.landmark ? `, near ${order.landmark}` : ''}<br />{order.city}, {order.state} – {order.pincode}<br />{formatPhone(order.mobile)}</p>
          <h3>Payment</h3>
          <p>{order.payment_method_label}<br /><span className={`status status-${order.payment_status}`}>{order.payment_status_label}</span></p>
          <div className="success-actions">
            <Link to="/account/orders" className="btn btn-primary">Track my orders</Link>
            <Link to="/shop" className="btn btn-outline">Continue shopping</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
