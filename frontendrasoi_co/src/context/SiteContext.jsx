import { createContext, useContext, useEffect, useState } from 'react';
import api from '../api/axios';

const SiteContext = createContext(null);

/** Loads Site settings + menu from Django admin once, for the whole app. */
export function SiteProvider({ children }) {
  const [settings, setSettings] = useState(null);
  const [menu, setMenu] = useState({ header: [], footer_shop: [], footer_care: [], mega_menu: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let alive = true;
    Promise.all([api.get('/settings/'), api.get('/menu/')])
      .then(([s, m]) => {
        if (!alive) return;
        setSettings(s.data);
        setMenu(m.data);
      })
      .catch((err) => alive && setError(err))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (!settings) return;
    if (settings.favicon) {
      let link = document.querySelector("link[rel='icon']");
      if (!link) {
        link = document.createElement('link');
        link.rel = 'icon';
        document.head.appendChild(link);
      }
      link.href = settings.favicon;
    }
  }, [settings]);

  return (
    <SiteContext.Provider value={{ settings, menu, loading, error }}>
      {children}
    </SiteContext.Provider>
  );
}

export const useSite = () => useContext(SiteContext);
