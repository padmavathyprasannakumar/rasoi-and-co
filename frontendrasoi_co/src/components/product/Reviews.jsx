import { useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../api/axios';
import useApi from '../../hooks/useApi';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import Icon from '../ui/Icon';
import { Stars } from '../ui/Primitives';
import { formatDate } from '../../utils/formatPrice';
import { parseApiError } from '../../utils/errors';

export default function Reviews({ product }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const { data, reload } = useApi('/reviews/', { params: { product: product.slug } });
  const [form, setForm] = useState({ rating: 5, title: '', comment: '' });
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const reviews = data?.results || [];
  const total = product.review_count || 0;
  const breakdown = product.rating_breakdown || {};

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post('/reviews/', { ...form, product: product.slug });
      toast('Thank you for your review!');
      setForm({ rating: 5, title: '', comment: '' });
      setOpen(false);
      reload();
    } catch (err) {
      toast(parseApiError(err).message, 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="reviews" id="reviews">
      <div className="reviews-summary">
        <span className="eyebrow">Reviews</span>
        <h2>
          What cooks <em>are saying</em>
        </h2>
        <div className="rating-big">
          <strong>{product.rating_avg ? product.rating_avg.toFixed(1) : '—'}</strong>
          <div>
            <Stars value={product.rating_avg || 0} size={16} />
            <small>{total} {total === 1 ? 'review' : 'reviews'}</small>
          </div>
        </div>
        <div className="rating-bars">
          {['5', '4', '3', '2', '1'].map((s) => {
            const n = breakdown[s] || 0;
            return (
              <div key={s} className="rating-bar">
                <span>{s}★</span>
                <div className="bar"><span style={{ width: total ? `${(n / total) * 100}%` : 0 }} /></div>
                <small>{n}</small>
              </div>
            );
          })}
        </div>
        {user ? (
          <button className="btn btn-outline" onClick={() => setOpen((v) => !v)}>
            <Icon name="edit" size={15} /> Write a review
          </button>
        ) : (
          <Link to={`/login?next=/product/${product.slug}`} className="btn btn-outline">Sign in to review</Link>
        )}
      </div>

      <div className="reviews-list">
        {open && (
          <form className="review-form card" onSubmit={submit}>
            <span className="label">Your rating</span>
            <div className="rating-input">
              {[1, 2, 3, 4, 5].map((n) => (
                <button type="button" key={n} onClick={() => setForm((f) => ({ ...f, rating: n }))} aria-label={`${n} stars`}>
                  <Icon name="star" size={24} fill={n <= form.rating ? 'currentColor' : 'none'} />
                </button>
              ))}
            </div>
            <label className="label" htmlFor="rv-title">Title</label>
            <input id="rv-title" className="input" value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} placeholder="Perfect for idli batter" />
            <label className="label" htmlFor="rv-comment">Your review</label>
            <textarea id="rv-comment" className="textarea" rows={4} required value={form.comment} onChange={(e) => setForm((f) => ({ ...f, comment: e.target.value }))} />
            <button className="btn btn-primary" disabled={saving}>{saving ? 'Posting…' : 'Post review'}</button>
          </form>
        )}
        {reviews.length === 0 && !open && <p className="muted">No reviews yet — be the first to share your experience.</p>}
        {reviews.map((r) => (
          <article key={r.id} className="review">
            <div className="review-head">
              <Stars value={r.rating} size={13} />
              {r.is_verified_purchase && <span className="verified"><Icon name="check" size={12} /> Verified purchase</span>}
            </div>
            {r.title && <h4>{r.title}</h4>}
            <p>{r.comment}</p>
            <small>{r.user_name} · {formatDate(r.created_at)}</small>
          </article>
        ))}
      </div>
    </section>
  );
}
