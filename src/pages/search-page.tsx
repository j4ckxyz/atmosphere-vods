import { Search } from 'lucide-react'
import { useEffect, useState, type ChangeEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'

import { ErrorPanel } from '@/components/error-panel'
import { ShortcutsHelp } from '@/components/shortcuts-help'
import { TalkCard } from '@/components/talk-card'
import { TalkGridSkeleton } from '@/components/talk-grid-skeleton'
import { searchTalkUris } from '@/lib/semantic-search'
import { toTagPath } from '@/lib/routes'
import { getTalkTaxonomyTokens, scoreTalkForQuery } from '@/lib/taxonomy'
import { useKeyboard } from '@/lib/use-keyboard'
import { useVideos } from '@/state/videos-context'

export function SearchPage() {
  const [searchParams] = useSearchParams()
  const [query, setQuery] = useState<string>('')
  const [remoteQuery, setRemoteQuery] = useState<string>('')
  const [remoteUris, setRemoteUris] = useState<string[] | null>(null)
  const [remoteMode, setRemoteMode] = useState<'semantic' | 'lexical' | null>(null)
  const [remoteNotice, setRemoteNotice] = useState<string | null>(null)
  const [remoteGeneratedAt, setRemoteGeneratedAt] = useState<string | null>(null)
  const [remoteIndexedCount, setRemoteIndexedCount] = useState<number | null>(null)
  const [remoteError, setRemoteError] = useState<string | null>(null)
  const [remoteLoading, setRemoteLoading] = useState<boolean>(false)
  const [selectedIndex, setSelectedIndex] = useState(0)
  const { talks, loading, error, refresh } = useVideos()
  const trimmedQuery = query.trim()

  const onQueryChange = (event: ChangeEvent<HTMLInputElement>) => {
    const nextValue = event.target.value
    const nextTrimmed = nextValue.trim()

    setQuery(nextValue)
    setSelectedIndex(0)

    if (!nextTrimmed) {
      setRemoteQuery('')
      setRemoteUris(null)
      setRemoteMode(null)
      setRemoteNotice(null)
      setRemoteGeneratedAt(null)
      setRemoteIndexedCount(null)
      setRemoteError(null)
      setRemoteLoading(false)
      return
    }

    setRemoteUris(null)
    setRemoteMode(null)
    setRemoteNotice(null)
    setRemoteGeneratedAt(null)
    setRemoteIndexedCount(null)
    setRemoteError(null)
    setRemoteLoading(true)
  }

  useEffect(() => {
    if (!trimmedQuery || talks.length === 0) {
      return
    }

    const controller = new AbortController()
    let active = true

    const timeout = window.setTimeout(() => {
      searchTalkUris(trimmedQuery, 200, controller.signal)
        .then((result) => {
          if (!active) {
            return
          }
          setSelectedIndex(0)
          setRemoteQuery(trimmedQuery)
          setRemoteUris(result.uris)
          setRemoteMode(result.mode)
          setRemoteNotice(result.notice ?? null)
          setRemoteGeneratedAt(result.generatedAt ?? null)
          setRemoteIndexedCount(typeof result.indexedCount === 'number' ? result.indexedCount : null)
          setRemoteError(null)
        })
        .catch((fetchError) => {
          if (!active) {
            return
          }
          if (fetchError instanceof DOMException && fetchError.name === 'AbortError') {
            return
          }
          const message = fetchError instanceof Error ? fetchError.message : 'Semantic search unavailable.'
          setSelectedIndex(0)
          setRemoteQuery(trimmedQuery)
          setRemoteError(message)
          setRemoteUris(null)
          setRemoteMode(null)
          setRemoteNotice(null)
          setRemoteGeneratedAt(null)
          setRemoteIndexedCount(null)
        })
        .finally(() => {
          if (active) {
            setRemoteLoading(false)
          }
        })
    }, 250)

    return () => {
      active = false
      window.clearTimeout(timeout)
      controller.abort()
    }
  }, [trimmedQuery, talks.length])

  const filteredTalks = !trimmedQuery
    ? talks
    : (() => {
        const hasCurrentRemote = remoteQuery === trimmedQuery

        if (hasCurrentRemote && remoteUris && remoteUris.length > 0) {
          const talkByUri = new Map(talks.map((talk) => [talk.uri, talk]))
          const orderedFromRemote = remoteUris
            .map((uri) => talkByUri.get(uri))
            .filter((talk): talk is NonNullable<typeof talk> => Boolean(talk))

          if (orderedFromRemote.length > 0) {
            return orderedFromRemote
          }
        }

        return talks
          .map((talk) => ({
            talk,
            score: scoreTalkForQuery(talk, trimmedQuery),
          }))
          .filter((entry) => entry.score > 0)
          .sort((a, b) => b.score - a.score)
          .map((entry) => entry.talk)
      })()

  const selectedTalkIndex =
    filteredTalks.length > 0 ? Math.min(selectedIndex, filteredTalks.length - 1) : 0

  useKeyboard((event) => {
    if (event.metaKey || event.ctrlKey || event.altKey) {
      return
    }

    const key = event.key
    const lower = key.toLowerCase()

    if (lower === 'j') {
      if (filteredTalks.length === 0) {
        return
      }
      event.preventDefault()
      setSelectedIndex((value) => Math.min(filteredTalks.length - 1, value + 1))
      return
    }

    if (lower === 'k') {
      if (filteredTalks.length === 0) {
        return
      }
      event.preventDefault()
      setSelectedIndex((value) => Math.max(0, value - 1))
      return
    }

    if (key === '/') {
      event.preventDefault()
      const input = document.getElementById('search-input')
      if (input instanceof HTMLInputElement) {
        input.focus()
      }
      return
    }

    if (lower === 'enter') {
      if (filteredTalks.length === 0) {
        return
      }
      event.preventDefault()
      const selectedTalk = filteredTalks[selectedTalkIndex]
      if (!selectedTalk) {
        return
      }
      const card = document.getElementById(`talk-card-${encodeURIComponent(selectedTalk.uri)}`)
      if (card instanceof HTMLAnchorElement) {
        card.click()
      }
    }
  })

  const counts = new Map<string, number>()
  for (const talk of filteredTalks) {
    for (const token of getTalkTaxonomyTokens(talk)) {
      counts.set(token, (counts.get(token) ?? 0) + 1)
    }
  }
  const popularTokens = [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 12)
    .map(([token]) => token)

  useEffect(() => {
    if (searchParams.get('focus') !== '1') {
      return
    }
    const input = document.getElementById('search-input')
    if (input instanceof HTMLInputElement) {
      input.focus()
    }
  }, [searchParams])

  return (
    <div className="space-y-7 md:space-y-10" aria-busy={loading}>
      <header className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-2xl font-semibold text-text">Search Videos</h1>
          <ShortcutsHelp
            title="Search shortcuts"
            items={[
              { key: 'J', description: 'Next video card' },
              { key: 'K', description: 'Previous video card' },
              { key: '/', description: 'Focus search input' },
              { key: 'Enter', description: 'Open selected card' },
            ]}
          />
        </div>

        <label className="flex min-h-11 items-center gap-3 rounded-lg border border-line/45 bg-surface/80 px-3 focus-within:border-line/60 focus-within:ring-2 focus-within:ring-text/30">
          <Search className="h-4 w-4 text-muted" />
          <span className="sr-only">Search by title, tags, or topics</span>
          <input
            id="search-input"
            type="search"
            value={query}
            onChange={onQueryChange}
            placeholder="Search by title, tags, or topics"
            className="h-11 w-full bg-transparent text-sm text-text outline-none placeholder:text-muted"
            autoComplete="off"
          />
        </label>

        {!loading && !error && trimmedQuery ? (
          <section className="rounded-lg border border-line/45 bg-surface/80 p-4 text-xs text-muted">
            <p>
              Search blends semantic ranking for all Streamplace VODs with richer AtmosphereConf tags/topics.
            </p>
            {remoteLoading ? <p className="mt-2">Ranking query...</p> : null}
            {!remoteLoading && remoteMode ? (
              <p className="mt-2">
                Mode: {remoteMode === 'semantic' ? 'semantic embeddings' : 'lexical fallback'}
              </p>
            ) : null}
            {!remoteLoading && remoteNotice ? <p className="mt-2">{remoteNotice}</p> : null}
            {!remoteLoading && remoteGeneratedAt ? (
              <p className="mt-2">
                Index snapshot: {new Date(remoteGeneratedAt).toLocaleString()}
                {remoteIndexedCount !== null ? ` (${remoteIndexedCount} embedded videos)` : ''}
              </p>
            ) : null}
            {!remoteLoading && remoteError ? <p className="mt-2">{remoteError}</p> : null}
          </section>
        ) : null}

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
              <TalkCard
                key={talk.uri}
                talk={talk}
                featured={index === 0 && trimmedQuery.length > 0}
                selected={selectedTalkIndex === index}
                cardId={`talk-card-${encodeURIComponent(talk.uri)}`}
              />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  )
}
