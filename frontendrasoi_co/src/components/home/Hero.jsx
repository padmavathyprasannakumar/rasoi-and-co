import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { AnimatePresence, motion, useMotionValue, useSpring, useTransform } from 'framer-motion';
import Icon from '../ui/Icon';
import { SmartImage } from '../ui/Primitives';
import { isLowEndDevice, prefersReducedMotion } from '../../utils/image';

const ModelViewer = lazy(() => import('./ModelViewer'));
const EASE = [0.22, 1, 0.36, 1];

function useVisible(ref) {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    if (!ref.current) return undefined;
    const io = new IntersectionObserver(([entry]) => entry.isIntersecting && setVisible(true), { rootMargin: '100px' });
    io.observe(ref.current);
    return () => io.disconnect();
  }, [ref]);
  return visible;
}

const STEAM = Array.from({ length: 10 }, (_, i) => ({ left: `${10 + i * 8}%`, delay: `${i * 0.6}s`, dur: `${5 + (i % 4)}s` }));

export default function Hero({ slides = [] }) {
  const [index, setIndex] = useState(0);
  const mediaRef = useRef(null);
  const visible = useVisible(mediaRef);
  const can3d = typeof window !== 'undefined' && !isLowEndDevice() && !prefersReducedMotion();

  // Mouse parallax on the image card
  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const rx = useSpring(useTransform(my, [-0.5, 0.5], [5, -5]), { stiffness: 120, damping: 20 });
  const ry = useSpring(useTransform(mx, [-0.5, 0.5], [-7, 7]), { stiffness: 120, damping: 20 });

  useEffect(() => {
    if (slides.length < 2) return undefined;
    const t = setInterval(() => setIndex((i) => (i + 1) % slides.length), 7000);
    return () => clearInterval(t);
  }, [slides.length]);

  const slide = slides[index] || {
    eyebrow: 'THE RASOI EDIT',
    title: 'Smart kitchens,',
    italic_subtitle: 'beautifully made.',
    description: 'Appliances chosen for Indian homes — powerful, beautiful and built to last.',
    button_text: 'Find your next favourite',
    button_link: '/shop',
    secondary_button_text: 'Discover new arrivals',
    secondary_button_link: '/new-arrivals',
  };

  const show3d = can3d && visible && (slide.model_3d || !slide.image);

  return (
    <section className="hero">
      <div className="container hero-grid">
        <AnimatePresence mode="wait">
          <motion.div
            key={index}
            className="hero-copy"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.8, ease: EASE }}
          >
            <span className="eyebrow">{slide.eyebrow}</span>
            <h1 className="hero-title">
              {slide.title} {slide.italic_subtitle && <em>{slide.italic_subtitle}</em>}
            </h1>
            {slide.description && <p className="hero-desc">{slide.description}</p>}
            <div className="hero-actions">
              <Link to={slide.button_link || '/shop'} className="btn btn-primary btn-lg">
                {slide.button_text} <Icon name="arrowUpRight" size={15} />
              </Link>
              {slide.secondary_button_text && (
                <Link to={slide.secondary_button_link || '/new-arrivals'} className="btn btn-ghost hero-secondary">
                  {slide.secondary_button_text} <Icon name="arrowRight" size={15} />
                </Link>
              )}
            </div>
          </motion.div>
        </AnimatePresence>

        <motion.div
          ref={mediaRef}
          className="hero-media"
          style={{ rotateX: rx, rotateY: ry, transformPerspective: 1100 }}
          onPointerMove={(e) => {
            const r = e.currentTarget.getBoundingClientRect();
            mx.set((e.clientX - r.left) / r.width - 0.5);
            my.set((e.clientY - r.top) / r.height - 0.5);
          }}
          onPointerLeave={() => {
            mx.set(0);
            my.set(0);
          }}
          initial={{ opacity: 0, scale: 0.94 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 1, ease: EASE, delay: 0.15 }}
        >
          <div className="hero-media-bg" />
          <div className="hero-steam" aria-hidden="true">
            {STEAM.map((s, i) => (
              <span key={i} style={{ left: s.left, animationDelay: s.delay, animationDuration: s.dur }} />
            ))}
          </div>
          {show3d ? (
            <Suspense fallback={<SmartImage src={slide.image} alt={slide.title} width={1100} eager className="hero-img" />}>
              <div className="hero-3d">
                <ModelViewer url={slide.model_3d} parallax />
              </div>
            </Suspense>
          ) : (
            <AnimatePresence mode="wait">
              <motion.div key={slide.image || 'ph'} className="hero-img-wrap" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <SmartImage src={slide.image} alt={`${slide.title} ${slide.italic_subtitle || ''}`} width={1100} eager className="hero-img" sizes="(max-width: 1024px) 100vw, 50vw" />
              </motion.div>
            </AnimatePresence>
          )}
          {slide.badge_text && (
            <motion.div className="hero-badge" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.8 }}>
              <span className="eyebrow">Just in</span>
              <strong>{slide.badge_text}</strong>
            </motion.div>
          )}
        </motion.div>
      </div>

      {slides.length > 1 && (
        <div className="hero-dots" role="tablist" aria-label="Hero slides">
          {slides.map((s, i) => (
            <button key={s.id} className={i === index ? 'active' : ''} onClick={() => setIndex(i)} aria-label={`Slide ${i + 1}`} aria-selected={i === index} role="tab" />
          ))}
        </div>
      )}
    </section>
  );
}
