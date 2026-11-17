import { useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import api from '../api/axios';
import useApi from '../hooks/useApi';
import useSeo from '../hooks/useSeo';
import { useSite } from '../context/SiteContext';
import { useToast } from '../context/ToastContext';
import Accordion from '../components/ui/Accordion';
import Icon from '../components/ui/Icon';
import { Breadcrumbs, EmptyState, SmartImage, Spinner } from '../components/ui/Primitives';
import { Reveal } from '../components/ui/Reveal';
import { parseApiError } from '../utils/errors';

/* About / Shipping & Returns / Warranty / Privacy / Terms — all from Django admin "Pages" */
export function ContentPage({ slug: forcedSlug }) {
  const { pathname } = useLocation();
  const slug = forcedSlug || pathname.replace(/^\//, '').split('/')[0];
  const { data: page, loading, error } = useApi(`/pages/${slug}/`);
  useSeo(page?.title, page?.meta_description);

  if (loading) return <div className="page-loading"><Spinner /></div>;
  if (error || !page) {
    return (
      <div className="container section">
        <EmptyState icon="search" title="Page not found" text={`Add a Page with slug “${slug}” in Django admin.`} action={<Link to="/" className="btn btn-primary">Go home</Link>} />
      </div>
    );
  }

  return (
    <article className="content-page">
      <section className="content-hero">
        <div className="container">
          <Breadcrumbs items={[{ label: 'Home', to: '/' }, { label: page.title }]} />
          <Reveal>
            {page.eyebrow && <span className="eyebrow">{page.eyebrow}</span>}
            <h1>
              {page.title} {page.italic_title && <em>{page.italic_title}</em>}
            </h1>
            {page.subtitle && <p className="content-sub">{page.subtitle}</p>}
          </Reveal>
        </div>
        {page.hero_image && (
          <Reveal className="container content-hero-img">
            <SmartImage src={page.hero_image} alt={page.title} width={1400} sizes="100vw" eager />
          </Reveal>
        )}
      </section>
      <div className="container content-body">
        <Reveal className="rich-text" dangerouslySetInnerHTML={{ __html: page.content }} />
        {page.sections?.map((s) => (
          <Reveal key={s.id} className={`story-section ${s.image_on_left ? '' : 'reverse'}`}>
            <div className="story-media">
              <SmartImage src={s.image} alt={s.title} width={800} sizes="(max-width: 768px) 100vw, 50vw" />
            </div>
            <div>
              <h2>{s.title}</h2>
              <p>{s.text}</p>
            </div>
          </Reveal>
        ))}
      </div>
    </article>
  );
}

export function FAQPage() {
  useSeo('FAQs');
  const { data, loading } = useApi('/faqs/');
  const [q, setQ] = useState('');
  const groups = useMemo(() => {
    const g = {};
    (data || [])
      .filter((f) => !q || `${f.question} ${f.answer}`.toLowerCase().includes(q.toLowerCase()))
      .forEach((f) => {
        (g[f.category_label] = g[f.category_label] || []).push({ id: f.id, title: f.question, content: f.answer });
      });
    return g;
  }, [data, q]);

  return (
    <div className="container section faq-page">
      <Breadcrumbs items={[{ label: 'Home', to: '/' }, { label: 'FAQs' }]} />
      <Reveal className="center-text">
        <span className="eyebrow">Help centre</span>
        <h1 className="page-title">Questions, <em>answered.</em></h1>
        <div className="faq-search">
          <Icon name="search" size={18} />
          <input className="input" placeholder="Search delivery, COD, warranty…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search FAQs" />
        </div>
      </Reveal>
      {loading ? (
        <Spinner />
      ) : Object.keys(groups).length === 0 ? (
        <EmptyState icon="search" title="No matching questions" text="Try another word or contact us." />
      ) : (
        Object.entries(groups).map(([label, items]) => (
          <Reveal key={label} className="faq-group">
            <h2>{label}</h2>
            <Accordion items={items} defaultOpen={-1} />
          </Reveal>
        ))
      )}
      <Reveal className="faq-cta card">
        <h3>Still need help?</h3>
        <p>Our kitchen experts are happy to help in English, Hindi and Tamil.</p>
        <Link to="/contact" className="btn btn-primary">Contact us</Link>
      </Reveal>
    </div>
  );
}

export function ContactPage() {
  useSeo('Contact us');
  const { settings: s } = useSite();
  const { toast } = useToast();
  const [form, setForm] = useState({ name: '', email: '', mobile: '', subject: '', message: '' });
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setForm({ ...form, [k]: k === 'mobile' ? e.target.value.replace(/\D/g, '').slice(0, 10) : e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const { data } = await api.post('/contact/', form);
      toast(data.detail);
      setForm({ name: '', email: '', mobile: '', subject: '', message: '' });
      setErrors({});
    } catch (err) {
      const { message, fields } = parseApiError(err);
      setErrors(fields);
      toast(message, 'error');
    } finally {
      setBusy(false);
    }
  };
  const wa = (s?.whatsapp || '').replace(/\D/g, '');

  return (
    <div className="container section contact-page">
      <Breadcrumbs items={[{ label: 'Home', to: '/' }, { label: 'Contact' }]} />
      <Reveal>
        <span className="eyebrow">Get in touch</span>
        <h1 className="page-title">We'd love to <em>hear from you.</em></h1>
      </Reveal>
      <div className="contact-grid">
        <Reveal className="contact-cards">
          {s?.full_address && <div className="card contact-card"><Icon name="pin" /><div><strong>Visit us</strong><p>{s.full_address}</p></div></div>}
          {s?.phone && <a className="card contact-card" href={`tel:${s.phone.replace(/\s/g, '')}`}><Icon name="phone" /><div><strong>Call us</strong><p>{s.phone}</p></div></a>}
          {wa && <a className="card contact-card" href={`https://wa.me/${wa}`} target="_blank" rel="noreferrer"><Icon name="whatsapp" /><div><strong>WhatsApp</strong><p>{s.whatsapp}</p></div></a>}
          {s?.email && <a className="card contact-card" href={`mailto:${s.email}`}><Icon name="mail" /><div><strong>Email</strong><p>{s.email}</p></div></a>}
          {s?.business_hours && <div className="card contact-card"><Icon name="clock" /><div><strong>Hours</strong><p>{s.business_hours}</p></div></div>}
        </Reveal>
        <Reveal delay={0.1}>
          <form className="card form-card" onSubmit={submit}>
            <h3>Send us a message</h3>
            <div className="form-row">
              <div className="field">
                <label className="label" htmlFor="c-name">Name</label>
                <input id="c-name" className="input" required value={form.name} onChange={set('name')} />
              </div>
              <div className="field">
                <label className="label" htmlFor="c-email">Email</label>
                <input id="c-email" type="email" className="input" required value={form.email} onChange={set('email')} />
                {errors.email && <p className="field-error">{errors.email}</p>}
              </div>
            </div>
            <label className="label" htmlFor="c-mobile">Mobile (optional)</label>
            <div className="input-prefix">
              <span>+91</span>
              <input id="c-mobile" className="input" inputMode="numeric" value={form.mobile} onChange={set('mobile')} />
            </div>
            {errors.mobile && <p className="field-error">{errors.mobile}</p>}
            <label className="label" htmlFor="c-subject">Subject</label>
            <input id="c-subject" className="input" required value={form.subject} onChange={set('subject')} placeholder="Order, warranty, product question…" />
            <label className="label" htmlFor="c-msg">Message</label>
            <textarea id="c-msg" className="textarea" rows={5} required value={form.message} onChange={set('message')} />
            <button className="btn btn-primary" disabled={busy}>{busy ? 'Sending…' : 'Send message'} <Icon name="send" size={15} /></button>
          </form>
        </Reveal>
      </div>
    </div>
  );
}

export function NotFound() {
  useSeo('Page not found');
  return (
    <div className="container section not-found">
      <Reveal className="center-text">
        <span className="nf-code">4<em>0</em>4</span>
        <h1 className="page-title">This recipe <em>went missing.</em></h1>
        <p>The page you're looking for has moved or never existed.</p>
        <div className="nf-actions">
          <Link to="/" className="btn btn-primary">Back home</Link>
          <Link to="/shop" className="btn btn-outline">Browse appliances</Link>
        </div>
      </Reveal>
    </div>
  );
}
