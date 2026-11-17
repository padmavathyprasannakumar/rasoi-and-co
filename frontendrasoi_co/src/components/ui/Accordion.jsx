import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import Icon from './Icon';

export default function Accordion({ items, defaultOpen = 0, html = false }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="accordion">
      {items.map((item, i) => {
        const isOpen = open === i;
        return (
          <div className={`acc-item ${isOpen ? 'open' : ''}`} key={item.id ?? i}>
            <button
              className="acc-head"
              onClick={() => setOpen(isOpen ? -1 : i)}
              aria-expanded={isOpen}
              type="button"
            >
              <span>{item.title}</span>
              <Icon name="chevronDown" size={18} className="acc-chevron" />
            </button>
            <AnimatePresence initial={false}>
              {isOpen && (
                <motion.div
                  className="acc-body"
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
                >
                  {html ? (
                    <div className="acc-inner rich-text" dangerouslySetInnerHTML={{ __html: item.content }} />
                  ) : (
                    <div className="acc-inner">{item.content}</div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        );
      })}
    </div>
  );
}
