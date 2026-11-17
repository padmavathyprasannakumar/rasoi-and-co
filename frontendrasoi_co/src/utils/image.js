/**
 * Cloudinary helpers: resize on the fly and build srcset for responsive images.
 * Works with plain URLs too (local /media/ images are returned unchanged).
 */
export function cldUrl(url, width) {
  if (!url || !width || !url.includes('res.cloudinary.com') || !url.includes('/image/upload/')) return url;
  if (url.includes('/f_auto,q_auto/')) {
    return url.replace('/f_auto,q_auto/', `/f_auto,q_auto,w_${width},c_limit/`);
  }
  return url.replace('/image/upload/', `/image/upload/f_auto,q_auto,w_${width},c_limit/`);
}

export function cldSrcSet(url, widths = [320, 480, 640, 960, 1280]) {
  if (!url || !url.includes('res.cloudinary.com')) return undefined;
  return widths.map((w) => `${cldUrl(url, w)} ${w}w`).join(', ');
}

/** Is this a low-end device? Used to skip 3D. */
export function isLowEndDevice() {
  if (typeof navigator === 'undefined') return true;
  const cores = navigator.hardwareConcurrency || 2;
  const memory = navigator.deviceMemory || 4;
  const saveData = navigator.connection?.saveData;
  return cores < 4 || memory < 4 || !!saveData;
}

export function prefersReducedMotion() {
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
}
