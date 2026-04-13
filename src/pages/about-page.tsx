export function AboutPage() {
  return (
    <div className="space-y-4">
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
          Live deployment:{' '}
          <a href="https://vods.j4ck.xyz" className="underline-offset-4 hover:text-text hover:underline">
            vods.j4ck.xyz
          </a>
        </p>
      </section>

      <section className="rounded-lg border border-line/45 bg-surface/80 p-5 md:p-6">
        <h2 className="text-base font-semibold text-text">Keyboard shortcuts</h2>
        <ul className="mt-3 space-y-2 text-sm text-muted">
          <li>Browse/Search: <code>J</code> next, <code>K</code> previous, <code>/</code> focus search, <code>Enter</code> open selected card.</li>
          <li>Video: <code>Space</code> or <code>K</code> play/pause, <code>J</code>/<code>L</code> seek ±10s.</li>
          <li>Video: <code>F</code> fullscreen, <code>M</code> mute, <code>0-9</code> seek 0%-90%.</li>
          <li>Video: <code>&lt;</code>/<code>&gt;</code> adjust speed by 0.25x, <code>Esc</code> back to browse.</li>
        </ul>
      </section>
    </div>
  )
}
