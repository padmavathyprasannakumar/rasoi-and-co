import { useEffect, useRef, useState } from 'react';

/**
 * true once the page is scrolled down (used to shrink the header and hide its search bar).
 *
 * Anti-blink: shrinking the header makes the page shorter, which can push the scroll back up
 * and expand it again — an endless flicker on short pages (Sign in, Sign up, Cart).
 * So: different thresholds for collapse / expand, and never collapse on pages that are
 * barely taller than the screen.
 */
export default function useScrolled(offset = 40) {
  const [scrolled, setScrolled] = useState(false);
  const state = useRef(false);

  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      const y = window.scrollY;
      const room = document.documentElement.scrollHeight - window.innerHeight; // how far the page can scroll
      let next = state.current;
      if (!state.current && y > offset + 40 && room > 260) next = true; // collapse
      else if (state.current && y < 8) next = false; // expand only near the very top
      if (next !== state.current) {
        state.current = next;
        setScrolled(next);
      }
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [offset]);

  return scrolled;
}