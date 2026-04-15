import {
  ArrowDownToLine,
  ArrowLeft,
} from 'lucide-react'
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'

import { ErrorPanel } from '@/components/error-panel'
import { Button } from '@/components/ui/button'
import { fetchTalkByUri, fetchVideoPlaylist, getArchiveBlobUrl, isAtmosphereTalk } from '@/lib/api'
import { formatDate, formatDateTime, formatDuration, truncateDid } from '@/lib/format'
import {
  hapticBack,
  hapticError,
  hapticPlay,
  hapticSeek,
  hapticSuccess,
} from '@/lib/haptics'
import { fetchAtmosphereIonosphereEnrichment } from '@/lib/ionosphere'
import { toTagPath, toVideoUriFromParams } from '@/lib/routes'
import { getTalkTaxonomyTokens } from '@/lib/taxonomy'
import { useKeyboard } from '@/lib/use-keyboard'
import type { AppTalk, IonosphereEnrichment } from '@/lib/types'
import { useVideos } from '@/state/videos-context'

type PlaybackStatus = 'idle' | 'loading' | 'ready' | 'error'

interface HlsLike {
  loadSource: (source: string) => void
  attachMedia: (media: HTMLMediaElement) => void
  destroy: () => void
}

export function VideoPage() {
  const navigate = useNavigate()
  const { didParam, rkeyParam } = useParams<{ didParam: string; rkeyParam: string }>()
  const { talks, loading: talksLoading } = useVideos()

  const videoRef = useRef<HTMLVideoElement | null>(null)
  const hlsRef = useRef<HlsLike | null>(null)
  const playerContainerRef = useRef<HTMLDivElement | null>(null)

  const [videoElement, setVideoElement] = useState<HTMLVideoElement | null>(null)
  const [status, setStatus] = useState<PlaybackStatus>('idle')
  const [error, setError] = useState<string | null>(null)
  const [reloadToken, setReloadToken] = useState(0)
  const [playlistUrl, setPlaylistUrl] = useState<string | null>(null)
  const [resolvedTalk, setResolvedTalk] = useState<AppTalk | null>(null)
  const [metadataLoading, setMetadataLoading] = useState<boolean>(false)
  const [ionosphere, setIonosphere] = useState<IonosphereEnrichment | null>(null)

  const handleVideoRef = useCallback((node: HTMLVideoElement | null) => {
    videoRef.current = node
    setVideoElement(node)
  }, [])

  const resolvedUri = useMemo(
    () => (didParam && rkeyParam ? toVideoUriFromParams(didParam, rkeyParam) : undefined),
    [didParam, rkeyParam],
  )

  const talk = useMemo(
    () => talks.find((item) => item.uri === resolvedUri) ?? resolvedTalk,
    [talks, resolvedUri, resolvedTalk],
  )
  const talkTokens = useMemo(() => (talk ? getTalkTaxonomyTokens(talk).slice(0, 10) : []), [talk])

  useEffect(() => {
    if (!resolvedUri) {
      return
    }

    if (talksLoading) {
      setMetadataLoading(false)
      return
    }

    const alreadyInCatalog = talks.some((item) => item.uri === resolvedUri)
    if (alreadyInCatalog) {
      setResolvedTalk(null)
      setMetadataLoading(false)
      return
    }

    let active = true
    setMetadataLoading(true)

    fetchTalkByUri(resolvedUri)
      .then((record) => {
        if (!active) {
          return
        }
        setResolvedTalk(record)
      })
      .catch(() => {
        if (!active) {
          return
        }
        setResolvedTalk(null)
      })
      .finally(() => {
        if (active) {
          setMetadataLoading(false)
        }
      })

    return () => {
      active = false
    }
  }, [resolvedUri, talks, talksLoading])

  useEffect(() => {
    if (!resolvedUri || !videoElement) {
      return
    }

    const uri = resolvedUri
    const video = videoElement
    setStatus('loading')
    setError(null)
    setPlaylistUrl(null)

    let cancelled = false

    const onVideoError = () => {
      if (cancelled) {
        return
      }

      setError('Video playback failed in this browser. Please retry.')
      setStatus('error')
      hapticError()
    }

    video.addEventListener('error', onVideoError)

    async function load() {
      try {
        const playlistUrl = await fetchVideoPlaylist(uri)
        if (cancelled) {
          return
        }

        if (hlsRef.current) {
          hlsRef.current.destroy()
          hlsRef.current = null
        }

        const { default: Hls } = await import('hls.js')
        if (cancelled) {
          return
        }

        if (Hls.isSupported()) {
          const hls = new Hls({
            maxBufferLength: 30,
            lowLatencyMode: true,
          })
          hls.loadSource(playlistUrl)
          hls.attachMedia(video)
          hlsRef.current = hls
        } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
          video.src = playlistUrl
          video.load()
        } else {
          throw new Error('This browser does not support HLS playback.')
        }

        video.muted = false
        video.volume = Math.max(video.volume || 1, 0.75)

        setPlaylistUrl(playlistUrl)
        setError(null)
        setStatus('ready')
        hapticSuccess()
      } catch (loadError) {
        if (cancelled) {
          return
        }

        const message = loadError instanceof Error ? loadError.message : 'Failed to load video playlist.'
        setError(message)
        setPlaylistUrl(null)
        setStatus('error')
        hapticError()
      }
    }

    load()

    return () => {
      cancelled = true
      video.removeEventListener('error', onVideoError)
      if (hlsRef.current) {
        hlsRef.current.destroy()
        hlsRef.current = null
      }
      video.pause()
      video.removeAttribute('src')
      video.load()
      setPlaylistUrl(null)
    }
  }, [resolvedUri, reloadToken, videoElement])

  useEffect(() => {
    if (!talk || !isAtmosphereTalk(talk)) {
      setIonosphere(null)
      return
    }

    let active = true
    fetchAtmosphereIonosphereEnrichment([talk])
      .then((result) => {
        if (!active) {
          return
        }
        setIonosphere(result.byVodUri.get(talk.uri) ?? null)
      })
      .catch(() => {
        if (active) {
          setIonosphere(null)
        }
      })

    return () => {
      active = false
    }
  }, [talk])

  const onRetryPlayback = useCallback(() => {
    hapticPlay()
    setReloadToken((token) => token + 1)
  }, [])

  useEffect(() => {
    let startY = 0
    let latestY = 0

    const element = playerContainerRef.current
    if (!element) {
      return
    }

    const onTouchStart = (event: TouchEvent) => {
      startY = event.touches[0]?.clientY ?? 0
      latestY = startY
    }

    const onTouchMove = (event: TouchEvent) => {
      latestY = event.touches[0]?.clientY ?? latestY
    }

    const onTouchEnd = () => {
      const distance = latestY - startY
      if (distance > 120) {
        hapticBack()
        navigate(-1)
      }
    }

    element.addEventListener('touchstart', onTouchStart, { passive: true })
    element.addEventListener('touchmove', onTouchMove, { passive: true })
    element.addEventListener('touchend', onTouchEnd)

    return () => {
      element.removeEventListener('touchstart', onTouchStart)
      element.removeEventListener('touchmove', onTouchMove)
      element.removeEventListener('touchend', onTouchEnd)
    }
  }, [navigate])

  useKeyboard((event) => {
    const video = videoRef.current
    if (!video || event.metaKey || event.ctrlKey || event.altKey) {
      return
    }

    const key = event.key
    const lower = key.toLowerCase()

    if (key === ' ') {
      event.preventDefault()
      hapticPlay()
      if (video.paused) {
        void video.play()
      } else {
        video.pause()
      }
      return
    }

    if (lower === 'k') {
      event.preventDefault()
      hapticPlay()
      if (video.paused) {
        void video.play()
      } else {
        video.pause()
      }
      return
    }

    if (lower === 'j') {
      event.preventDefault()
      video.currentTime = Math.max(0, video.currentTime - 10)
      hapticSeek()
      return
    }

    if (lower === 'l') {
      event.preventDefault()
      const duration = Number.isFinite(video.duration) ? video.duration : video.currentTime + 10
      video.currentTime = Math.min(duration, video.currentTime + 10)
      hapticSeek()
      return
    }

    if (lower === 'f') {
      event.preventDefault()
      const container = playerContainerRef.current
      if (!container) {
        return
      }

      if (document.fullscreenElement) {
        void document.exitFullscreen()
      } else {
        void container.requestFullscreen()
      }
      return
    }

    if (lower === 'm') {
      event.preventDefault()
      video.muted = !video.muted
      return
    }

    if (/^[0-9]$/.test(key)) {
      event.preventDefault()
      const pct = Number(key) / 10
      if (Number.isFinite(video.duration) && video.duration > 0) {
        video.currentTime = video.duration * pct
        hapticSeek()
      }
      return
    }

    if (key === '<' || key === ',') {
      event.preventDefault()
      const nextRate = Math.max(0.25, video.playbackRate - 0.25)
      video.playbackRate = nextRate
      return
    }

    if (key === '>' || key === '.') {
      event.preventDefault()
      const nextRate = Math.min(4, video.playbackRate + 0.25)
      video.playbackRate = nextRate
      return
    }

    if (key === 'Escape') {
      event.preventDefault()
      hapticBack()
      navigate('/')
    }
  })

  if (!resolvedUri) {
    return (
      <ErrorPanel
        title="Invalid video link"
        message="This video link is missing required information. Go back and open the video again."
        onRetry={() => navigate('/')}
      />
    )
  }

  if (!talk && (talksLoading || metadataLoading)) {
    return (
      <section className="rounded-lg border border-line/45 bg-surface/80 p-5">
        <p className="text-sm text-muted">Loading video details...</p>
      </section>
    )
  }

  if (!talk && !talksLoading) {
    return (
      <ErrorPanel
        title="Talk not found"
        message="We couldn't find this video in the current catalog. It may have been removed or moved."
        onRetry={() => navigate('/')}
      />
    )
  }

  return (
    <div className="space-y-7 md:space-y-10">
      <Button asChild variant="ghost">
        <Link
          to="/"
          onClick={() => {
            hapticBack()
          }}
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Browse
        </Link>
      </Button>

      <section className="space-y-5" ref={playerContainerRef}>
        <div className="relative overflow-hidden rounded-xl border border-line/45 bg-surface/80">
          <video
            ref={handleVideoRef}
            className="aspect-video w-full"
            controls
            playsInline
          />

          {status === 'loading' ? (
            <div className="absolute inset-0 flex items-center justify-center bg-bg/70">
              <p className="text-sm text-text">Loading stream...</p>
            </div>
          ) : null}
        </div>

        {status === 'error' ? (
          <div className="mt-4">
            <ErrorPanel
              title="Playback failed"
              message={error ?? "We couldn't load this video's playlist."}
              onRetry={onRetryPlayback}
            />
          </div>
        ) : null}

        {status !== 'error' && error ? (
          <p className="mt-3 text-xs text-muted" role="status">
            {error}
          </p>
        ) : null}

        <div className="flex flex-wrap items-center gap-3">
          {playlistUrl ? (
            <a
              href={playlistUrl}
              download={`${talk?.title ?? 'talk'}.m3u8`}
              className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-line/60 bg-surface/80 px-3 text-sm text-text transition hover:bg-surface/90"
            >
              <ArrowDownToLine className="h-4 w-4" />
              Download playlist (.m3u8)
            </a>
          ) : null}

          {talk?.sourceRef ? (
            <a
              href={getArchiveBlobUrl(talk.sourceRepoDid, talk.sourceRef)}
              download={`${talk.title}.mp4`}
              className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-line/60 bg-surface/80 px-3 text-sm text-text transition hover:bg-surface/90"
            >
              <ArrowDownToLine className="h-4 w-4" />
              Download source MP4
            </a>
          ) : null}
        </div>

        {talkTokens.length > 0 ? (
          <section className="space-y-2">
            <h2 className="text-sm font-medium text-muted">Topics</h2>
            <div className="flex flex-wrap gap-2">
              {talkTokens.map((token) => (
                <Link
                  key={token}
                  to={toTagPath(token)}
                  className="inline-flex min-h-11 items-center rounded-md border border-line/45 bg-surface/80 px-3 text-xs text-muted transition hover:border-line/60 hover:text-text"
                >
                  #{token}
                </Link>
              ))}
            </div>
          </section>
        ) : null}
      </section>

      {talk ? (
        <section className="space-y-3 border-t border-line/40 pt-5">
          <h1 className="text-xl font-semibold leading-tight text-text md:text-2xl">{talk.title}</h1>
          <p className="mt-3 text-sm text-muted">Speaker: {talk.creatorName || truncateDid(talk.creatorDid)}</p>
          <p className="mt-2 text-sm text-muted">
            Duration: {formatDuration(talk.durationNs)} • Published {formatDate(talk.createdAt)}
          </p>

          {ionosphere ? (
            <article className="mt-4 space-y-3 rounded-lg border border-line/45 bg-surface/80 p-4">
              <h2 className="text-sm font-medium text-text">Discussion</h2>
              <p className="text-xs text-muted">
                {ionosphere.room ?? 'Room TBD'} • {ionosphere.track ?? 'Track TBD'}
                {ionosphere.scheduledAt ? ` • ${formatDateTime(ionosphere.scheduledAt)}` : ''}
              </p>

              {ionosphere.speakerName ? (
                <p className="text-xs text-muted">
                  Featured speaker: {ionosphere.speakerName}
                  {ionosphere.speakerHandle ? ` (@${ionosphere.speakerHandle})` : ''}
                </p>
              ) : null}

              {ionosphere.topicMentions.length > 0 ? (
                <section className="space-y-2">
                  <h3 className="text-xs font-medium uppercase tracking-wide text-muted">Reactions</h3>
                  <div className="flex flex-wrap gap-2">
                    {ionosphere.topicMentions.map((entry) => (
                      <Link
                        key={entry.topic}
                        to={toTagPath(entry.topic)}
                        className="inline-flex min-h-11 items-center gap-1 rounded-md border border-line/45 bg-surface/70 px-3 text-xs text-muted transition hover:border-line/60 hover:text-text"
                      >
                        <span>{entry.topic}</span>
                        <span className="text-[11px] text-muted/90">×{entry.mentions}</span>
                      </Link>
                    ))}
                  </div>
                </section>
              ) : null}

              {ionosphere.transcriptPreview.length > 0 ? (
                <section className="space-y-2">
                  <h3 className="text-xs font-medium uppercase tracking-wide text-muted">Transcript highlights</h3>
                  <div className="space-y-2">
                    {ionosphere.transcriptPreview.map((line, index) => (
                      <p key={`${index}-${line.slice(0, 16)}`} className="text-sm leading-relaxed text-muted">
                        {line}
                      </p>
                    ))}
                  </div>
                </section>
              ) : null}
            </article>
          ) : null}
        </section>
      ) : null}
    </div>
  )
}
