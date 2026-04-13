import { Search } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'

import { ErrorPanel } from '@/components/error-panel'
import { TalkCard } from '@/components/talk-card'
import { TalkGridSkeleton } from '@/components/talk-grid-skeleton'
import { toTagPath } from '@/lib/routes'
import { getTalkTaxonomyTokens, scoreTalkForQuery } from '@/lib/taxonomy'
import { useVideos } from '@/state/videos-context'

export function SearchPage() {
  const [query, setQuery] = useState<string>('')
  const { talks, loading, error, refresh } = useVideos()
  const trimmedQuery = query.trim()

  const filteredTalks = useMemo(() => {
    if (!trimmedQuery) {
      return talks
    }

    return talks
      .map((talk) => ({
        talk,
        score: scoreTalkForQuery(talk, trimmedQuery),
      }))
      .filter((entry) => entry.score > 0)
      .sort((a, b) => b.score - a.score)
      .map((entry) => entry.talk)
  }, [talks, trimmedQuery])

  const popularTokens = useMemo(() => {
    const counts = new Map<string, number>()

    for (const talk of filteredTalks) {
      for (const token of getTalkTaxonomyTokens(talk)) {
        counts.set(token, (counts.get(token) ?? 0) + 1)
      }
    }

    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .slice(0, 12)
      .map(([token]) => token)
  }, [filteredTalks])

  return (
    <div className="space-y-7 md:space-y-10" aria-busy={loading}>
      <header className="space-y-4">
        <h1 className="text-2xl font-semibold text-text">Search Talks</h1>

        <label className="flex min-h-11 items-center gap-3 rounded-lg border border-line/45 bg-surface/80 px-3 focus-within:border-line/60 focus-within:ring-2 focus-within:ring-text/30">
          <Search className="h-4 w-4 text-muted" />
          <span className="sr-only">Search by title, tags, or topics</span>
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search by title, tags, or topics"
            className="h-11 w-full bg-transparent text-sm text-text outline-none placeholder:text-muted"
            autoComplete="off"
          />
        </label>

        {!loading && !error && popularTokens.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {popularTokens.map((token) => (
              <Link
                key={token}
                to={toTagPath(token)}
                className="inline-flex min-h-11 items-center rounded-md border border-line/45 bg-surface/80 px-3 text-xs text-muted transition hover:border-line/60 hover:text-text"
              >
                #{token}
              </Link>
            ))}
          </div>
        ) : null}
      </header>

      {loading ? (
        <div role="status" aria-live="polite">
          <span className="sr-only">Loading talks</span>
          <TalkGridSkeleton />
        </div>
      ) : null}

      {!loading && error ? (
        <ErrorPanel
          title="Search unavailable"
          message="Talk metadata failed to load, so live filtering is temporarily unavailable."
          onRetry={refresh}
        />
      ) : null}

      {!loading && !error && filteredTalks.length === 0 ? (
        <section className="rounded-lg border border-line/45 bg-surface/80 p-5">
          <h3 className="text-base font-semibold text-text">No results</h3>
          <p className="mt-2 text-sm leading-relaxed text-muted">
            Try a different keyword or remove filters to explore all talks.
          </p>
        </section>
      ) : null}

      {!loading && !error && filteredTalks.length > 0 ? (
        <section className="space-y-3">
          <h2 className="text-sm font-medium text-muted">Results</h2>
          <p className="text-sm text-muted">
            {filteredTalks.length} result{filteredTalks.length === 1 ? '' : 's'}
          </p>
          <div className="grid grid-cols-[repeat(auto-fit,minmax(240px,1fr))] gap-3 md:grid-cols-[repeat(auto-fit,minmax(280px,1fr))] md:gap-4">
            {filteredTalks.map((talk, index) => (
              <TalkCard key={talk.uri} talk={talk} featured={index === 0 && trimmedQuery.length > 0} />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  )
}
