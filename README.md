# Atmosphere VODs

Atmosphere VODs is a minimalist glassy PWA for browsing ATmosphereConf 2026 talks from the
Streamplace AT Protocol VOD beta API.

## What it includes

- React + Vite + TypeScript app with Tailwind + shadcn-style UI primitives
- PDS-aware data fetching: resolves the repo DID in PLC directory, then fetches records from that PDS
- HLS playback via `hls.js` with custom controls and mobile swipe-down dismiss
- Search by talk title with instant client-side filtering
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

## Deploy to Vercel

1. Push this repo to GitHub.
2. In Vercel, import the repository.
3. Deploy with defaults, or run `vercel deploy` from your terminal.

No environment variables are required because all APIs are public.

## License

MIT
