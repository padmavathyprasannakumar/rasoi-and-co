// Indian Rupee formatter: ₹1,499 · ₹24,999 · ₹1,49,999 (lakh format)
const inr = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

const inrWithPaise = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/**
 * formatPrice(1499)                    -> "₹1,499"
 * formatPrice("149999.00")             -> "₹1,49,999"
 * formatPrice(1499.5, { paise: true }) -> "₹1,499.50"
 */
export function formatPrice(value, { paise = false } = {}) {
  if (value === null || value === undefined || value === '') return '';
  const num = Number(value);
  if (Number.isNaN(num)) return '';
  return (paise ? inrWithPaise : inr).format(num);
}

/** discountPercent(5999, 3499) -> 42 */
export function discountPercent(mrp, salePrice) {
  const m = Number(mrp);
  const s = Number(salePrice);
  if (!m || !s || s >= m) return 0;
  return Math.round(((m - s) / m) * 100);
}

/** formatDate("2026-11-16T10:30:00Z") -> "16/11/2026" */
export function formatDate(value) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: 'Asia/Kolkata',
  }).format(d);
}

/** formatPhone("9876543210") -> "+91 98765 43210" */
export function formatPhone(value) {
  if (!value) return '';
  const digits = String(value).replace(/\D/g, '').slice(-10);
  if (digits.length !== 10) return value;
  return `+91 ${digits.slice(0, 5)} ${digits.slice(5)}`;
}

/** addDays(new Date(), 4) -> estimated delivery date */
export function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + Number(days || 0));
  return d;
}
