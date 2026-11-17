import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { useSite } from '../../context/SiteContext';
import { useAuth } from '../../context/AuthContext';
import Icon from '../ui/Icon';
import { Logo } from '../ui/Primitives';

export default function MobileDrawer({ open, onClose, links }) {
  const { settings, menu } = useSite();
  const { user, logout } = useAuth();
  const [catsOpen, setCatsOpen] = useState(true);

  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', onKey);
    };
  }, [open, onClose]);

  const categories = (menu?.mega_menu || []).flatMap((g) => g.items);

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div className="overlay" onClick={onClose} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} />
          <motion.aside
            className="drawer drawer-left"
            initial={{ x: '-100%' }}
            animate={{ x: 0 }}
            exit={{ x: '-100%' }}
            transition={{ type: 'tween', duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
            aria-label="Mobile menu"
          >
            <div className="drawer-head">
              <Logo settings={settings} />
              <button className="icon-btn" onClick={onClose} aria-label="Close menu">
                <Icon name="close" size={22} />
              </button>
            </div>
            <nav className="drawer-nav">
              {links.map((l) =>
                l.has_mega_menu ? (
                  <div key={l.label}>
                    <button className="drawer-link drawer-toggle" onClick={() => setCatsOpen((v) => !v)} aria-expanded={catsOpen}>
                      {l.label}
                      <Icon name="chevronDown" size={16} className={catsOpen ? 'rot' : ''} />
                    </button>
                    <AnimatePresence initial={false}>
                      {catsOpen && (
                        <motion.div
                          className="drawer-sub"
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                        >
                          <Link to="/shop" onClick={onClose}>Shop all collections</Link>
                          {categories.map((c) => (
                            <Link key={c.slug} to={`/category/${c.slug}`} onClick={onClose}>
                              {c.name}
                            </Link>
                          ))}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                ) : (
                  <Link key={l.label} to={l.url} className="drawer-link" onClick={onClose}>
                    {l.label}
                  </Link>
                )
              )}
              <Link to="/faq" className="drawer-link" onClick={onClose}>FAQs</Link>
              <Link to="/contact" className="drawer-link" onClick={onClose}>Contact</Link>
            </nav>
            <div className="drawer-foot">
              {user ? (
                <>
                  <Link to="/account" className="btn btn-outline btn-block" onClick={onClose}>
                    <Icon name="user" size={16} /> My account
                  </Link>
                  <button
                    className="btn btn-ghost btn-block"
                    onClick={() => {
                      logout();
                      onClose();
                    }}
                  >
                    Sign out
                  </button>
                </>
              ) : (
                <>
                  <Link to="/login" className="btn btn-primary btn-block" onClick={onClose}>Sign in</Link>
                  <Link to="/register" className="btn btn-outline btn-block" onClick={onClose}>Create account</Link>
                </>
              )}
              {settings?.phone && (
                <a href={`tel:${settings.phone.replace(/\s/g, '')}`} className="drawer-contact">
                  <Icon name="phone" size={16} /> {settings.phone}
                </a>
              )}
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
