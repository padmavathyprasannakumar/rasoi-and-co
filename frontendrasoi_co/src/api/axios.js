import axios from 'axios';

export const API_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000/api';

const ACCESS_KEY = 'rasoi_access';
const REFRESH_KEY = 'rasoi_refresh';

export const tokenStore = {
  getAccess: () => localStorage.getItem(ACCESS_KEY),
  getRefresh: () => localStorage.getItem(REFRESH_KEY),
  set: ({ access, refresh }) => {
    if (access) localStorage.setItem(ACCESS_KEY, access);
    if (refresh) localStorage.setItem(REFRESH_KEY, refresh);
  },
  clear: () => {
    localStorage.removeItem(ACCESS_KEY);
    localStorage.removeItem(REFRESH_KEY);
  },
};

const api = axios.create({
  baseURL: API_URL,
  timeout: 20000,
});

// Attach the access token to every request
api.interceptors.request.use((config) => {
  const token = tokenStore.getAccess();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// If the access token expired (401), refresh it once and retry the request
let refreshPromise = null;

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config;
    const isRefreshCall = original?.url?.includes('/auth/token/refresh/');

    if (
      error.response?.status === 401 &&
      original &&
      !original._retry &&
      !isRefreshCall &&
      tokenStore.getRefresh()
    ) {
      original._retry = true;
      try {
        if (!refreshPromise) {
          refreshPromise = axios
            .post(`${API_URL}/auth/token/refresh/`, { refresh: tokenStore.getRefresh() })
            .then(({ data }) => {
              tokenStore.set(data);
              return data.access;
            })
            .finally(() => {
              refreshPromise = null;
            });
        }
        const newAccess = await refreshPromise;
        original.headers.Authorization = `Bearer ${newAccess}`;
        return api(original);
      } catch (refreshError) {
        tokenStore.clear();
        window.dispatchEvent(new Event('auth:logout'));
        return Promise.reject(refreshError);
      }
    }
    return Promise.reject(error);
  }
);

export default api;
