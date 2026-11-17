import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../api/axios';
import useSeo from '../hooks/useSeo';
import { useCart } from '../context/CartContext';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../context/AuthContext';
import AddressForm, { EMPTY_ADDRESS, validateAddress } from '../components/shop/AddressForm';
import { OrderSummary } from './Cart';
import Icon from '../components/ui/Icon';
import { EmptyState, SmartImage, Spinner } from '../components/ui/Primitives';
import { formatPhone, formatPrice } from '../utils/formatPrice';
import { parseApiError } from '../utils/errors';
import { payWithRazorpay } from '../utils/razorpay';

export default function Checkout() {
  useSeo('Checkout');
  const { user } = useAuth();
  const { items, refresh, clearLocal } = useCart();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [addresses, setAddresses] = useState([]);
  const [selected, setSelected] = useState(null);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ ...EMPTY_ADDRESS, full_name: `${user?.first_name || ''} ${user?.last_name || ''}`.trim(), mobile: user?.mobile || '' });
  const [errors, setErrors] = useState({});
  const [method, setMethod] = useState('razorpay');
  const [summary, setSummary] = useState(null);
  const [delivery, setDelivery] = useState(null);
  const [placing, setPlacing] = useState(false);
  const [loading, setLoading] = useState(true);

  // Load saved addresses
  useEffect(() => {
    api
      .get('/addresses/')
      .then(({ data }) => {
        setAddresses(data);
        const def = data.find((a) => a.is_default) || data[0];
        if (def) setSelected(def.id);
        else setAdding(true);
      })
      .finally(() => setLoading(false));
  }, []);

  // Server totals (includes COD fee when COD is chosen)
  useEffect(() => {
    api.get('/cart/', { params: { payment_method: method } }).then(({ data }) => setSummary(data));
  }, [method, items]);

  // Delivery estimate for chosen PIN
  const activePin = adding ? form.pincode : addresses.find((a) => a.id === selected)?.pincode;
  useEffect(() => {
    if (!activePin || !/^[1-9]\d{5}$/.test(activePin)) {
      setDelivery(null);
      return;
    }
    api.get(`/pincode-check/${activePin}/`).then(({ data }) => setDelivery(data));
  }, [activePin]);

  const totals = summary
    ? Object.fromEntries(Object.entries(summary.totals).map(([k, v]) => [k, typeof v === 'string' ? Number(v) : v]))
    : null;
  const codAllowed = delivery?.cod_available !== false && totals?.cod_allowed !== false;

  useEffect(() => {
    if (method === 'cod' && !codAllowed) setMethod('razorpay');
  }, [codAllowed, method]);

  const placeOrder = async () => {
    let payload = { payment_method: method };
    if (adding) {
      const errs = validateAddress(form);
      setErrors(errs);
      if (Object.keys(errs).length) {
        toast('Please complete your delivery address', 'error');
        return;
      }
      payload = { ...payload, ...form, save_address: true };
    } else if (selected) {
      payload.address_id = selected;
    } else {
      toast('Choose a delivery address', 'error');
      return;
    }

    setPlacing(true);
    try {
      const { data: order } = await api.post('/orders/', payload);
      if (method === 'cod') {
        clearLocal();
        await refresh();
        navigate(`/order-success/${order.order_number}`);
        return;
      }
      try {
        await payWithRazorpay(order.order_number);
        clearLocal();
        await refresh();
        navigate(`/order-success/${order.order_number}`);
      } catch (payErr) {
        toast(payErr.message, 'error');
        navigate('/account/orders');
      }
    } catch (err) {
      const { message, fields } = parseApiError(err);
      setErrors(fields);
      toast(message, 'error');
    } finally {
      setPlacing(false);
    }
  };

  if (loading) return <div className="page-loading"><Spinner /></div>;
  if (!items.length) {
    return (
      <div className="container section">
        <EmptyState title="Your bag is empty" action={<Link to="/shop" className="btn btn-primary">Shop now</Link>} />
      </div>
    );
  }

  return (
    <div className="container section checkout-page">
      <h1 className="page-title">Secure <em>checkout</em></h1>
      <div className="checkout-layout">
        <div className="checkout-steps">
          {/* STEP 1: Address */}
          <section className="card checkout-step">
            <h3><span className="step-num">1</span> Delivery address</h3>
            {addresses.length > 0 && (
              <div className="address-list">
                {addresses.map((a) => (
                  <label key={a.id} className={`address-option ${!adding && selected === a.id ? 'active' : ''}`}>
                    <input type="radio" name="address" checked={!adding && selected === a.id} onChange={() => { setSelected(a.id); setAdding(false); }} />
                    <div>
                      <strong>{a.full_name}</strong> <span className="chip chip-sm">{a.address_type}</span>
                      <p>{a.house}, {a.street}{a.landmark ? `, near ${a.landmark}` : ''}, {a.city}, {a.state} – {a.pincode}</p>
                      <small>{formatPhone(a.mobile)}</small>
                    </div>
                  </label>
                ))}
                <button className={`address-option add-new ${adding ? 'active' : ''}`} onClick={() => setAdding(true)} type="button">
                  <Icon name="plus" size={16} /> Add a new address
                </button>
              </div>
            )}
            {adding && <AddressForm value={form} onChange={setForm} errors={errors} />}
            {delivery?.serviceable && (
              <p className="delivery-eta"><Icon name="truck" size={16} /> {delivery.message} · Est. {delivery.estimated_delivery_display}</p>
            )}
            {delivery && !delivery.serviceable && <p className="field-error">{delivery.message}</p>}
          </section>

          {/* STEP 2: Payment */}
          <section className="card checkout-step">
            <h3><span className="step-num">2</span> Payment method</h3>
            <label className={`pay-option ${method === 'razorpay' ? 'active' : ''}`}>
              <input type="radio" name="pay" checked={method === 'razorpay'} onChange={() => setMethod('razorpay')} />
              <div>
                <strong>Pay online — UPI, Cards, Net banking, Wallets</strong>
                <small>Secured by Razorpay. GPay, PhonePe, Paytm, RuPay, Visa, Mastercard.</small>
                <div className="pay-badges pay-badges-dark">
                  {['UPI', 'RuPay', 'Visa', 'Mastercard', 'Net banking'].map((b) => <span key={b} className="pay-badge">{b}</span>)}
                </div>
              </div>
            </label>
            <label className={`pay-option ${method === 'cod' ? 'active' : ''} ${!codAllowed ? 'disabled' : ''}`}>
              <input type="radio" name="pay" disabled={!codAllowed} checked={method === 'cod'} onChange={() => setMethod('cod')} />
              <div>
                <strong>Cash on Delivery</strong>
                <small>{codAllowed ? 'Pay in cash or UPI when your order arrives.' : 'Not available for this PIN code or order value.'}</small>
              </div>
            </label>
          </section>
        </div>

        <aside className="checkout-aside">
          {totals && (
            <OrderSummary totals={totals} title={`Order summary (${totals.item_count})`}>
              <ul className="checkout-items">
                {items.map((i) => (
                  <li key={i.key}>
                    <SmartImage src={i.image} alt={i.name} width={120} sizes="48px" />
                    <span>{i.name} {i.variantLabel && <small>({i.variantLabel})</small>} × {i.quantity}</span>
                    <strong>{formatPrice(i.unitPrice * i.quantity)}</strong>
                  </li>
                ))}
              </ul>
              <button className="btn btn-primary btn-block btn-lg" onClick={placeOrder} disabled={placing}>
                {placing ? 'Placing order…' : method === 'cod' ? `Place order · ${formatPrice(totals.total)}` : `Pay ${formatPrice(totals.total)} securely`}
              </button>
              <p className="secure-note"><Icon name="shield" size={14} /> 100% secure payments · GST invoice included</p>
            </OrderSummary>
          )}
        </aside>
      </div>
    </div>
  );
}
