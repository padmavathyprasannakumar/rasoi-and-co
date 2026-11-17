import { useEffect, useState } from 'react';
import Icon from '../ui/Icon';

const SORTS = [
  { value: 'newest', label: 'Newest first' },
  { value: 'popular', label: 'Most popular' },
  { value: 'price_low', label: 'Price: low to high' },
  { value: 'price_high', label: 'Price: high to low' },
  { value: 'rating', label: 'Top rated' },
];

/**
 * "Refine your edit" panel. Works on desktop (sidebar) and mobile (slide-up drawer).
 * values: current filters from the URL. onApply(newValues)
 */
export default function FilterPanel({ values, facets, categories = [], onApply, onClear, lockCategory = false }) {
  const [form, setForm] = useState(values);
  useEffect(() => setForm(values), [values]);

  const set = (key, value) => setForm((f) => ({ ...f, [key]: value }));
  const submit = (e) => {
    e.preventDefault();
    onApply(form);
  };

  return (
    <form className="filter-panel" onSubmit={submit}>
      <h3 className="filter-title">Refine your <em>edit</em></h3>

      <label className="label" htmlFor="f-q">Search</label>
      <input id="f-q" className="input" placeholder="Product name" value={form.q || ''} onChange={(e) => set('q', e.target.value)} />

      {!lockCategory && (
        <>
          <label className="label" htmlFor="f-cat">Collection</label>
          <select id="f-cat" className="select" value={form.category || ''} onChange={(e) => set('category', e.target.value)}>
            <option value="">All collections</option>
            {categories.map((c) => (
              <option key={c.slug} value={c.slug}>{c.name}</option>
            ))}
          </select>
        </>
      )}

      <label className="label" htmlFor="f-brand">Brand</label>
      <select id="f-brand" className="select" value={form.brand || ''} onChange={(e) => set('brand', e.target.value)}>
        <option value="">All brands</option>
        {(facets?.brands || []).map((b) => (
          <option key={b.slug} value={b.slug}>{b.name} ({b.count})</option>
        ))}
      </select>

      {facets?.capacities?.length > 0 && (
        <>
          <label className="label" htmlFor="f-cap">Capacity / size</label>
          <select id="f-cap" className="select" value={form.capacity || ''} onChange={(e) => set('capacity', e.target.value)}>
            <option value="">Any capacity</option>
            {facets.capacities.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </>
      )}

      {facets?.colours?.length > 0 && (
        <>
          <label className="label" htmlFor="f-col">Colour</label>
          <select id="f-col" className="select" value={form.colour || ''} onChange={(e) => set('colour', e.target.value)}>
            <option value="">Any colour</option>
            {facets.colours.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </>
      )}

      <span className="label">Price (₹)</span>
      <div className="price-inputs">
        <input
          className="input"
          inputMode="numeric"
          placeholder={facets?.price_min ? `Min ₹${Math.floor(facets.price_min)}` : 'Min'}
          value={form.min_price || ''}
          onChange={(e) => set('min_price', e.target.value.replace(/\D/g, ''))}
          aria-label="Minimum price in rupees"
        />
        <span>–</span>
        <input
          className="input"
          inputMode="numeric"
          placeholder={facets?.price_max ? `Max ₹${Math.ceil(facets.price_max)}` : 'Max'}
          value={form.max_price || ''}
          onChange={(e) => set('max_price', e.target.value.replace(/\D/g, ''))}
          aria-label="Maximum price in rupees"
        />
      </div>
      <div className="price-quick">
        {[[0, 2000], [2000, 5000], [5000, 15000], [15000, 50000], [50000, '']].map(([a, b]) => (
          <button
            type="button"
            key={`${a}-${b}`}
            className={`chip ${String(form.min_price || '') === String(a || '') && String(form.max_price || '') === String(b) ? 'chip-active' : ''}`}
            onClick={() => setForm((f) => ({ ...f, min_price: a ? String(a) : '', max_price: b ? String(b) : '' }))}
          >
            {b ? `₹${a.toLocaleString('en-IN')}–${Number(b).toLocaleString('en-IN')}` : `₹${a.toLocaleString('en-IN')}+`}
          </button>
        ))}
      </div>

      <label className="label" htmlFor="f-sort">Sort by</label>
      <select id="f-sort" className="select" value={form.sort || 'newest'} onChange={(e) => set('sort', e.target.value)}>
        {SORTS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
      </select>

      <label className="check">
        <input type="checkbox" checked={form.in_stock === 'true'} onChange={(e) => set('in_stock', e.target.checked ? 'true' : '')} />
        <span>In stock only</span>
      </label>
      <label className="check">
        <input type="checkbox" checked={form.on_sale === 'true'} onChange={(e) => set('on_sale', e.target.checked ? 'true' : '')} />
        <span>On offer</span>
      </label>

      <button type="submit" className="btn btn-primary btn-block">
        <Icon name="filter" size={15} /> Apply filters
      </button>
      <button type="button" className="btn btn-ghost btn-block" onClick={onClear}>Clear all</button>
    </form>
  );
}

export { SORTS };
