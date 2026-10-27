import { lazy, Suspense, useEffect, useState } from 'react';
import LandingPage from './LandingPage.jsx';

const InvestmentMap = lazy(() => import('./App.jsx'));
const SiteAdmin = lazy(() => import('./admin/Dashboard.jsx'));
const SiteEditor = lazy(() => import('./admin/SiteEditor.jsx'));
const DataWorkspace = lazy(() => import('./workspace/DataWorkspace.jsx'));
const AdminDemo = lazy(() => import('./demo/AdminDemo.jsx'));
const isMapRoute = () => window.location.hash === '#/map' || window.location.hash.startsWith('#ltip-');
const isAdminRoute = () => /^#\/admin(?:\/|$|\?)/.test(window.location.hash);

export default function PlatformRouter() {
  const [showMap, setShowMap] = useState(isMapRoute);
  const [admin, setAdmin] = useState(isAdminRoute);
  const [route, setRoute] = useState(() => window.location.hash);
  useEffect(() => {
    let accepted = window.location.hash;
    const onHashChange = () => {
      if (!window.dispatchEvent(new Event('ltip:before-navigate', { cancelable: true }))) {
        window.history.replaceState(null, '', accepted);
        return;
      }
      accepted = window.location.hash;
      setRoute(accepted); setShowMap(isMapRoute()); setAdmin(isAdminRoute());
    };
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);
  useEffect(() => { window.scrollTo(0, 0); }, [showMap]);

  if (route.startsWith('#/workspace')) return <Suspense fallback={<p dir="rtl">جار تحميل مساحة العمل…</p>}><DataWorkspace route={route}/></Suspense>;
  if (admin) return <Suspense fallback={<p dir="rtl">جار تحميل الإدارة…</p>}>{/^#\/admin\/sites(?:\/|$)/.test(route) && route !== '#/admin/sites' ? <SiteEditor key={route} route={route}/> : <SiteAdmin key={route}/>}</Suspense>;
  if (route === '#/admin-demo') return <Suspense fallback={<p dir="rtl">جار تحميل العرض الإداري…</p>}><AdminDemo /></Suspense>;
  if (!showMap) return <LandingPage />;
  return <Suspense fallback={<p role="status" dir="rtl">جار تحميل الخارطة الاستثمارية...</p>}>
    <InvestmentMap />
  </Suspense>;
}
