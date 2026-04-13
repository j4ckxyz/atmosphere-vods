import { useEffect, useMemo, useState } from 'react'

import { ErrorPanel } from '@/components/error-panel'
import { TalkCard } from '@/components/talk-card'
import { TalkGridSkeleton } from '@/components/talk-grid-skeleton'
import { isAtmosphereTalk } from '@/lib/api'
import { formatDateTime } from '@/lib/format'
import { fetchAtmosphereIonosphereEnrichment } from '@/lib/ionosphere'
import type { IonosphereEnrichmentResult } from '@/lib/types'
import { searchTalkUris } from '@/lib/semantic-search'
import { useVideos } from '@/state/videos-context'

export function AtmosphereConfPage() {
  const { talks, loading, error, refresh } = useVideos()
  const filteredTalks = talks.filter((talk) => isAtmosphereTalk(talk))
  const [enrichment, setEnrichment] = useState<IonosphereEnrichmentResult>({
    byVodUri: new Map(),
    allTopics: [],
  })
  const [selectedTopic, setSelectedTopic] = useState<string>('')
  const [query, setQuery] = useState<string>('')
  const [remoteUris, setRemoteUris] = useState<string[] | null>(null)

  useEffect(() => {
    if (filteredTalks.length === 0) {
      return
    }

    let active = true

    fetchAtmosphereIonosphereEnrichment(filteredTalks)
      .then((result) => {
        if (!active) {
          return
        }
        setEnrichment(result)
      })
      .catch(() => {
        if (!active) {
          return
        }
        setEnrichment({ byVodUri: new Map(), allTopics: [] })
      })

    return () => {
      active = false
    }
  }, [filteredTalks])

  useEffect(() => {
    const trimmed = query.trim()
    if (!trimmed) {
      return
    }

    const controller = new AbortController()
    searchTalkUris(trimmed, 300, controller.signal)
      .then((result) => {
        setRemoteUris(result.uris)
      })
      .catch(() => {
        setRemoteUris(null)
      })

    return () => {
      controller.abort()
    }
  }, [query])

  const filteredByTopic = useMemo(() => {
    let base = filteredTalks

    if (selectedTopic) {
      base = base.filter((talk) =>
        (enrichment.byVodUri.get(talk.uri)?.topics ?? []).includes(selectedTopic),
      )
    }

    const trimmed = query.trim().toLowerCase()
    if (trimmed) {
      const remoteSet = new Set(remoteUris ?? [])
      base = base.filter((talk) => {
        if (remoteSet.has(talk.uri)) {
          return true
        }

        const enrichmentText = enrichment.byVodUri.get(talk.uri)?.transcriptText?.toLowerCase() ?? ''
        const metadataText = [
          enrichment.byVodUri.get(talk.uri)?.room,
          enrichment.byVodUri.get(talk.uri)?.track,
          ...(enrichment.byVodUri.get(talk.uri)?.topics ?? []),
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()

        return (
          talk.title.toLowerCase().includes(trimmed) ||
          (talk.description ?? '').toLowerCase().includes(trimmed) ||
          enrichmentText.includes(trimmed) ||
          metadataText.includes(trimmed)
        )
      })
    }

    return base
  }, [filteredTalks, enrichment.byVodUri, query, remoteUris, selectedTopic])

  const [featuredTalk, ...remainingTalks] = filteredByTopic

  return (
    <div className="space-y-7 md:space-y-10" aria-busy={loading}>
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold text-text">AtmosphereConf 2026</h1>
        <p className="text-sm text-muted">Official conference videos from stream.place, sorted newest first.</p>

        <label className="mt-2 flex min-h-11 items-center gap-2 rounded-lg border border-line/45 bg-surface/80 px-3 text-sm text-muted">
          <span className="sr-only">Search AtmosphereConf videos</span>
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search title, topics, or transcript text"
            className="h-11 w-full bg-transparent text-sm text-text outline-none placeholder:text-muted"
          />
        </label>

        {enrichment.allTopics.length > 0 ? (
          <div className="flex flex-wrap gap-2 pt-2">
            <button
              type="button"
              onClick={() => setSelectedTopic('')}
              className="inline-flex min-h-11 items-center rounded-md border border-line/45 bg-surface/80 px-3 text-xs text-muted transition hover:border-line/60 hover:text-text"
            >
              All topics
            </button>
            {enrichment.allTopics.slice(0, 20).map((topic) => (
              <button
                key={topic}
                type="button"
                onClick={() => setSelectedTopic(topic)}
                className="inline-flex min-h-11 items-center rounded-md border border-line/45 bg-surface/80 px-3 text-xs text-muted transition hover:border-line/60 hover:text-text"
              >
                {topic}
              </button>
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
          title="Unable to load AtmosphereConf videos"
          message="We couldn't load conference videos right now. Check your connection, then try again."
          onRetry={refresh}
        />
      ) : null}

      {!loading && !error ? (
        <>
          {featuredTalk ? (
            <section className="space-y-3 md:space-y-4">
              <h2 className="text-sm font-medium text-muted">Latest Upload</h2>
              <TalkCard talk={featuredTalk} featured />
              {enrichment.byVodUri.get(featuredTalk.uri) ? (
                <article className="rounded-lg border border-line/45 bg-surface/80 p-4 text-sm text-muted">
                  <p>
                    {enrichment.byVodUri.get(featuredTalk.uri)?.room ?? 'Room TBD'}
                    {' • '}
                    {enrichment.byVodUri.get(featuredTalk.uri)?.track ?? 'Track TBD'}
                    {' • '}
                    {enrichment.byVodUri.get(featuredTalk.uri)?.scheduledAt
                      ? formatDateTime(enrichment.byVodUri.get(featuredTalk.uri)?.scheduledAt as string)
                      : 'Schedule TBD'}
                  </p>
                  {enrichment.byVodUri.get(featuredTalk.uri)?.speakerName ? (
                    <p className="mt-2">
                      Speaker: {enrichment.byVodUri.get(featuredTalk.uri)?.speakerName}
                      {enrichment.byVodUri.get(featuredTalk.uri)?.speakerHandle
                        ? ` (@${enrichment.byVodUri.get(featuredTalk.uri)?.speakerHandle})`
                        : ''}
                    </p>
                  ) : null}
                  {(enrichment.byVodUri.get(featuredTalk.uri)?.topics ?? []).length > 0 ? (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {(enrichment.byVodUri.get(featuredTalk.uri)?.topics ?? []).slice(0, 8).map((topic) => (
                        <button
                          key={topic}
                          type="button"
                          onClick={() => setSelectedTopic(topic)}
                          className="inline-flex min-h-11 items-center rounded-md border border-line/45 bg-surface/70 px-3 text-xs text-muted transition hover:border-line/60 hover:text-text"
                        >
                          {topic}
                        </button>
                      ))}
                    </div>
                  ) : null}
                </article>
              ) : null}
            </section>
          ) : null}

          {remainingTalks.length > 0 ? (
            <section className="space-y-3">
              <h2 className="text-sm font-medium text-muted">More Videos</h2>
              <div className="grid grid-cols-[repeat(auto-fit,minmax(240px,1fr))] gap-3 md:grid-cols-[repeat(auto-fit,minmax(280px,1fr))] md:gap-4">
                {remainingTalks.map((talk) => (
                  <div key={talk.uri} className="space-y-2">
                    <TalkCard talk={talk} />
                    {enrichment.byVodUri.get(talk.uri) ? (
                      <article className="rounded-lg border border-line/45 bg-surface/80 p-3 text-xs text-muted">
                        <p>
                          {enrichment.byVodUri.get(talk.uri)?.room ?? 'Room TBD'}
                          {' • '}
                          {enrichment.byVodUri.get(talk.uri)?.track ?? 'Track TBD'}
                        </p>
                        {(enrichment.byVodUri.get(talk.uri)?.topics ?? []).length > 0 ? (
                          <div className="mt-2 flex flex-wrap gap-2">
                            {(enrichment.byVodUri.get(talk.uri)?.topics ?? []).slice(0, 6).map((topic) => (
                              <button
                                key={topic}
                                type="button"
                                onClick={() => setSelectedTopic(topic)}
                                className="inline-flex min-h-11 items-center rounded-md border border-line/45 bg-surface/70 px-2.5 text-[11px] text-muted transition hover:border-line/60 hover:text-text"
                              >
                                {topic}
                              </button>
                            ))}
                          </div>
                        ) : null}
                      </article>
                    ) : null}
                  </div>
                ))}
              </div>
            </section>
          ) : null}
        </>
      ) : null}
    </div>
  )
}
