import { lazy, Suspense, useEffect } from 'react';
import { BrowserRouter, Route, Routes, useLocation } from 'react-router-dom';
import Home from './pages/Home';

const Portfolio = lazy(() => import('./pages/Portfolio'));

const SITE = 'https://oziel.dev';

/** One canonical URL per page, so search engines don't index www, trailing
 *  slashes or unknown paths (which render Home) as separate pages. Set only
 *  here, not in index.html, because the same HTML is served for every route. */
function CanonicalUrl() {
  const { pathname } = useLocation();
  useEffect(() => {
    const path = pathname.replace(/\/+$/, '') === '/portafolio' ? '/portafolio' : '/';
    let link = document.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (!link) {
      link = document.createElement('link');
      link.rel = 'canonical';
      document.head.appendChild(link);
    }
    link.href = SITE + path;
  }, [pathname]);
  return null;
}

export default function App() {
  return (
    <BrowserRouter>
      <CanonicalUrl />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route
          path="/portafolio"
          element={
            <Suspense fallback={<div className="route-loading" aria-busy="true" />}>
              <Portfolio />
            </Suspense>
          }
        />
        <Route path="*" element={<Home />} />
      </Routes>
    </BrowserRouter>
  );
}
