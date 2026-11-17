import { useState } from 'react';
import { Link, NavLink, useNavigate, useParams } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import api from '../api/axios';
import useApi from '../hooks/useApi';
import useSeo from '../hooks/useSeo';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useWishlist } from '../context/WishlistContext';
import AddressForm, { EMPTY_ADDRESS, validateAddress } from '../components/shop/AddressForm';
import ProductGrid from '../components/product/ProductGrid';
import Icon from '../components/ui/Icon';
import { EmptyState, SmartImage, Spinner } from '../components/ui/Primitives';
import { formatDate, formatPhone, formatPrice } from '../utils/formatPrice';
import { parseApiError } from '../utils/errors';
import { payWithRazorpay } from '../utils/razorpay';

const TABS = [
  { key: 'orders', label: 'My orders', icon: 'box' },
  { key: 'addresses', label: 'Addresses', icon: 'pin' },
  { key: 'wishlist', label: 'Wishlist', icon: 'heart' },
  { key: 'profile', label: 'Profile', icon: 'user' },
];

const STEPS = ['placed', 'confirmed', 'packed', 'shipped', 'out_for_delivery', 'delivered'];

/* ------------------------------ Orders ------------------------------ */
function Orders() {
  const { data, loading, reload } = useApi('/orders/');
  const { toast } = useToast();
  const [open, setOpen] = useState(null);
  const navigate = useNavigate();

  const cancel = async (o) => {
    if (!window.confirm(`Cancel order #${o.order_number}?`)) return;
    try {
      await api.post(`/orders/${o.order_number}/cancel/`);
      toast('Order cancelled', 'info');
      reload();
    } catch (err) {
      toast(parseApiError(err).message, 'error');
    }
  };

  const pay = async (o) => {
    try {
      await payWithRazorpay(o.order_number);
      navigate(`/order-success/${o.order_number}`);
    } catch (err) {
      toast(err.message, 'error');
      reload();
    }
  };

  if (loading) return <Spinner />;
  const orders = data?.results || [];
  if (!orders.length) {
    return <EmptyState icon="box" title="No orders yet" text="Your orders and tracking will appear here." action={<Link to="/shop" className="btn btn-primary">Start shopping</Link>} />;
  }

  return (
    <div className="orders">
      {orders.map((o) => {
        const stepIndex = STEPS.indexOf(o.status === 'pending_payment' ? 'placed' : o.status);
        const isOpen = open === o.order_number;
        return (
          <article key={o.order_number} className="order-card card">
            <button className="order-head" onClick={() => setOpen(isOpen ? null : o.order_number)} aria-expanded={isOpen}>
              <div>
                <strong>#{o.order_number}</strong>
                <small>{formatDate(o.created_at)} · {o.items.length} {o.items.length === 1 ? 'item' : 'items'}</small>
              </div>
              <span className={`status status-${o.status}`}>{o.status_label}</span>
              <strong className="order-total">{formatPrice(o.total)}</strong>
              <Icon name="chevronDown" size={18} className={isOpen ? 'rot' : ''} />
            </button>
            <AnimatePresence initial={false}>
              {isOpen && (
                <motion.div className="order-body" initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}>
                  {!['cancelled', 'returned'].includes(o.status) && stepIndex >= 0 && (
                    <ol className="tracker">
                      {STEPS.map((s, i) => (
                        <li key={s} className={i <= stepIndex ? 'done' : ''}>
                          <span />
                          <small>{s.replaceAll('_', ' ')}</small>
                        </li>
                      ))}
                    </ol>
                  )}
                  <ul className="checkout-items">
                    {o.items.map((i) => (
                      <li key={i.id}>
                        <SmartImage src={i.image_url} alt={i.product_name} width={120} sizes="48px" />
                        <span>
                          {i.product_slug ? <Link to={`/product/${i.product_slug}`}>{i.product_name}</Link> : i.product_name}
                          {i.variant_label && <small> ({i.variant_label})</small>} × {i.quantity}
                        </span>
                        <strong>{formatPrice(i.line_total)}</strong>
                      </li>
                    ))}
                  </ul>
                  <div className="order-meta">
                    <p>
                      <strong>Ship to:</strong> {o.full_name}, {o.house}, {o.street}, {o.city}, {o.state} – {o.pincode} · {formatPhone(o.mobile)}
                    </p>
                    <p>
                      <strong>Payment:</strong> {o.payment_method_label} · <span className={`status status-${o.payment_status}`}>{o.payment_status_label}</span>
                    </p>
                    {o.estimated_delivery && <p><strong>Estimated delivery:</strong> {formatDate(o.estimated_delivery)}</p>}
                    {o.tracking_number && <p><strong>Tracking:</strong> {o.courier_name} {o.tracking_number}</p>}
                  </div>
                  <div className="order-actions">
                    {o.payment_method === 'razorpay' && o.payment_status !== 'paid' && o.status === 'pending_payment' && (
                      <button className="btn btn-accent" onClick={() => pay(o)}>Pay {formatPrice(o.total)} now</button>
                    )}
                    {o.can_cancel && <button className="btn btn-outline" onClick={() => cancel(o)}>Cancel order</button>}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </article>
        );
      })}
    </div>
  );
}

/* ----------------------------- Addresses ---------------------------- */
function Addresses() {
  const { data, loading, reload } = useApi('/addresses/');
  const { toast } = useToast();
  const [editing, setEditing] = useState(null); // null | 'new' | id
  const [form, setForm] = useState(EMPTY_ADDRESS);
  const [errors, setErrors] = useState({});

  const start = (a) => {
    setEditing(a ? a.id : 'new');
    setForm(a ? { ...EMPTY_ADDRESS, ...a, landmark: a.landmark || '' } : EMPTY_ADDRESS);
    setErrors({});
  };

  const save = async (e) => {
    e.preventDefault();
    const errs = validateAddress(form);
    setErrors(errs);
    if (Object.keys(errs).length) return;
    try {
      if (editing === 'new') await api.post('/addresses/', form);
      else await api.patch(`/addresses/${editing}/`, form);
      toast('Address saved');
      setEditing(null);
      reload();
    } catch (err) {
      const { message, fields } = parseApiError(err);
      setErrors(fields);
      toast(message, 'error');
    }
  };

  const remove = async (id) => {
    if (!window.confirm('Delete this address?')) return;
    await api.delete(`/addresses/${id}/`);
    reload();
  };

  const makeDefault = async (id) => {
    await api.patch(`/addresses/${id}/`, { is_default: true });
    reload();
  };

  if (loading) return <Spinner />;

  if (editing) {
    return (
      <form className="card form-card" onSubmit={save}>
        <h3>{editing === 'new' ? 'Add a new address' : 'Edit address'}</h3>
        <AddressForm value={form} onChange={setForm} errors={errors} />
        <label className="check">
          <input type="checkbox" checked={!!form.is_default} onChange={(e) => setForm({ ...form, is_default: e.target.checked })} />
          <span>Make this my default address</span>
        </label>
        <div className="form-actions">
          <button className="btn btn-primary">Save address</button>
          <button type="button" className="btn btn-ghost" onClick={() => setEditing(null)}>Cancel</button>
        </div>
      </form>
    );
  }

  return (
    <div className="address-grid">
      {(data || []).map((a) => (
        <div key={a.id} className={`card address-card ${a.is_default ? 'is-default' : ''}`}>
          <div className="address-card-head">
            <strong>{a.full_name}</strong>
            <span className="chip chip-sm">{a.address_type}</span>
            {a.is_default && <span className="chip chip-sm chip-active">Default</span>}
          </div>
          <p>{a.house}, {a.street}{a.landmark ? `, near ${a.landmark}` : ''}<br />{a.city}, {a.state} – {a.pincode}</p>
          <small>{formatPhone(a.mobile)}</small>
          <div className="address-card-actions">
            <button className="link-btn" onClick={() => start(a)}><Icon name="edit" size={14} /> Edit</button>
            {!a.is_default && <button className="link-btn" onClick={() => makeDefault(a.id)}>Set default</button>}
            <button className="link-btn" onClick={() => remove(a.id)}><Icon name="trash" size={14} /> Delete</button>
          </div>
        </div>
      ))}
      <button className="card address-card add-card" onClick={() => start(null)}>
        <Icon name="plus" size={22} />
        Add a new address
      </button>
    </div>
  );
}

/* ------------------------------ Wishlist ---------------------------- */
function Wishlist() {
  const { slugs } = useWishlist();
  const { data, loading } = useApi('/wishlist/', { params: { v: slugs.join(',') } });
  if (loading) return <Spinner />;
  const products = (data || []).map((w) => w.product);
  if (!products.length) {
    return <EmptyState icon="heart" title="Your wishlist is empty" text="Tap the heart on any appliance to save it here." action={<Link to="/shop" className="btn btn-primary">Explore appliances</Link>} />;
  }
  return <ProductGrid products={products} className="product-grid-3" />;
}

/* ------------------------------- Profile ---------------------------- */
function Profile() {
  const { user, updateProfile } = useAuth();
  const { toast } = useToast();
  const [form, setForm] = useState({ first_name: user.first_name, last_name: user.last_name, email: user.email, mobile: user.mobile || '' });
  const [pw, setPw] = useState({ old_password: '', new_password: '' });
  const [errors, setErrors] = useState({});

  const save = async (e) => {
    e.preventDefault();
    try {
      await updateProfile(form);
      toast('Profile updated');
      setErrors({});
    } catch (err) {
      const { message, fields } = parseApiError(err);
      setErrors(fields);
      toast(message, 'error');
    }
  };

  const changePw = async (e) => {
    e.preventDefault();
    try {
      const { data } = await api.post('/auth/change-password/', pw);
      localStorage.setItem('rasoi_access', data.access);
      localStorage.setItem('rasoi_refresh', data.refresh);
      toast('Password changed');
      setPw({ old_password: '', new_password: '' });
    } catch (err) {
      toast(parseApiError(err).message, 'error');
    }
  };

  return (
    <div className="profile-grid">
      <form className="card form-card" onSubmit={save}>
        <h3>Personal details</h3>
        <div className="form-row">
          <div className="field">
            <label className="label" htmlFor="p-first">First name</label>
            <input id="p-first" className="input" value={form.first_name} onChange={(e) => setForm({ ...form, first_name: e.target.value })} />
          </div>
          <div className="field">
            <label className="label" htmlFor="p-last">Last name</label>
            <input id="p-last" className="input" value={form.last_name} onChange={(e) => setForm({ ...form, last_name: e.target.value })} />
          </div>
        </div>
        <label className="label" htmlFor="p-email">Email</label>
        <input id="p-email" type="email" className="input" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        {errors.email && <p className="field-error">{errors.email}</p>}
        <label className="label" htmlFor="p-mobile">Mobile</label>
        <div className="input-prefix">
          <span>+91</span>
          <input id="p-mobile" className="input" inputMode="numeric" maxLength={10} value={form.mobile} onChange={(e) => setForm({ ...form, mobile: e.target.value.replace(/\D/g, '') })} />
        </div>
        {errors.mobile && <p className="field-error">{errors.mobile}</p>}
        <p className="muted small">Username: {user.username} · Member since {formatDate(user.date_joined)}</p>
        <button className="btn btn-primary">Save changes</button>
      </form>

      <form className="card form-card" onSubmit={changePw}>
        <h3>Change password</h3>
        <label className="label" htmlFor="p-old">Current password</label>
        <input id="p-old" type="password" className="input" required value={pw.old_password} onChange={(e) => setPw({ ...pw, old_password: e.target.value })} autoComplete="current-password" />
        <label className="label" htmlFor="p-new">New password</label>
        <input id="p-new" type="password" className="input" required minLength={8} value={pw.new_password} onChange={(e) => setPw({ ...pw, new_password: e.target.value })} autoComplete="new-password" />
        <button className="btn btn-outline">Update password</button>
      </form>
    </div>
  );
}

/* ------------------------------- Page ------------------------------- */
export default function Account() {
  const { tab = 'orders' } = useParams();
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  useSeo('My account');

  const Current = { orders: Orders, addresses: Addresses, wishlist: Wishlist, profile: Profile }[tab] || Orders;

  return (
    <div className="container section account-page">
      <div className="account-hero">
        <span className="eyebrow">My account</span>
        <h1 className="page-title">
          Namaste, <em>{user.first_name || user.username}</em>
        </h1>
      </div>
      <div className="account-layout">
        <nav className="account-nav" aria-label="Account">
          {TABS.map((t) => (
            <NavLink key={t.key} to={`/account/${t.key}`} className={({ isActive }) => `account-link ${isActive || (tab === t.key) ? 'active' : ''}`}>
              <Icon name={t.icon} size={17} /> {t.label}
            </NavLink>
          ))}
          <button
            className="account-link"
            onClick={() => {
              logout();
              navigate('/');
            }}
          >
            <Icon name="logout" size={17} /> Sign out
          </button>
        </nav>
        <motion.div key={tab} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="account-content">
          <Current />
        </motion.div>
      </div>
    </div>
  );
}
