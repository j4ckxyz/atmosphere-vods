import { TalkCard } from '@/components/talk-card'
import { TalkGridSkeleton } from '@/components/talk-grid-skeleton'
import { ErrorPanel } from '@/components/error-panel'
import { useVideos } from '@/state/videos-context'

export function BrowsePage() {
  const { talks, loading, error, refresh } = useVideos()
  const [featuredTalk, ...remainingTalks] = talks

  return (
    <div className="space-y-7 md:space-y-10" aria-busy={loading}>
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold text-text">ATmosphereConf 2026 Talks</h1>
        <p className="text-sm text-muted">Newest first. Tap a talk to watch.</p>
      </header>

      {loading ? (
        <div role="status" aria-live="polite">
          <span className="sr-only">Loading talks</span>
          <TalkGridSkeleton />
        </div>
      ) : null}

      {!loading && error ? (
        <ErrorPanel
          title="Unable to load talks"
          message="The app could not fetch records from the Streamplace repo PDS. Check your connection and retry."
          onRetry={refresh}
        />
      ) : null}

      {!loading && !error ? (
        <>
          {featuredTalk ? (
            <section className="space-y-3 md:space-y-4">
              <h2 className="text-sm font-medium text-muted">Latest Upload</h2>
              <TalkCard talk={featuredTalk} featured />
            </section>
          ) : null}

          {remainingTalks.length > 0 ? (
            <section className="space-y-3">
              <h2 className="text-sm font-medium text-muted">More Talks</h2>
              <div className="grid grid-cols-[repeat(auto-fit,minmax(240px,1fr))] gap-3 md:grid-cols-[repeat(auto-fit,minmax(280px,1fr))] md:gap-4">
                {remainingTalks.map((talk) => (
                  <TalkCard key={talk.uri} talk={talk} />
                ))}
              </div>
            </section>
          ) : null}
        </>
      ) : null}
    </div>
  )
}
