import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { MotionConfig } from 'framer-motion';
import App from './App.jsx';
import { ToastProvider } from './context/ToastContext';
import { SiteProvider } from './context/SiteContext';
import { AuthProvider } from './context/AuthContext';
import { CartProvider } from './context/CartContext';
import { WishlistProvider } from './context/WishlistContext';
import './styles/global.css';
import './styles/layout.css';
import './styles/components.css';
import './styles/pages.css';

// Button ripple micro-interaction (works for every .btn on the site)
document.addEventListener('pointerdown', (e) => {
  const btn = e.target.closest?.('.btn');
  if (!btn || btn.disabled || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const rect = btn.getBoundingClientRect();
  const size = Math.max(rect.width, rect.height);
  const ripple = document.createElement('span');
  ripple.className = 'ripple';
  ripple.style.width = ripple.style.height = `${size}px`;
  ripple.style.left = `${e.clientX - rect.left - size / 2}px`;
  ripple.style.top = `${e.clientY - rect.top - size / 2}px`;
  btn.appendChild(ripple);
  setTimeout(() => ripple.remove(), 650);
});

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <MotionConfig reducedMotion="user">
        <ToastProvider>
          <SiteProvider>
            <AuthProvider>
              <CartProvider>
                <WishlistProvider>
                  <App />
                </WishlistProvider>
              </CartProvider>
            </AuthProvider>
          </SiteProvider>
        </ToastProvider>
      </MotionConfig>
    </BrowserRouter>
  </StrictMode>
);
