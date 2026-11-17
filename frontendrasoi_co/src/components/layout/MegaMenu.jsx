import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useSite } from '../../context/SiteContext';
import Icon from '../ui/Icon';

export default function MegaMenu({ onNavigate }) {
  const { menu } = useSite();
  const groups = menu?.mega_menu || [];
  return (
    <motion.div
      className="mega-menu"
      initial={{ opacity: 0, y: -10, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -8, scale: 0.98 }}
      transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
    >
      <div className="mega-inner">
        <div className="mega-col mega-col-feature">
          <span className="eyebrow">Explore</span>
          <Link to="/shop" onClick={onNavigate} className="mega-strong">Shop all collections</Link>
          <Link to="/new-arrivals" onClick={onNavigate}>New arrivals</Link>
          <Link to="/offers" onClick={onNavigate}>Offers & festive deals</Link>
          <Link to="/shop?sort=popular" onClick={onNavigate}>Bestsellers</Link>
        </div>
        {groups.map((g, gi) => (
          <motion.div
            key={g.title}
            className="mega-col"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 * (gi + 1) }}
          >
            <span className="mega-title">{g.title}</span>
            {g.items.map((c) => (
              <Link key={c.slug} to={`/category/${c.slug}`} onClick={onNavigate}>
                {c.name}
                {c.product_count > 0 && <small>{c.product_count}</small>}
              </Link>
            ))}
          </motion.div>
        ))}
        <Link to="/new-arrivals" className="mega-promo" onClick={onNavigate}>
          <span className="eyebrow">Just landed</span>
          <strong>
            New season <em>launches</em>
          </strong>
          <span className="mega-promo-link">
            Discover <Icon name="arrowUpRight" size={14} />
          </span>
        </Link>
      </div>
    </motion.div>
  );
}
