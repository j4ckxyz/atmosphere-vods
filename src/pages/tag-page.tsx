import { Link, useParams } from 'react-router-dom'

import { ErrorPanel } from '@/components/error-panel'
import { TalkCard } from '@/components/talk-card'
import { TalkGridSkeleton } from '@/components/talk-grid-skeleton'
import { fromTagParam } from '@/lib/routes'
import { matchesTagRoute, normalizeSearchValue } from '@/lib/taxonomy'
import { useVideos } from '@/state/videos-context'

export function TagPage() {
  const { tagParam } = useParams<{ tagParam: string }>()
  const { talks, loading, error, refresh } = useVideos()

  const tag = tagParam ? fromTagParam(tagParam) : undefined
  const normalizedTag = tag ? normalizeSearchValue(tag) : ''
  const filteredTalks = talks.filter((talk) => matchesTagRoute(talk, normalizedTag))

  if (!tag) {
    return (
      <ErrorPanel
        title="Invalid tag"
        message="This tag route is not valid."
        onRetry={refresh}
      />
    )
  }

  return (
    <div className="space-y-7 md:space-y-10" aria-busy={loading}>
      <header className="space-y-2">
        <p className="text-sm text-muted">
          <Link to="/search" className="underline-offset-4 hover:text-text hover:underline">
            Search
          </Link>{' '}
          / #{normalizedTag}
        </p>
        <h1 className="text-2xl font-semibold text-text">Tag: #{normalizedTag}</h1>
      </header>

      {loading ? (
        <div role="status" aria-live="polite">
          <span className="sr-only">Loading talks</span>
          <TalkGridSkeleton />
        </div>
      ) : null}

      {!loading && error ? (
        <ErrorPanel
          title="Tag view unavailable"
          message="Talk metadata failed to load, so tag filtering is temporarily unavailable."
          onRetry={refresh}
        />
      ) : null}

      {!loading && !error && filteredTalks.length === 0 ? (
        <section className="rounded-lg border border-line/45 bg-surface/80 p-5">
          <h2 className="text-base font-semibold text-text">No talks for this tag</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted">
            Try a different tag from the search page.
          </p>
        </section>
      ) : null}

      {!loading && !error && filteredTalks.length > 0 ? (
        <section className="space-y-3">
          <p className="text-sm text-muted">
            {filteredTalks.length} result{filteredTalks.length === 1 ? '' : 's'}
          </p>
          <div className="grid grid-cols-[repeat(auto-fit,minmax(240px,1fr))] gap-3 md:grid-cols-[repeat(auto-fit,minmax(280px,1fr))] md:gap-4">
            {filteredTalks.map((talk, index) => (
              <TalkCard key={talk.uri} talk={talk} featured={index === 0} />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  )
}
