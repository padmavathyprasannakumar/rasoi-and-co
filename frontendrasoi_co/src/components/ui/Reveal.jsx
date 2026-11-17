import { motion } from 'framer-motion';

const EASE = [0.22, 1, 0.36, 1];

/** Fade + slide up when the element scrolls into view. */
export function Reveal({ children, delay = 0, y = 28, className = '', as = 'div', ...rest }) {
  const Tag = motion[as] || motion.div;
  return (
    <Tag
      className={className}
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.15 }}
      transition={{ duration: 0.7, ease: EASE, delay }}
      {...rest}
    >
      {children}
    </Tag>
  );
}

/** Parent that staggers its <StaggerItem> children. */
export function Stagger({ children, className = '', stagger = 0.08, as = 'div', ...rest }) {
  const Tag = motion[as] || motion.div;
  return (
    <Tag
      className={className}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, amount: 0.1 }}
      variants={{ hidden: {}, show: { transition: { staggerChildren: stagger } } }}
      {...rest}
    >
      {children}
    </Tag>
  );
}

export function StaggerItem({ children, className = '', as = 'div', ...rest }) {
  const Tag = motion[as] || motion.div;
  return (
    <Tag
      className={className}
      variants={{
        hidden: { opacity: 0, y: 26 },
        show: { opacity: 1, y: 0, transition: { duration: 0.6, ease: EASE } },
      }}
      {...rest}
    >
      {children}
    </Tag>
  );
}

export default Reveal;
