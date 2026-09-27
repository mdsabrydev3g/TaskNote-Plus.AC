/**
 * Route contract check.
 *
 * Guards against the class of bug where navigation targets, the PWA manifest
 * and the auth middleware point at URLs the built app does not serve — e.g. a
 * route group named `(app)` does NOT contribute "/app" to the URL, so every
 * `/app/...` link 404s.
 *
 * Run after `next build`. Exits non-zero when a target is missing.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const manifestPath = '.next/app-path-routes-manifest.json';

function fail(message, details = []) {
  console.error(`\n✗ ${message}`);
  for (const line of details) console.error(`  - ${line}`);
  process.exit(1);
}

let manifest;
try {
  manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
} catch {
  fail(`Could not read ${manifestPath}. Run "next build" first.`);
}

const routes = new Set(Object.values(manifest));

function sourceFiles(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) sourceFiles(full, out);
    else if (/\.(ts|tsx)$/.test(entry)) out.push(full);
  }
  return out;
}

/**
 * Every quoted literal that starts with /app/ is meant to be a real page.
 * Template literals (backticks) are dynamic and deliberately skipped.
 */
function appPathLiterals(file) {
  const source = readFileSync(file, 'utf8');
  return [...source.matchAll(/['"](\/app\/[A-Za-z0-9\-_/[\]]*)['"]/g)]
    .map((m) => m[1])
    .filter((p) => !p.endsWith('/'));
}

// 1. every /app/... literal anywhere in the source tree
const targetFiles = [
  ...sourceFiles('app'),
  ...sourceFiles('components'),
  ...sourceFiles('lib'),
];

const found = new Map();
for (const file of targetFiles) {
  for (const literal of appPathLiterals(file)) {
    if (!found.has(literal)) found.set(literal, file);
  }
}
if (found.size === 0) fail('No /app/... route literals found — did the scan break?');

// 2. PWA manifest start_url and shortcuts
const pwa = JSON.parse(readFileSync('public/manifest.webmanifest', 'utf8'));
for (const target of [pwa.start_url, ...(pwa.shortcuts ?? []).map((s) => s.url)]) {
  if (target) found.set(target, 'public/manifest.webmanifest');
}

const missing = [...found.entries()].filter(([href]) => !routes.has(href));
if (missing.length > 0) {
  fail('Referenced targets are not served by the build:', [
    ...missing.map(([href, file]) => `${href}   (${file})`),
    '',
    'Routes actually available:',
    ...[...routes].sort().map((r) => `  ${r}`),
  ]);
}

// 3. the middleware matcher must cover every navigation target
const navHrefs = [...readFileSync('lib/nav.ts', 'utf8').matchAll(/href:\s*'([^']+)'/g)].map((m) => m[1]);
const middleware = readFileSync('middleware.ts', 'utf8');
const matcher = middleware.match(/matcher:\s*\[([^\]]+)\]/)?.[1] ?? '';
const matcherPrefix = matcher.match(/'([^']+)\/:path\*'/)?.[1];
if (!matcherPrefix) fail('Could not find a "<prefix>/:path*" matcher in middleware.ts.');

const unprotected = navHrefs.filter((href) => !href.startsWith(`${matcherPrefix}/`));
if (unprotected.length > 0) {
  fail(`Navigation targets fall outside the middleware matcher ${matcherPrefix}/:path*:`, unprotected);
}

console.log(`✓ Route contract OK: ${found.size} targets resolved against ${routes.size} routes.`);
console.log(`  middleware scope: ${matcherPrefix}/:path*`);
