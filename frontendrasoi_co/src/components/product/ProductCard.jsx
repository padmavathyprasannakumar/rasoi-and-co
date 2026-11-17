import { useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, useMotionValue, useSpring, useTransform } from 'framer-motion';
import { useCart } from '../../context/CartContext';
import { useWishlist } from '../../context/WishlistContext';
import Icon from '../ui/Icon';
import { Price, SmartImage, Stars } from '../ui/Primitives';
import { prefersReducedMotion } from '../../utils/image';

export default function ProductCard({ product, priority = false }) {
  const { addItem } = useCart();
  const { has, toggle } = useWishlist();
  const navigate = useNavigate();
  const imgRef = useRef(null);
  const [adding, setAdding] = useState(false);
  const [pop, setPop] = useState(0);

  // 3D tilt on hover
  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const rotateX = useSpring(useTransform(my, [-0.5, 0.5], [6, -6]), { stiffness: 200, damping: 18 });
  const rotateY = useSpring(useTransform(mx, [-0.5, 0.5], [-6, 6]), { stiffness: 200, damping: 18 });

  const onMove = (e) => {
    if (prefersReducedMotion() || e.pointerType === 'touch') return;
    const r = e.currentTarget.getBoundingClientRect();
    mx.set((e.clientX - r.left) / r.width - 0.5);
    my.set((e.clientY - r.top) / r.height - 0.5);
  };
  const onLeave = () => {
    mx.set(0);
    my.set(0);
  };

  const wished = has(product.slug);
  const label = product.badge_text || (product.is_new ? 'NEW' : product.tag ? product.tag_label : '');

  const quickAdd = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (product.has_variants) {
      navigate(`/product/${product.slug}`);
      return;
    }
    setAdding(true);
    await addItem(product, { sourceEl: imgRef.current });
    setAdding(false);
  };

  const onHeart = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setPop((p) => p + 1);
    toggle(product);
  };

  return (
    <motion.article
      className="product-card"
      style={{ rotateX, rotateY, transformPerspective: 900 }}
      onPointerMove={onMove}
      onPointerLeave={onLeave}
      whileHover={{ y: -6 }}
      transition={{ type: 'spring', stiffness: 260, damping: 22 }}
    >
      <Link to={`/product/${product.slug}`} className="card-media" aria-label={product.name}>
        <SmartImage src={product.image} alt={product.name} width={600} eager={priority} className="card-img" imgRef={imgRef} />
        {product.hover_image && <SmartImage src={product.hover_image} alt="" width={600} className="card-img card-img-hover" />}
        {label && <span className="card-badge">{label}</span>}
        {!product.in_stock && <span className="card-badge card-badge-muted">Out of stock</span>}
        <motion.button
          key={pop}
          className={`heart-btn ${wished ? 'is-on' : ''}`}
          onClick={onHeart}
          aria-label={wished ? 'Remove from wishlist' : 'Save to wishlist'}
          aria-pressed={wished}
          initial={pop ? { scale: 0.6 } : false}
          animate={{ scale: [1.35, 0.9, 1] }}
          transition={{ duration: 0.45 }}
        >
          <Icon name="heart" size={17} fill={wished ? 'currentColor' : 'none'} />
        </motion.button>
        {product.in_stock && (
          <button className="quick-add" onClick={quickAdd} disabled={adding}>
            <Icon name={product.has_variants ? 'arrowRight' : 'plus'} size={15} />
            <span>{product.has_variants ? 'Choose options' : adding ? 'Adding…' : 'Quick add'}</span>
          </button>
        )}
      </Link>
      <div className="card-body">
        <span className="card-eyebrow">
          {product.category?.name}
          {product.brand ? ` · ${product.brand.name}` : ''}
        </span>
        <h3 className="card-title">
          <Link to={`/product/${product.slug}`}>{product.name}</Link>
        </h3>
        <Price price={product.sale_price} mrp={product.mrp} size="sm" />
        <div className="card-meta">
          {product.rating_avg ? <Stars value={product.rating_avg} count={product.review_count} size={12} /> : null}
          {product.capacity && <span className="card-chip">{product.capacity}</span>}
          {product.wattage && <span className="card-chip">{product.wattage}</span>}
        </div>
      </div>
    </motion.article>
  );
}
