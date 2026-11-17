import { useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import api from '../api/axios';
import useApi from '../hooks/useApi';
import useSeo from '../hooks/useSeo';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import Icon from '../components/ui/Icon';
import { SmartImage } from '../components/ui/Primitives';
import { parseApiError } from '../utils/errors';
import { useSite } from '../context/SiteContext';

/* Split layout: image panel + form (matches the reference login/register pages) */
function AuthLayout({ eyebrow, title, children, side = 'A kitchen', sideItalic = 'beautifully yours.', variant = 'login' }) {
  const { settings } = useSite();
  // Image comes from Django admin → Site settings → "Sign in / Create account pages"
  const adminImage = variant === 'register' ? settings?.register_image || settings?.login_image : settings?.login_image;
  const { data: slides } = useApi(adminImage ? null : '/hero-slides/'); // fallback: first hero slide image
  const image = adminImage || slides?.find((s) => s.image)?.image;
  return (
    <div className="container section auth-page">
      <motion.div className="auth-card" initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
        <div className="auth-side">
          <div className="auth-side-img">
            <SmartImage src={image} alt="Rasoi & Co. kitchen" width={800} sizes="(max-width: 768px) 100vw, 40vw" />
          </div>
          <h2>
            {side} <em>{sideItalic}</em>
          </h2>
          <p>{settings?.auth_side_text || 'Welcome to the Rasoi circle — saved addresses, faster checkout and order tracking.'}</p>
        </div>
        <div className="auth-form-wrap">
          <span className="eyebrow">{eyebrow}</span>
          <h1>{title}</h1>
          {children}
        </div>
      </motion.div>
    </div>
  );
}

function PasswordInput({ id, value, onChange, autoComplete }) {
  const [show, setShow] = useState(false);
  return (
    <div className="password-wrap">
      <input id={id} type={show ? 'text' : 'password'} className="input" required value={value} onChange={onChange} autoComplete={autoComplete} />
      <button type="button" className="link-btn" onClick={() => setShow((s) => !s)}>{show ? 'Hide' : 'Show'}</button>
    </div>
  );
}

export function Login() {
  useSeo('Sign in');
  const { login } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [form, setForm] = useState({ username: '', password: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const user = await login(form.username.trim(), form.password);
      toast(`Welcome back, ${user.first_name || user.username}!`);
      navigate(params.get('next') || '/account', { replace: true });
    } catch (err) {
      setError(err.response?.status === 401 ? 'Incorrect username/email or password.' : parseApiError(err).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthLayout eyebrow="Welcome back" title="Sign in">
      <form onSubmit={submit} className="auth-form">
        <label className="label" htmlFor="l-user">Username or email</label>
        <input id="l-user" className="input" required autoFocus value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} autoComplete="username" />
        <label className="label" htmlFor="l-pass">Password</label>
        <PasswordInput id="l-pass" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} autoComplete="current-password" />
        {error && <p className="form-error">{error}</p>}
        <button className="btn btn-primary btn-block btn-lg" disabled={busy}>
          {busy ? 'Signing in…' : 'Sign in'} <Icon name="arrowRight" size={16} />
        </button>
        <Link to="/forgot-password" className="auth-link">Forgot password?</Link>
        <p className="auth-alt">New here? <Link to={`/register${params.get('next') ? `?next=${encodeURIComponent(params.get('next'))}` : ''}`}>Create an account</Link></p>
      </form>
    </AuthLayout>
  );
}

export function Register() {
  useSeo('Create account');
  const { register } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [form, setForm] = useState({ username: '', email: '', first_name: '', last_name: '', mobile: '', password: '', password2: '' });
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setForm({ ...form, [k]: k === 'mobile' ? e.target.value.replace(/\D/g, '').slice(0, 10) : e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    if (form.mobile && !/^[6-9]\d{9}$/.test(form.mobile)) {
      setErrors({ mobile: 'Enter a valid 10-digit Indian mobile number' });
      return;
    }
    setBusy(true);
    try {
      const user = await register(form);
      toast(`Welcome to Rasoi & Co., ${user.first_name}!`);
      navigate(params.get('next') || '/account', { replace: true });
    } catch (err) {
      const { message, fields } = parseApiError(err);
      setErrors(fields);
      toast(message, 'error');
    } finally {
      setBusy(false);
    }
  };

  const err = (k) => errors[k] && <p className="field-error">{errors[k]}</p>;

  return (
    <AuthLayout eyebrow="Your kitchen story starts here" title="Create an account" side="Cook with" sideItalic="joy, every day." variant="register">
      <form onSubmit={submit} className="auth-form">
        <div className="form-row">
          <div className="field">
            <label className="label" htmlFor="r-first">First name</label>
            <input id="r-first" className="input" required value={form.first_name} onChange={set('first_name')} autoComplete="given-name" />
            {err('first_name')}
          </div>
          <div className="field">
            <label className="label" htmlFor="r-last">Last name</label>
            <input id="r-last" className="input" value={form.last_name} onChange={set('last_name')} autoComplete="family-name" />
          </div>
        </div>
        <label className="label" htmlFor="r-user">Username</label>
        <input id="r-user" className="input" required value={form.username} onChange={set('username')} autoComplete="username" />
        <p className="field-hint">Letters, digits and @/./+/-/_ only.</p>
        {err('username')}
        <label className="label" htmlFor="r-email">Email</label>
        <input id="r-email" type="email" className="input" required value={form.email} onChange={set('email')} autoComplete="email" />
        {err('email')}
        <label className="label" htmlFor="r-mobile">Mobile (optional)</label>
        <div className="input-prefix">
          <span>+91</span>
          <input id="r-mobile" className="input" inputMode="numeric" value={form.mobile} onChange={set('mobile')} placeholder="98765 43210" autoComplete="tel-national" />
        </div>
        {err('mobile')}
        <label className="label" htmlFor="r-pass">Password</label>
        <PasswordInput id="r-pass" value={form.password} onChange={set('password')} autoComplete="new-password" />
        <ul className="pw-rules">
          <li className={form.password.length >= 8 ? 'ok' : ''}>At least 8 characters</li>
          <li className={/\D/.test(form.password) ? 'ok' : ''}>Not only numbers</li>
          <li className={form.password && form.password === form.password2 ? 'ok' : ''}>Both passwords match</li>
        </ul>
        {err('password')}
        <label className="label" htmlFor="r-pass2">Confirm password</label>
        <PasswordInput id="r-pass2" value={form.password2} onChange={set('password2')} autoComplete="new-password" />
        {err('password2')}
        <button className="btn btn-primary btn-block btn-lg" disabled={busy}>
          {busy ? 'Creating account…' : 'Create account'} <Icon name="arrowRight" size={16} />
        </button>
        <p className="auth-alt">Already registered? <Link to="/login">Sign in</Link></p>
      </form>
    </AuthLayout>
  );
}

export function ForgotPassword() {
  useSeo('Forgot password');
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState('');
  const submit = async (e) => {
    e.preventDefault();
    const { data } = await api.post('/auth/password-reset/', { email });
    setSent(data.detail);
  };
  return (
    <AuthLayout eyebrow="Account help" title="Forgot password">
      {sent ? (
        <div className="auth-form">
          <p className="form-success"><Icon name="check" size={16} /> {sent}</p>
          <Link to="/login" className="btn btn-outline btn-block">Back to sign in</Link>
        </div>
      ) : (
        <form onSubmit={submit} className="auth-form">
          <p className="muted">Enter your email and we'll send you a link to reset your password.</p>
          <label className="label" htmlFor="fp-email">Email</label>
          <input id="fp-email" type="email" className="input" required value={email} onChange={(e) => setEmail(e.target.value)} />
          <button className="btn btn-primary btn-block">Send reset link</button>
          <Link to="/login" className="auth-link">Back to sign in</Link>
        </form>
      )}
    </AuthLayout>
  );
}

export function ResetPassword() {
  useSeo('Reset password');
  const { uid, token } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [pw, setPw] = useState('');
  const [error, setError] = useState('');
  const submit = async (e) => {
    e.preventDefault();
    try {
      const { data } = await api.post('/auth/password-reset/confirm/', { uid, token, new_password: pw });
      toast(data.detail);
      navigate('/login');
    } catch (err) {
      setError(parseApiError(err).message);
    }
  };
  return (
    <AuthLayout eyebrow="Account help" title="Choose a new password">
      <form onSubmit={submit} className="auth-form">
        <label className="label" htmlFor="rp">New password</label>
        <PasswordInput id="rp" value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="new-password" />
        {error && <p className="form-error">{error}</p>}
        <button className="btn btn-primary btn-block">Reset password</button>
      </form>
    </AuthLayout>
  );
}
