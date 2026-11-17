import { Link } from 'react-router-dom';
import { useSite } from '../../context/SiteContext';
import useApi from '../../hooks/useApi';
import Icon from '../ui/Icon';
import { Reveal } from '../ui/Reveal';

const SOCIALS = [
  ['instagram_url', 'instagram', 'Instagram'],
  ['facebook_url', 'facebook', 'Facebook'],
  ['youtube_url', 'youtube', 'YouTube'],
  ['pinterest_url', 'pinterest', 'Pinterest'],
  ['twitter_url', 'twitter', 'X'],
  ['linkedin_url', 'linkedin', 'LinkedIn'],
];
const PAYMENTS = ['UPI', 'Visa', 'Mastercard', 'RuPay'];

/** Footer — every text, link and contact detail comes from Django admin (Site settings, Nav links, Highlights). */
export default function Footer() {
  const { settings, menu } = useSite();
  const { data: highlights } = useApi('/highlights/');
  const s = settings || {};
  const strip = (highlights || []).filter((h) => h.placement !== 'hero').slice(0, 4);
  const wa = (s.whatsapp || '').replace(/\D/g, '');
  const shopLinks = [
    ...(menu?.footer_shop || []).map((l) => ({ key: `n${l.id}`, label: l.label, url: l.url })),
    ...(menu?.mega_menu || []).flatMap((g) => g.items).slice(0, 3).map((c) => ({ key: c.slug, label: c.name, url: `/category/${c.slug}` })),
  ];
  const openAI = () => window.dispatchEvent(new Event('open-ask-ai'));

  return (
    <footer className="site-footer">
      <div className="footer-glow" aria-hidden="true" />

      {strip.length > 0 && (
        <div className="footer-strip">
          <div className="footer-inner footer-strip-grid">
            {strip.map((h) => (
              <div key={h.id} className="strip-item">
                <span className="strip-icon"><Icon name={h.icon} size={18} /></span>
                <div>
                  <strong>{h.title}</strong>
                  <small>{h.subtitle}</small>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="footer-inner">
        <Reveal className="footer-cta">
          <div className="footer-cta-copy">
            <span className="footer-eyebrow">✦ {s.footer_eyebrow || 'THE RASOI CIRCLE'}</span>
            <h2>
              {s.footer_cta_title || 'Cook for yourself.'} <em>{s.footer_cta_italic || 'Beautifully.'}</em>
            </h2>
            {s.footer_cta_text && <p>{s.footer_cta_text}</p>}
          </div>
          <div className="footer-cta-actions">
            <Link to={s.footer_button_link || '/shop'} className="btn btn-gold">
              {s.footer_button_text || 'Find your next favourite'} <Icon name="arrowUpRight" size={14} />
            </Link>
            {s.ai_enabled !== false && (
              <button className="btn btn-outline-light" onClick={openAI}>
                <Icon name="spark" size={14} fill="currentColor" /> {s.footer_ai_button_text || 'Ask the AI expert'}
              </button>
            )}
          </div>
        </Reveal>

        <div className="footer-grid">
          <div className="footer-brand">
            <Link to="/" className="footer-logo">
              {s.logo ? (
                <img src={s.logo} alt={s.store_name} />
              ) : (
                <>
                  <span className="footer-logo-spark">✦</span> {s.store_name || 'Rasoi & Co.'}
                </>
              )}
            </Link>
            {s.footer_about && <p className="footer-about">{s.footer_about}</p>}
            {s.full_address && <p className="footer-address">{s.full_address}</p>}
            <span className="footer-follow">Follow us</span>
            <div className="socials">
              {SOCIALS.filter(([key]) => s[key]).map(([key, icon, label]) => (
                <a key={key} href={s[key]} target="_blank" rel="noreferrer" aria-label={label}>
                  <Icon name={icon} size={16} />
                </a>
              ))}
              {wa && (
                <a href={`https://wa.me/${wa}`} target="_blank" rel="noreferrer" aria-label="WhatsApp">
                  <Icon name="whatsapp" size={16} />
                </a>
              )}
              {s.email && (
                <a href={`mailto:${s.email}`} aria-label="Email">
                  <Icon name="mail" size={16} />
                </a>
              )}
            </div>
          </div>

          <div>
            <h3 className="footer-heading">Shop</h3>
            <ul className="footer-links">
              {shopLinks.map((l) => (
                <li key={l.key}><Link to={l.url}>{l.label}</Link></li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="footer-heading">Customer care</h3>
            <ul className="footer-links">
              {(menu?.footer_care || []).map((l) => (
                <li key={l.id}><Link to={l.url}>{l.label}</Link></li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="footer-heading">Get in touch</h3>
            <ul className="footer-contact">
              {s.email && (
                <li><span className="contact-ico"><Icon name="mail" size={14} /></span><a href={`mailto:${s.email}`}>{s.email}</a></li>
              )}
              {s.phone && (
                <li><span className="contact-ico"><Icon name="phone" size={14} /></span><a href={`tel:${s.phone.replace(/\s/g, '')}`}>{s.phone}</a></li>
              )}
              {wa && (
                <li><span className="contact-ico"><Icon name="whatsapp" size={14} /></span><a href={`https://wa.me/${wa}`} target="_blank" rel="noreferrer">WhatsApp us</a></li>
              )}
              {s.business_hours && (
                <li><span className="contact-ico"><Icon name="clock" size={14} /></span><span>{s.business_hours}</span></li>
              )}
            </ul>
            <div className="pay-badges" aria-label="Payment methods accepted">
              {PAYMENTS.map((p) => <span key={p} className="pay-badge">{p}</span>)}
            </div>
          </div>
        </div>

        <div className="footer-bottom">
          <p>{s.copyright_text || '© Rasoi & Co.'} · Prices in ₹ INR, inclusive of GST{s.gstin ? ` · GSTIN ${s.gstin}` : ''}</p>
          <div>
            <Link to="/privacy">Privacy</Link>
            <Link to="/terms">Terms</Link>
            <Link to="/shipping-returns">Shipping & returns</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
