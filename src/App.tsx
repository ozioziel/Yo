import { lazy, Suspense, useEffect } from 'react';
import { BrowserRouter, Route, Routes, useLocation } from 'react-router-dom';
import Home from './pages/Home';

const Portfolio = lazy(() => import('./pages/Portfolio'));

const SITE = 'https://oziel.dev';

/** Title and description per page; "Oziel" goes first so searches for the
 *  name match the start of the result. */
const PAGES = {
  '/': {
    title: 'Oziel Rodman Ramos Torrez · Full Stack Developer | Oziel',
    description:
      'Oziel Rodman Ramos Torrez (Oziel), Full Stack Developer de La Paz, Bolivia: React, NestJS, Flutter, Python, IA y Cloud. Portafolio, proyectos y contacto.',
  },
  '/portafolio': {
    title: 'Portafolio de Oziel Ramos Torrez · Proyectos en GitHub | Oziel',
    description:
      'Proyectos de Oziel Rodman Ramos Torrez en GitHub (@ozioziel): apps web, móviles e IA con React, NestJS, Flutter y Python.',
  },
} as const;

function setMeta(selector: string, attr: 'name' | 'property', key: string, value: string) {
  let el = document.head.querySelector<HTMLMetaElement>(selector);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.content = value;
}

/** One canonical URL per page, so search engines don't index www, trailing
 *  slashes or unknown paths (which render Home) as separate pages. Set only
 *  here, not in index.html, because the same HTML is served for every route. */
function PageHead() {
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
    const page = PAGES[path];
    document.title = page.title;
    setMeta('meta[name="description"]', 'name', 'description', page.description);
    setMeta('meta[property="og:url"]', 'property', 'og:url', SITE + path);
  }, [pathname]);
  return null;
}

export default function App() {
  return (
    <BrowserRouter>
      <PageHead />
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
