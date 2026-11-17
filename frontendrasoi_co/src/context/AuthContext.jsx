import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import api, { tokenStore } from '../api/axios';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(!!tokenStore.getAccess() || !!tokenStore.getRefresh());

  const loadMe = useCallback(async () => {
    if (!tokenStore.getAccess() && !tokenStore.getRefresh()) {
      setLoading(false);
      return;
    }
    try {
      const { data } = await api.get('/auth/me/');
      setUser(data);
    } catch {
      tokenStore.clear();
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadMe();
    const onLogout = () => setUser(null);
    window.addEventListener('auth:logout', onLogout);
    return () => window.removeEventListener('auth:logout', onLogout);
  }, [loadMe]);

  const login = async (username, password) => {
    const { data } = await api.post('/auth/login/', { username, password });
    tokenStore.set(data);
    setUser(data.user);
    return data.user;
  };

  const register = async (payload) => {
    const { data } = await api.post('/auth/register/', payload);
    tokenStore.set(data);
    setUser(data.user);
    return data.user;
  };

  const logout = () => {
    tokenStore.clear();
    setUser(null);
  };

  const updateProfile = async (payload) => {
    const { data } = await api.patch('/auth/me/', payload);
    setUser(data);
    return data;
  };

  return (
    <AuthContext.Provider value={{ user, loading, isAuthenticated: !!user, login, register, logout, updateProfile, reload: loadMe }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
