import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import api from '../../api/axios';
import useDebounce from '../../hooks/useDebounce';
import Icon from '../ui/Icon';
import { SmartImage } from '../ui/Primitives';
import { formatPrice } from '../../utils/formatPrice';

export default function SearchBar({ autoFocus = false, onDone }) {
  const [q, setQ] = useState('');
  const [results, setResults] = useState({ products: [], categories: [] });
  const [open, setOpen] = useState(false);
  const debounced = useDebounce(q, 250);
  const navigate = useNavigate();
  const boxRef = useRef(null);

  useEffect(() => {
    if (debounced.trim().length < 2) {
      setResults({ products: [], categories: [] });
      return;
    }
    let alive = true;
    api
      .get('/search/suggest/', { params: { q: debounced } })
      .then(({ data }) => alive && setResults(data))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [debounced]);

  useEffect(() => {
    const close = (e) => boxRef.current && !boxRef.current.contains(e.target) && setOpen(false);
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  const submit = (e) => {
    e.preventDefault();
    if (!q.trim()) return;
    setOpen(false);
    navigate(`/search?q=${encodeURIComponent(q.trim())}`);
    onDone?.();
  };

  const finish = () => {
    setOpen(false);
    setQ('');
    onDone?.();
  };

  const hasResults = results.products.length > 0 || results.categories.length > 0;

  return (
    <div className="searchbar" ref={boxRef}>
      <form onSubmit={submit} role="search">
        <Icon name="search" size={18} className="searchbar-icon" />
        <label htmlFor="site-search" className="sr-only">Search appliances</label>
        <input
          id="site-search"
          type="search"
          value={q}
          autoFocus={autoFocus}
          onChange={(e) => {
            setQ(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder="Search mixer grinders, air fryers, chimneys and more…"
          autoComplete="off"
        />
        <button type="submit" className="btn btn-primary searchbar-btn">Search</button>
      </form>
      <AnimatePresence>
        {open && hasResults && (
          <motion.div
            className="search-suggest"
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
          >
            {results.categories.length > 0 && (
              <div className="suggest-cats">
                {results.categories.map((c) => (
                  <Link key={c.slug} to={`/category/${c.slug}`} onClick={finish} className="chip">
                    {c.name}
                  </Link>
                ))}
              </div>
            )}
            {results.products.map((p) => (
              <Link key={p.slug} to={`/product/${p.slug}`} className="suggest-item" onClick={finish}>
                <SmartImage src={p.image} alt={p.name} width={120} className="suggest-img" sizes="56px" />
                <span className="suggest-name">{p.name}</span>
                <span className="suggest-price">{formatPrice(p.sale_price)}</span>
              </Link>
            ))}
            <button className="suggest-all" onClick={submit}>
              See all results for “{q}” <Icon name="arrowRight" size={14} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
