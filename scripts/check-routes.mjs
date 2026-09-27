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
import { readFileSync } from 'node:fs';

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

/** Absolute-path string literals that look like routes (no file extensions). */
function routeLiterals(file) {
  const source = readFileSync(file, 'utf8');
  return [...source.matchAll(/'(\/[A-Za-z0-9\-_/[\]]*)'/g)]
    .map((m) => m[1])
    .filter((p) => !p.includes('.') && p !== '/');
}

// 1. sidebar / bottom-nav targets
const navHrefs = [...readFileSync('lib/nav.ts', 'utf8').matchAll(/href:\s*'([^']+)'/g)].map((m) => m[1]);
if (navHrefs.length === 0) fail('No navigation hrefs found in lib/nav.ts — did the shape change?');

// 2. PWA manifest start_url and shortcuts
const pwa = JSON.parse(readFileSync('public/manifest.webmanifest', 'utf8'));
const pwaTargets = [pwa.start_url, ...(pwa.shortcuts ?? []).map((s) => s.url)].filter(Boolean);

// 3. post-auth redirect targets and cross-links
const redirectTargets = [
  ...routeLiterals('app/page.tsx'),
  ...routeLiterals('components/auth-form.tsx'),
];

const targets = [...new Set([...navHrefs, ...pwaTargets, ...redirectTargets])].sort();
const missing = targets.filter((href) => !routes.has(href));

if (missing.length > 0) {
  fail('Referenced targets are not served by the build:', [
    ...missing,
    '',
    'Routes actually available:',
    ...[...routes].sort().map((r) => `  ${r}`),
  ]);
}

// 4. the middleware matcher must cover every navigation target
const middleware = readFileSync('middleware.ts', 'utf8');
const matcher = middleware.match(/matcher:\s*\[([^\]]+)\]/)?.[1] ?? '';
const matcherPrefix = matcher.match(/'([^']+)\/:path\*'/)?.[1];
if (!matcherPrefix) fail('Could not find a "<prefix>/:path*" matcher in middleware.ts.');

const unprotected = navHrefs.filter((href) => !href.startsWith(`${matcherPrefix}/`));
if (unprotected.length > 0) {
  fail(`Navigation targets fall outside the middleware matcher ${matcherPrefix}/:path*:`, unprotected);
}

console.log(`✓ Route contract OK: ${targets.length} targets resolved against ${routes.size} routes.`);
console.log(`  middleware scope: ${matcherPrefix}/:path*`);
