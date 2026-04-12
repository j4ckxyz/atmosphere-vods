import { TalkCard } from '@/components/talk-card'
import { TalkGridSkeleton } from '@/components/talk-grid-skeleton'
import { ErrorPanel } from '@/components/error-panel'
import { useVideos } from '@/state/videos-context'

export function BrowsePage() {
  const { talks, loading, error, refresh } = useVideos()

  return (
    <div className="space-y-5">
      <header className="glass-panel animate-rise rounded-2xl p-5 md:p-6">
        <p className="text-xs uppercase tracking-[0.16em] text-muted">ATmosphereConf 2026</p>
        <h2 className="mt-2 text-xl font-semibold text-text md:text-2xl">Browse Talks</h2>
        <p className="mt-3 max-w-[64ch] text-sm leading-relaxed text-muted">
          Freshly sorted by newest publish date, with speaker names resolved when available.
        </p>
      </header>

      {loading ? <TalkGridSkeleton /> : null}

      {!loading && error ? (
        <ErrorPanel
          title="Unable to load talks"
          message="The app could not fetch records from the Streamplace repo PDS. Check your connection and retry."
          onRetry={refresh}
        />
      ) : null}

      {!loading && !error ? (
        <section className="grid grid-cols-[repeat(auto-fit,minmax(260px,1fr))] gap-4 md:gap-5">
          {talks.map((talk, index) => (
            <TalkCard key={talk.uri} talk={talk} index={index} />
          ))}
        </section>
      ) : null}
    </div>
  )
}
