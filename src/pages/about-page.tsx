export function AboutPage() {
  return (
    <section className="glass-panel animate-rise rounded-2xl p-6 md:p-7">
      <p className="text-xs uppercase tracking-[0.16em] text-muted">About</p>
      <h2 className="mt-2 text-xl font-semibold text-text md:text-2xl">Atmosphere VODs</h2>
      <p className="mt-4 max-w-[70ch] text-sm leading-relaxed text-muted">
        Atmosphere VODs is an open-source PWA for browsing ATmosphereConf 2026 talks, built for the
        Streamplace VOD JAM. Built with React, Vite, and the AT Protocol. Created by Jack. AI-assisted
        with Claude.
      </p>
    </section>
  )
}
