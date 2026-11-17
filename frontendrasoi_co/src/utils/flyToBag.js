import { prefersReducedMotion } from './image';

/**
 * "Fly to bag" animation: clones the product image and flies it into the bag icon.
 * Call with the <img> (or any element) that was clicked near.
 */
export function flyToBag(sourceEl) {
  const target = document.getElementById('bag-icon');
  if (!sourceEl || !target || prefersReducedMotion()) {
    bumpBag(target);
    return;
  }
  const from = sourceEl.getBoundingClientRect();
  const to = target.getBoundingClientRect();
  const size = Math.min(from.width, from.height, 140);

  const ghost = document.createElement('div');
  ghost.className = 'fly-ghost';
  const img = sourceEl.tagName === 'IMG' ? sourceEl : sourceEl.querySelector('img');
  if (img?.src) ghost.style.backgroundImage = `url("${img.currentSrc || img.src}")`;
  Object.assign(ghost.style, {
    left: `${from.left + from.width / 2 - size / 2}px`,
    top: `${from.top + from.height / 2 - size / 2}px`,
    width: `${size}px`,
    height: `${size}px`,
  });
  document.body.appendChild(ghost);

  const dx = to.left + to.width / 2 - (from.left + from.width / 2);
  const dy = to.top + to.height / 2 - (from.top + from.height / 2);

  const anim = ghost.animate(
    [
      { transform: 'translate(0, 0) scale(1)', opacity: 1, borderRadius: '16px' },
      { transform: `translate(${dx * 0.55}px, ${dy - 80}px) scale(0.55)`, opacity: 0.95, offset: 0.55 },
      { transform: `translate(${dx}px, ${dy}px) scale(0.12)`, opacity: 0.3, borderRadius: '50%' },
    ],
    { duration: 800, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' }
  );
  anim.onfinish = () => {
    ghost.remove();
    bumpBag(target);
  };
}

function bumpBag(target) {
  if (!target) return;
  target.classList.remove('bag-bump');
  // restart animation
  void target.offsetWidth;
  target.classList.add('bag-bump');
}
