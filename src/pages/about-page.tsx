export function AboutPage() {
  return (
    <section className="rounded-lg border border-line/45 bg-surface/80 p-5 md:p-6">
      <h1 className="text-2xl font-semibold text-text">About Atmosphere VODs</h1>
      <p className="mt-2 text-sm font-medium text-muted">Open Source Conference Archive</p>
      <p className="mt-4 max-w-[70ch] text-sm leading-relaxed text-muted">
        Atmosphere VODs is an open-source PWA for browsing ATmosphereConf 2026 talks, built for the
        Streamplace VOD JAM. Built with React, Vite, and the AT Protocol. Created by Jack. AI-assisted
        with Claude.
      </p>
    </section>
  )
}
