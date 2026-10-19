import { lazy, Suspense, useEffect, useState } from 'react';
import LandingPage from './LandingPage.jsx';

const InvestmentMap = lazy(() => import('./App.jsx'));
const isMapRoute = () => window.location.hash === '#/map' || window.location.hash.startsWith('#ltip-');

export default function PlatformRouter() {
  const [showMap, setShowMap] = useState(isMapRoute);
  useEffect(() => {
    const onHashChange = () => setShowMap(isMapRoute());
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);
  useEffect(() => { window.scrollTo(0, 0); }, [showMap]);

  if (!showMap) return <LandingPage />;
  return <Suspense fallback={<p role="status" dir="rtl">جار تحميل الخارطة الاستثمارية...</p>}>
    <InvestmentMap />
  </Suspense>;
}
