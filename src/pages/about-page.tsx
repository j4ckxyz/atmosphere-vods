export function AboutPage() {
  return (
    <section className="rounded-lg border border-line/45 bg-surface/80 p-5 md:p-6">
      <h1 className="text-2xl font-semibold text-text">About Streamplace VOD Client</h1>
      <p className="mt-2 text-sm font-medium text-muted">Open source AT Protocol video browser</p>
      <p className="mt-4 max-w-[70ch] text-sm leading-relaxed text-muted">
        Streamplace VOD Client discovers repos that publish <code>place.stream.video</code> records via
        Bluesky relay sync APIs, then loads records directly from each repo PDS. Playback uses the
        Streamplace VOD beta endpoint.
      </p>
      <p className="mt-4 max-w-[70ch] text-sm leading-relaxed text-muted">
        Search supports all discovered VODs. AtmosphereConf 2026 records include richer OpenRouter
        tag/topic metadata, so Atmosphere queries are usually more precise than general VOD queries.
      </p>
      <p className="mt-4 max-w-[70ch] text-sm leading-relaxed text-muted">
        Live deployment: <a href="https://vods.j4ck.xyz" className="underline-offset-4 hover:text-text hover:underline">vods.j4ck.xyz</a>
      </p>
    </section>
  )
}
