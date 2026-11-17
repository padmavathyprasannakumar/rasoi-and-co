import { Suspense } from 'react';
import { useLocation, useOutlet } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import AnnouncementBar from './AnnouncementBar';
import Header from './Header';
import Footer from './Footer';
import CartDrawer from './CartDrawer';
import AskAIWidget from '../ai/AskAIWidget';
import { PageTransition, ScrollToTop } from '../ui/RouteHelpers';
import { Spinner } from '../ui/Primitives';

export default function Layout() {
  const location = useLocation();
  const outlet = useOutlet();
  return (
    <>
      <a href="#main" className="skip-link">Skip to content</a>
      <ScrollToTop />
      <AnnouncementBar />
      <Header />
      <main id="main">
        <AnimatePresence mode="wait">
          <PageTransition key={location.pathname}>
            <Suspense fallback={<div className="page-loading"><Spinner /></div>}>{outlet}</Suspense>
          </PageTransition>
        </AnimatePresence>
      </main>
      <Footer />
      <CartDrawer />
      <AskAIWidget />
    </>
  );
}
