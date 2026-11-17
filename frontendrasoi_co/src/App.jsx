import { lazy } from 'react';
import { Route, Routes } from 'react-router-dom';
import Layout from './components/layout/Layout';
import { ProtectedRoute } from './components/ui/RouteHelpers';

// Lazy-loaded pages (each page becomes its own small JS file → faster first load)
const Home = lazy(() => import('./pages/Home'));
const Shop = lazy(() => import('./pages/Shop'));
const DynamicPage = lazy(() => import('./pages/DynamicPage'));
const ProductDetail = lazy(() => import('./pages/ProductDetail'));
const Cart = lazy(() => import('./pages/Cart'));
const Checkout = lazy(() => import('./pages/Checkout'));
const OrderSuccess = lazy(() => import('./pages/OrderSuccess'));
const Account = lazy(() => import('./pages/Account'));
const Login = lazy(() => import('./pages/Auth').then((m) => ({ default: m.Login })));
const Register = lazy(() => import('./pages/Auth').then((m) => ({ default: m.Register })));
const ForgotPassword = lazy(() => import('./pages/Auth').then((m) => ({ default: m.ForgotPassword })));
const ResetPassword = lazy(() => import('./pages/Auth').then((m) => ({ default: m.ResetPassword })));
const FAQPage = lazy(() => import('./pages/InfoPages').then((m) => ({ default: m.FAQPage })));
const ContactPage = lazy(() => import('./pages/InfoPages').then((m) => ({ default: m.ContactPage })));
const NotFound = lazy(() => import('./pages/InfoPages').then((m) => ({ default: m.NotFound })));

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Home />} />
        <Route path="category/:slug" element={<Shop mode="category" />} />
        <Route path="search" element={<Shop mode="search" />} />
        <Route path="product/:slug" element={<ProductDetail />} />
        <Route path="cart" element={<Cart />} />
        <Route path="checkout" element={<ProtectedRoute><Checkout /></ProtectedRoute>} />
        <Route path="order-success/:orderNumber" element={<ProtectedRoute><OrderSuccess /></ProtectedRoute>} />
        <Route path="account" element={<ProtectedRoute><Account /></ProtectedRoute>} />
        <Route path="account/:tab" element={<ProtectedRoute><Account /></ProtectedRoute>} />
        <Route path="login" element={<Login />} />
        <Route path="register" element={<Register />} />
        <Route path="forgot-password" element={<ForgotPassword />} />
        <Route path="reset-password/:uid/:token" element={<ResetPassword />} />
        <Route path="faq" element={<FAQPage />} />
        <Route path="contact" element={<ContactPage />} />
        {/* Pages created in Django admin: /shop, /new-arrivals, /offers, /about, /diwali-deals … */}
        <Route path=":slug" element={<DynamicPage />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}
