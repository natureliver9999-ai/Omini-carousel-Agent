# Deploying the gallery

The site is not a separate app. It is the engine rendering its own examples:

```
npm ci
npm run build          # compile the workspace (engine, MCP, SDKs)
node site/build.mjs    # render 9 decks → gallery → art atlas → site/out
```

`site/out` is a plain static directory — `index.html` (the gallery),
`atlas.html` (8 generative styles × 5 themes as inline SVG), `decks/<id>/`
(PNG slides, PDF, HTML deck, caption, spec, manifest) and a `404.html` that
points back at the gallery. No server, no environment variables, no runtime at
request time.

## Option A — Vercel, from the repository

`vercel.json` at the repository root already describes the build:

```json
{ "installCommand": "npm ci",
  "buildCommand": "npm run build && node site/build.mjs",
  "outputDirectory": "site/out",
  "cleanUrls": true }
```

1. In Vercel: **Add New → Project → Import Git Repository → `Omini-carousel-Agent`**.
2. Keep the detected settings (they come from `vercel.json`) and press **Deploy**.
3. Every push to `main` then re-renders the decks and publishes them.

## Option B — Vercel CLI

```bash
npm ci && npm run build && node site/build.mjs
npx vercel deploy site/out --prod        # uploads the static directory
```

`site/build.mjs` writes a `vercel.json` into `site/out` (`cleanUrls`, `nosniff`),
so deploying the built directory needs no project configuration.

## Option C — GitHub Actions

`.github/workflows/deploy-vercel.yml` builds the site on every push to `main` and
uploads it. It needs one repository secret:

| Secret | Where to get it |
| --- | --- |
| `VERCEL_TOKEN` | <https://vercel.com/account/tokens> |
| `VERCEL_ORG_ID` (optional) | `.vercel/project.json` after `vercel link` |
| `VERCEL_PROJECT_ID` (optional) | same |

Without the token the workflow still builds the site (so a broken build fails CI)
and warns that nothing was uploaded.

## Option D — any static host

`site/out` is static: S3 + CloudFront, Cloudflare Pages, Netlify, GitHub Pages,
or `npx serve site/out`. Relative paths only, no absolute URLs, no external
requests — the gallery and the atlas render offline.

## Why the build is the product

A deck shown on the site is the exact output of `omni-carousel examples`, hashed
by the same golden test that runs in CI. There is no CMS, no design file and no
hand-edited page to drift out of sync: if a slide on the site looks wrong, the
engine is wrong, and the test that catches it is the one you can run locally.
