#!/usr/bin/env node
/**
 * Saves a snapshot of the public GitHub profile (profile, README, repos) used by the
 * Portfolio page when the live API is unreachable or rate-limited.
 *   node scripts/github-snapshot.mjs [user]
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const USER = process.argv[2] ?? 'ozioziel';
const OUT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'src', 'pages', 'portfolio', 'github-snapshot.json');
const headers = { 'User-Agent': 'oziel-home-snapshot', Accept: 'application/vnd.github+json' };

const get = async url => {
  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error(`${url} → ${res.status}`);
  return res;
};

const profile = await (await get(`https://api.github.com/users/${USER}`)).json();
const repos = await (await get(`https://api.github.com/users/${USER}/repos?per_page=100&sort=pushed`)).json();
let readme = '';
try {
  readme = await (await get(`https://raw.githubusercontent.com/${USER}/${USER}/HEAD/README.md`)).text();
} catch {
  /* no profile README */
}

const pick = r => ({
  name: r.name,
  description: r.description,
  html_url: r.html_url,
  homepage: r.homepage,
  language: r.language,
  stargazers_count: r.stargazers_count,
  forks_count: r.forks_count,
  topics: r.topics ?? [],
  pushed_at: r.pushed_at,
  fork: r.fork,
});

const snapshot = {
  savedAt: new Date().toISOString(),
  profile: {
    login: profile.login,
    name: profile.name,
    avatar_url: profile.avatar_url,
    html_url: profile.html_url,
    bio: profile.bio,
    location: profile.location,
    blog: profile.blog,
    public_repos: profile.public_repos,
    followers: profile.followers,
  },
  readme,
  repos: repos.filter(r => !r.fork && r.name !== USER).map(pick),
};
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(snapshot, null, 2));
console.log(`[github] ${snapshot.repos.length} repos → ${path.relative(process.cwd(), OUT)}`);
