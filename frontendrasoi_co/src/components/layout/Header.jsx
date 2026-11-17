import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { useSite } from '../../context/SiteContext';
import { useAuth } from '../../context/AuthContext';
import { useCart } from '../../context/CartContext';
import { useWishlist } from '../../context/WishlistContext';
import useScrolled from '../../hooks/useScrolled';
import Icon from '../ui/Icon';
import { Logo } from '../ui/Primitives';
import MegaMenu from './MegaMenu';
import SearchBar from './SearchBar';
import MobileDrawer from './MobileDrawer';

const FALLBACK_LINKS = [
  { label: 'Home', url: '/' },
  { label: 'Collections', url: '/shop', has_mega_menu: true },
  { label: 'New arrivals', url: '/new-arrivals' },
  { label: 'Offers', url: '/offers' },
  { label: 'Our story', url: '/about' },
];

export default function Header() {
  const { settings, menu } = useSite();
  const { user } = useAuth();
  const { count, setDrawerOpen } = useCart();
  const { count: wishCount } = useWishlist();
  const scrolled = useScrolled(30);
  const [megaOpen, setMegaOpen] = useState(false);
  const [drawerOpen, setMobileOpen] = useState(false);
  const [mobileSearch, setMobileSearch] = useState(false);
  const location = useLocation();
  const closeTimer = useRef(null);

  const links = menu?.header?.length ? menu.header : FALLBACK_LINKS;

  useEffect(() => {
    setMegaOpen(false);
    setMobileOpen(false);
    setMobileSearch(false);
  }, [location.pathname]);

  const openMega = () => {
    clearTimeout(closeTimer.current);
    setMegaOpen(true);
  };
  const closeMega = () => {
    closeTimer.current = setTimeout(() => setMegaOpen(false), 160);
  };

  const openAI = () => window.dispatchEvent(new Event('open-ask-ai'));

  return (
    <>
      <header className={`site-header ${scrolled ? 'is-scrolled' : ''}`}>
        <div className="container header-main">
          <button className="icon-btn hamburger" onClick={() => setMobileOpen(true)} aria-label="Open menu">
            <Icon name="menu" size={22} />
          </button>

          <Logo settings={settings} compact={scrolled} />

          <nav className="main-nav" aria-label="Main">
            {links.map((l) =>
              l.has_mega_menu ? (
                <div key={l.label} className="nav-mega-wrap" onMouseEnter={openMega} onMouseLeave={closeMega}>
                  <NavLink
                    to={l.url}
                    className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
                    onFocus={openMega}
                    aria-haspopup="true"
                    aria-expanded={megaOpen}
                  >
                    <Icon name="chevronDown" size={13} className={`nav-caret ${megaOpen ? 'open' : ''}`} />
                    {l.label}
                  </NavLink>
                </div>
              ) : (
                <NavLink
                  key={l.label}
                  to={l.url}
                  end={l.url === '/'}
                  className={({ isActive }) => `nav-link ${isActive ? 'active' : ''} ${l.is_highlighted ? 'nav-highlight' : ''}`}
                >
                  {l.label}
                </NavLink>
              )
            )}
          </nav>

          <div className="header-actions">
            <button className="ai-pill" onClick={openAI}>
              <Icon name="spark" size={14} /> <span>Ask AI</span>
            </button>
            <button className="icon-btn mobile-only" onClick={() => setMobileSearch((v) => !v)} aria-label="Search">
              <Icon name="search" size={20} />
            </button>
            <Link to="/account/wishlist" className="icon-btn desktop-only" aria-label={`Wishlist, ${wishCount} items`}>
              <Icon name="heart" size={20} />
              {wishCount > 0 && <span className="badge-count badge-soft">{wishCount}</span>}
            </Link>
            <Link to={user ? '/account' : '/login'} className="icon-btn header-account" aria-label={user ? 'My account' : 'Sign in'}>
              <Icon name="user" size={20} />
              <span className="desktop-only header-account-label">{user ? user.first_name || 'Account' : 'Sign in'}</span>
            </Link>
            <button id="bag-icon" className="icon-btn bag-btn" onClick={() => setDrawerOpen(true)} aria-label={`Bag, ${count} items`}>
              <Icon name="bag" size={20} />
              <span className="desktop-only">Bag</span>
              <AnimatePresence>
                {count > 0 && (
                  <motion.span
                    key={count}
                    className="badge-count"
                    initial={{ scale: 0.4, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.4, opacity: 0 }}
                    transition={{ type: 'spring', stiffness: 500, damping: 18 }}
                  >
                    {count}
                  </motion.span>
                )}
              </AnimatePresence>
            </button>
          </div>
        </div>

        <div className={`header-search ${scrolled ? 'collapsed' : ''} ${mobileSearch ? 'mobile-open' : ''}`}>
          <div className="container">
            <SearchBar autoFocus={mobileSearch} onDone={() => setMobileSearch(false)} />
          </div>
        </div>

        <AnimatePresence>
          {megaOpen && (
            <div className="mega-anchor" onMouseEnter={openMega} onMouseLeave={closeMega}>
              <MegaMenu onNavigate={() => setMegaOpen(false)} />
            </div>
          )}
        </AnimatePresence>
      </header>

      <MobileDrawer open={drawerOpen} onClose={() => setMobileOpen(false)} links={links} />
    </>
  );
}
