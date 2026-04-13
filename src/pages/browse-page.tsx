import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { TalkCard } from '@/components/talk-card'
import { TalkGridSkeleton } from '@/components/talk-grid-skeleton'
import { ErrorPanel } from '@/components/error-panel'
import { isAtmosphereTalk } from '@/lib/api'
import { useKeyboard } from '@/lib/use-keyboard'
import { useVideos } from '@/state/videos-context'

export function BrowsePage() {
  const navigate = useNavigate()
  const { talks, loading, error, refresh } = useVideos()
  const [featuredTalk, ...remainingTalks] = talks
  const sourceRepos = Array.from(new Set(talks.map((talk) => talk.sourceRepoDid))).sort((a, b) =>
    a.localeCompare(b),
  )
  const atmosphereCount = talks.filter((talk) => isAtmosphereTalk(talk)).length
  const orderedTalks = useMemo(() => talks, [talks])
  const [selectedIndex, setSelectedIndex] = useState(0)

  useKeyboard((event) => {
    if (event.metaKey || event.ctrlKey || event.altKey || orderedTalks.length === 0) {
      return
    }

    const key = event.key.toLowerCase()
    if (key === 'j') {
      event.preventDefault()
      setSelectedIndex((value) => Math.min(orderedTalks.length - 1, value + 1))
      return
    }

    if (key === 'k') {
      event.preventDefault()
      setSelectedIndex((value) => Math.max(0, value - 1))
      return
    }

    if (key === 'enter') {
      event.preventDefault()
      const selectedTalk = orderedTalks[selectedIndex]
      if (!selectedTalk) {
        return
      }
      const card = document.getElementById(`talk-card-${encodeURIComponent(selectedTalk.uri)}`)
      if (card instanceof HTMLAnchorElement) {
        card.click()
      }
      return
    }

    if (event.key === '/') {
      event.preventDefault()
      navigate('/search?focus=1')
    }
  })

  return (
    <div className="space-y-7 md:space-y-10" aria-busy={loading}>
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold text-text">Streamplace VOD Browser</h1>
        <p className="text-sm text-muted">All discovered repos, newest first.</p>
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
          message="The app could not fetch records from discovered Streamplace repos. Check your connection and retry."
          onRetry={refresh}
        />
      ) : null}

      {!loading && !error ? (
        <>
          {sourceRepos.length > 0 ? (
            <section className="space-y-3 rounded-lg border border-line/45 bg-surface/80 p-4 md:p-5">
              <h2 className="text-sm font-medium text-muted">Discovered repos</h2>
              <p className="text-sm text-muted">
                {sourceRepos.length} repo{sourceRepos.length === 1 ? '' : 's'} with{' '}
                <code>place.stream.video</code> records.
              </p>
              <div className="flex flex-wrap gap-2">
                {sourceRepos.map((did) => (
                  <span
                    key={did}
                    className="inline-flex min-h-11 items-center rounded-md border border-line/45 bg-surface/70 px-3 text-xs text-muted"
                  >
                    {did}
                  </span>
                ))}
              </div>
              <p className="text-xs text-muted">
                AtmosphereConf official repo contributes {atmosphereCount} video
                {atmosphereCount === 1 ? '' : 's'}.
              </p>
            </section>
          ) : null}

          {featuredTalk ? (
            <section className="space-y-3 md:space-y-4">
              <h2 className="text-sm font-medium text-muted">Latest Upload</h2>
              <TalkCard
                talk={featuredTalk}
                featured
                selected={selectedIndex === 0}
                cardId={`talk-card-${encodeURIComponent(featuredTalk.uri)}`}
              />
            </section>
          ) : null}

          {remainingTalks.length > 0 ? (
            <section className="space-y-3">
              <h2 className="text-sm font-medium text-muted">More Talks</h2>
              <div className="grid grid-cols-[repeat(auto-fit,minmax(240px,1fr))] gap-3 md:grid-cols-[repeat(auto-fit,minmax(280px,1fr))] md:gap-4">
                {remainingTalks.map((talk, index) => (
                  <TalkCard
                    key={talk.uri}
                    talk={talk}
                    selected={selectedIndex === index + 1}
                    cardId={`talk-card-${encodeURIComponent(talk.uri)}`}
                  />
                ))}
              </div>
            </section>
          ) : null}
        </>
      ) : null}
    </div>
  )
}
