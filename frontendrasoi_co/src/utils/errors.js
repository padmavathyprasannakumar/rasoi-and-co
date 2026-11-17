/** Turn a DRF error response into a readable message + per-field errors. */
export function parseApiError(err, fallback = 'Something went wrong. Please try again.') {
  const data = err?.response?.data;
  if (!data) {
    return { message: err?.message === 'Network Error' ? 'Cannot reach the server. Is the backend running?' : fallback, fields: {} };
  }
  if (typeof data === 'string') return { message: fallback, fields: {} };
  const fields = {};
  let message = data.detail || '';
  Object.entries(data).forEach(([key, value]) => {
    if (key === 'detail') return;
    const text = Array.isArray(value) ? value.join(' ') : typeof value === 'object' ? JSON.stringify(value) : String(value);
    if (key === 'non_field_errors') message = message || text;
    else fields[key] = text;
  });
  if (!message) message = Object.values(fields)[0] || fallback;
  return { message, fields };
}
