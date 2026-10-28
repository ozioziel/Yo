import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Markdown } from './portfolio/markdown';
import snapshot from './portfolio/github-snapshot.json';
import '../styles/portfolio.css';

const USER = 'ozioziel';
const CACHE = 'oziel.github.v1';

type Snapshot = typeof snapshot;
type Repo = Snapshot['repos'][number];

const LANG_COLORS: Record<string, string> = {
  TypeScript: '#3178c6',
  JavaScript: '#e7c52a',
  Python: '#3572a5',
  Dart: '#00b4ab',
  Vue: '#41b883',
  HTML: '#e34c26',
  CSS: '#563d7c',
};

async function fetchLive(): Promise<Snapshot> {
  const headers = { Accept: 'application/vnd.github+json' };
  const [profile, repos, readme] = await Promise.all([
    fetch(`https://api.github.com/users/${USER}`, { headers }).then(r => (r.ok ? r.json() : Promise.reject(r.status))),
    fetch(`https://api.github.com/users/${USER}/repos?per_page=100&sort=pushed`, { headers }).then(r => (r.ok ? r.json() : Promise.reject(r.status))),
    fetch(`https://raw.githubusercontent.com/${USER}/${USER}/HEAD/README.md`).then(r => (r.ok ? r.text() : '')),
  ]);
  return {
    savedAt: new Date().toISOString(),
    profile: { ...snapshot.profile, ...profile },
    readme: readme || snapshot.readme,
    repos: (repos as (Repo & { fork: boolean })[]).filter(r => !r.fork && r.name !== USER),
  } as Snapshot;
}

/** Everything on Oziel's public GitHub: profile README and repositories. */
export default function Portfolio() {
  const [data, setData] = useState<Snapshot>(() => {
    try {
      const cached = sessionStorage.getItem(CACHE);
      if (cached) return JSON.parse(cached) as Snapshot;
    } catch {
      /* ignore */
    }
    return snapshot;
  });
  const [live, setLive] = useState<'loading' | 'live' | 'snapshot'>('loading');

  useEffect(() => {
    document.title = 'Portafolio · Oziel Rodman Ramos Torrez';
    let cancelled = false;
    fetchLive()
      .then(d => {
        if (cancelled) return;
        setData(d);
        setLive('live');
        try {
          sessionStorage.setItem(CACHE, JSON.stringify(d));
        } catch {
          /* ignore */
        }
      })
      .catch(() => !cancelled && setLive('snapshot'));
    return () => {
      cancelled = true;
      document.title = 'hOme · Oziel Rodman Ramos Torrez';
    };
  }, []);

  const repos = [...data.repos].sort((a, b) => +new Date(b.pushed_at) - +new Date(a.pushed_at));
  const p = data.profile;

  return (
    <div className="portfolio">
      <header className="pf-top">
        <Link to="/" className="pf-back">
          <img src="/assets/overrides/brand/mark.png" alt="" width={38} height={38} />
          <span>
            Volver a h<b>O</b>me
          </span>
        </Link>
      </header>

      <main className="pf-main">
        <section className="pf-profile" aria-labelledby="pf-title">
          <img className="pf-avatar" src={p.avatar_url} alt={`Avatar de GitHub de ${p.login}`} width={120} height={120} />
          <div>
            <p className="pf-kicker">Portafolio · GitHub</p>
            <h1 id="pf-title">Oziel Rodman Ramos Torrez</h1>
            {p.bio && <p className="pf-bio">{p.bio}</p>}
            <p className="pf-meta">
              {p.location && <span>{p.location}</span>}
              <span>{p.public_repos} repositorios públicos</span>
            </p>
            <a className="pf-button" href={p.html_url} target="_blank" rel="noreferrer">
              Ver @{p.login} en GitHub
            </a>
          </div>
        </section>

        <section className="pf-repos" aria-labelledby="pf-repos-title">
          <h2 id="pf-repos-title">Repositorios</h2>
          <ul>
            {repos.map(r => (
              <li key={r.name} className="pf-repo">
                <a href={r.html_url} target="_blank" rel="noreferrer" className="pf-repo-name">
                  {r.name}
                </a>
                <p>{r.description || 'Sin descripción en GitHub.'}</p>
                <div className="pf-repo-meta">
                  {r.language && (
                    <span>
                      <i style={{ background: LANG_COLORS[r.language] ?? '#8a8f8c' }} aria-hidden="true" />
                      {r.language}
                    </span>
                  )}
                  <span>Actualizado {new Date(r.pushed_at).toLocaleDateString('es-BO', { year: 'numeric', month: 'short', day: 'numeric' })}</span>
                  {r.homepage && (
                    <a href={r.homepage} target="_blank" rel="noreferrer">
                      Demo
                    </a>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </section>

        {data.readme && (
          <article className="pf-readme" aria-label="README del perfil de GitHub">
            <Markdown source={data.readme} />
          </article>
        )}

        <p className="pf-source">
          {live === 'live'
            ? 'Datos en vivo desde GitHub.'
            : live === 'snapshot'
              ? `GitHub no respondió: mostrando la copia guardada el ${new Date(data.savedAt).toLocaleDateString('es-BO')}.`
              : 'Actualizando desde GitHub…'}
        </p>
      </main>
    </div>
  );
}
