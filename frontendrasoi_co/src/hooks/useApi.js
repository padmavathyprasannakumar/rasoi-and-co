import { useCallback, useEffect, useState } from 'react';
import api from '../api/axios';

/**
 * const { data, loading, error, reload } = useApi('/products/', { params: {...} })
 * Pass null as url to skip.
 */
export default function useApi(url, options = {}) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(!!url);
  const [error, setError] = useState(null);
  const key = JSON.stringify(options.params || {});

  const load = useCallback(async () => {
    if (!url) return;
    setLoading(true);
    setError(null);
    try {
      const res = await api.get(url, { params: JSON.parse(key) });
      setData(res.data);
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [url, key]);

  useEffect(() => {
    load();
  }, [load]);

  return { data, loading, error, reload: load, setData };
}
