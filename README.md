# Streamplace VOD Client

Streamplace VOD Client is a minimalist glassy PWA for browsing `place.stream.video` records
across discovered AT Protocol repos, with a dedicated AtmosphereConf 2026 page.

Production URL: https://vods.j4ck.xyz

## What it includes

- React + Vite + TypeScript app with Tailwind + shadcn-style UI primitives
- Relay + PDS-aware fetch flow:
  - discovers repos via `com.atproto.sync.listReposByCollection` on `bsky.network`
  - resolves each DID to its PDS via `plc.directory`
  - fetches `place.stream.video` records from each repo using `com.atproto.repo.listRecords`
- HLS playback via `hls.js` with native controls and mobile swipe-down dismiss
- Search across all discovered videos, with semantic ranking via Cloudflare Pages Function (`/api/search`)
- AtmosphereConf-specific tag/topic enrichment from OpenRouter taxonomy for stronger conference query matching
- `/atmosphereconf-2026` route with official conference videos only
- Mobile-first navigation: bottom tabs on mobile, sidebar on desktop
- PWA setup with `vite-plugin-pwa` and Workbox runtime caching

## Run locally

```bash
npm install
npm run dev
```

## Build for production

```bash
npm run build
```

## Generate AI taxonomy (one-time or refresh)

The app can enrich AtmosphereConf talks with tags/topics generated through OpenRouter.

1. Put your key in `.env` as `OPENROUTER_API_KEY=...`.
2. Run:

```bash
npm run taxonomy:generate
```

This updates `src/lib/video-taxonomy.json`, which is bundled into the app and used by search + tag routes.

## Generate semantic embeddings index (for `/api/search`)

To support cheap server-assisted semantic search on Cloudflare Pages, generate a static embedding index:

```bash
npm run embeddings:generate
```

This updates `public/video-embeddings.json`.

### Required env vars for embeddings generation

- `OPENROUTER_API_KEY`
- optional: `OPENROUTER_EMBEDDING_MODEL` (defaults to `qwen/qwen3-embedding-8b`)
- optional: `EXISTING_EMBEDDINGS_PATH` for incremental reuse (defaults to current output file)
- optional: `EMBEDDINGS_OUTPUT_PATH` (defaults to `public/video-embeddings.json`)

## Cloudflare Pages function search backend

`functions/api/search.ts` provides semantic ranking using:

- static embedding index from `public/video-embeddings.json`
- OpenRouter query embeddings at request time
- live repo discovery overlay so newly uploaded videos are included immediately
- lexical + recency fallback for any videos not yet embedded

Set this env var in Cloudflare Pages project settings for semantic mode:

- `OPENROUTER_API_KEY`
- optional: `OPENROUTER_EMBEDDING_MODEL` (defaults to `qwen/qwen3-embedding-8b`)
- optional: `EMBEDDINGS_INDEX_URL` (raw URL for externally refreshed index)

If the key is not set, search falls back gracefully to lexical title ranking.

## Open Graph preview support (Bluesky / Twitter)

This repo now supports crawler-friendly OG tags in two layers:

- Default static OG card from `public/og-default.png`.
- Per-video HTML metadata at `functions/video/[didParam]/[rkeyParam].ts` so shared `/video/:did/:rkey` links return server-rendered meta tags for crawlers.

Why this works on Cloudflare Pages:

- Social crawlers usually do not execute SPA JavaScript.
- Cloudflare Pages Functions can return HTML with route-specific `<meta property="og:*">` tags before the SPA loads.

### Cost profile / free-tier impact

- This setup is low-cost because image generation is static (`og-default.png`) and reused.
- Per-video function requests fetch one `com.atproto.repo.getRecord` for title/description and then inject tags into `index.html`.
- No per-request video frame extraction, no external image API, and no persistent storage writes.

### Verify previews after deploy

1. Open any direct video URL and confirm source HTML includes route-specific `og:title`, `og:description`, and `og:url`.
2. Validate with social debuggers:
   - Twitter/X Card Validator: `https://cards-dev.twitter.com/validator`
   - OpenGraph checker: `https://www.opengraph.xyz/`
3. Paste a video URL into Bluesky compose and confirm preview card appears.

### Freshness behavior

- Newly uploaded VODs appear immediately in results because the search function overlays a live catalog
  from relay + PDS APIs.
- Those fresh videos are lexical-ranked until you refresh `public/video-embeddings.json`.
- The UI shows index snapshot time and how many videos are currently embedded.

## GitHub Actions (twice daily incremental refresh)

Workflow file: `.github/workflows/refresh-embeddings.yml`

- Runs every 12 hours and on manual dispatch.
- Reuses existing vectors from `embeddings-data` branch and embeds only new VOD URIs.
- Publishes updated `video-embeddings.json` to `embeddings-data` only when changed.

Recommended Cloudflare env for zero-redeploy index updates:

- `EMBEDDINGS_INDEX_URL=https://raw.githubusercontent.com/j4ckxyz/atmosphere-vods/embeddings-data/video-embeddings.json`

## Deploy to Vercel

1. Push this repo to GitHub.
2. In Vercel, import the repository.
3. Deploy with defaults, or run `vercel deploy` from your terminal.

For semantic `/api/search`, set `OPENROUTER_API_KEY` in Cloudflare Pages.

## License

MIT
