import { Search } from 'lucide-react'
import { useMemo, useState } from 'react'

import { ErrorPanel } from '@/components/error-panel'
import { TalkCard } from '@/components/talk-card'
import { TalkGridSkeleton } from '@/components/talk-grid-skeleton'
import { useVideos } from '@/state/videos-context'

export function SearchPage() {
  const [query, setQuery] = useState<string>('')
  const { talks, loading, error, refresh } = useVideos()

  const filteredTalks = useMemo(() => {
    const normalized = query.trim().toLowerCase()
    if (!normalized) {
      return talks
    }

    return talks.filter((talk) => talk.title.toLowerCase().includes(normalized))
  }, [talks, query])

  return (
    <div className="space-y-5">
      <header className="glass-panel animate-rise rounded-2xl p-5 md:p-6">
        <p className="text-xs uppercase tracking-[0.16em] text-muted">Instant Filter</p>
        <h2 className="mt-2 text-xl font-semibold text-text md:text-2xl">Search Talks</h2>

        <label className="glass-panel mt-4 flex min-h-11 items-center gap-3 rounded-xl border-line/70 px-3">
          <Search className="h-4 w-4 text-muted" />
          <span className="sr-only">Search by title</span>
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search by title"
            className="h-11 w-full bg-transparent text-sm text-text outline-none placeholder:text-muted"
          />
        </label>
      </header>

      {loading ? <TalkGridSkeleton /> : null}

      {!loading && error ? (
        <ErrorPanel
          title="Search unavailable"
          message="Talk metadata failed to load, so live filtering is temporarily unavailable."
          onRetry={refresh}
        />
      ) : null}

      {!loading && !error && filteredTalks.length === 0 ? (
        <section className="glass-panel rounded-2xl p-6">
          <h3 className="text-base font-semibold text-text">No results</h3>
          <p className="mt-2 text-sm leading-relaxed text-muted">
            Try a different keyword or remove filters to explore all talks.
          </p>
        </section>
      ) : null}

      {!loading && !error && filteredTalks.length > 0 ? (
        <section className="grid grid-cols-[repeat(auto-fit,minmax(260px,1fr))] gap-4 md:gap-5">
          {filteredTalks.map((talk, index) => (
            <TalkCard key={talk.uri} talk={talk} index={index} />
          ))}
        </section>
      ) : null}
    </div>
  )
}
