# Atmosphere VODs

Atmosphere VODs is a minimalist glassy PWA for browsing ATmosphereConf 2026 talks from the
Streamplace AT Protocol VOD beta API.

## What it includes

- React + Vite + TypeScript app with Tailwind + shadcn-style UI primitives
- PDS-aware data fetching: resolves the repo DID in PLC directory, then fetches records from that PDS
- HLS playback via `hls.js` with native controls and mobile swipe-down dismiss
- Search by title + AI-generated tags/topics with `/tag/{tag}` routes
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

The app can enrich talks with tags/topics generated through OpenRouter.

1. Put your key in `.env` as `OPENROUTER_API_KEY=...`.
2. Run:

```bash
npm run taxonomy:generate
```

This updates `src/lib/video-taxonomy.json`, which is bundled into the app and used by search + tag routes.

## Deploy to Vercel

1. Push this repo to GitHub.
2. In Vercel, import the repository.
3. Deploy with defaults, or run `vercel deploy` from your terminal.

No environment variables are required because all APIs are public.

## License

MIT
