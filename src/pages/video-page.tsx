import {
  ArrowDownToLine,
  ArrowLeft,
} from 'lucide-react'
import {
  startTransition,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
} from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'

import { ErrorPanel } from '@/components/error-panel'
import { Button } from '@/components/ui/button'
import { fetchVideoPlaylist, getArchiveBlobUrl } from '@/lib/api'
import { formatDate, formatDuration, truncateDid } from '@/lib/format'
import { fromVideoParam } from '@/lib/routes'
import { useVideos } from '@/state/videos-context'

type PlaybackStatus = 'idle' | 'loading' | 'ready' | 'error'

interface HlsLike {
  loadSource: (source: string) => void
  attachMedia: (media: HTMLMediaElement) => void
  destroy: () => void
}

export function VideoPage() {
  const navigate = useNavigate()
  const { encodedUri } = useParams<{ encodedUri: string }>()
  const { talks, loading: talksLoading } = useVideos()

  const videoRef = useRef<HTMLVideoElement | null>(null)
  const hlsRef = useRef<HlsLike | null>(null)
  const playerContainerRef = useRef<HTMLDivElement | null>(null)

  const [status, setStatus] = useState<PlaybackStatus>('idle')
  const [error, setError] = useState<string | null>(null)
  const [currentTime, setCurrentTime] = useState<number>(0)
  const [duration, setDuration] = useState<number>(0)
  const rafRef = useRef<number | null>(null)
  const [reloadToken, setReloadToken] = useState(0)
  const [playbackRate, setPlaybackRate] = useState<number>(1)
  const [playlistUrl, setPlaylistUrl] = useState<string | null>(null)

  const resolvedUri = useMemo(
    () => (encodedUri ? fromVideoParam(encodedUri) : undefined),
    [encodedUri],
  )

  const talk = useMemo(() => talks.find((item) => item.uri === resolvedUri), [talks, resolvedUri])

  const playbackElapsed = formatDuration(currentTime * 1_000_000_000)
  const playbackTotal = formatDuration(duration * 1_000_000_000 || talk?.durationNs || 0)

  useEffect(() => {
    if (!resolvedUri || !videoRef.current) {
      return
    }

    const uri = resolvedUri
    const video = videoRef.current
    setStatus('loading')
    setError(null)
    setCurrentTime(0)

    let cancelled = false

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

        if (video.canPlayType('application/vnd.apple.mpegurl')) {
          video.src = playlistUrl
        } else {
          const { default: Hls } = await import('hls.js/light')
          if (!Hls.isSupported()) {
            throw new Error('This browser does not support HLS playback.')
          }

          const hls = new Hls({
            maxBufferLength: 30,
            lowLatencyMode: true,
          })
          hls.loadSource(playlistUrl)
          hls.attachMedia(video)
          hlsRef.current = hls
        }

        setPlaylistUrl(playlistUrl)
        setStatus('ready')
      } catch (loadError) {
        if (cancelled) {
          return
        }

        const message = loadError instanceof Error ? loadError.message : 'Failed to load video playlist.'
        setError(message)
        setPlaylistUrl(null)
        setStatus('error')
      }
    }

    load()

    return () => {
      cancelled = true
      if (hlsRef.current) {
        hlsRef.current.destroy()
        hlsRef.current = null
      }
      video.pause()
      video.removeAttribute('src')
      video.load()
      setPlaylistUrl(null)
    }
  }, [resolvedUri, reloadToken])

  const onRetryPlayback = useCallback(() => {
    setReloadToken((token) => token + 1)
  }, [])

  const syncPlaybackState = useCallback(() => {
    if (!videoRef.current) {
      return
    }

    const current = videoRef.current.currentTime
    const total = Number.isFinite(videoRef.current.duration) ? videoRef.current.duration : 0

    startTransition(() => {
      setCurrentTime(current)
      setDuration(total)
    })
  }, [])

  const onTimeUpdate = useCallback(() => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current)
    }

    rafRef.current = requestAnimationFrame(() => {
      syncPlaybackState()
      rafRef.current = null
    })
  }, [syncPlaybackState])

  useEffect(() => {
    return () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current)
      }
    }
  }, [])

  const onSpeedChange = useCallback((event: ChangeEvent<HTMLSelectElement>) => {
    const nextRate = Number(event.target.value)
    const video = videoRef.current
    if (!video) {
      return
    }
    video.playbackRate = nextRate
    setPlaybackRate(nextRate)
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

  if (!resolvedUri) {
    return (
      <ErrorPanel
        title="Invalid video link"
        message="This link is missing a valid AT URI."
        onRetry={() => navigate('/')}
      />
    )
  }

  if (!talk && talksLoading) {
    return (
      <section className="rounded-lg border border-line/45 bg-surface/80 p-5">
        <p className="text-sm text-muted">Loading video metadata...</p>
      </section>
    )
  }

  if (!talk && !talksLoading) {
    return (
      <ErrorPanel
        title="Talk not found"
        message="This video could not be located in the conference catalog."
        onRetry={() => navigate('/')}
      />
    )
  }

  return (
    <div className="space-y-7 md:space-y-10">
      <Button asChild variant="ghost">
        <Link to="/">
          <ArrowLeft className="h-4 w-4" />
          Back to Browse
        </Link>
      </Button>

      <section className="space-y-5" ref={playerContainerRef}>
        <div className="relative overflow-hidden rounded-xl border border-line/45 bg-surface/80">
          <video
            ref={videoRef}
            className="aspect-video w-full"
            controls
            onTimeUpdate={onTimeUpdate}
            onLoadedMetadata={onTimeUpdate}
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
              message={error ?? 'The video playlist could not be loaded.'}
              onRetry={onRetryPlayback}
            />
          </div>
        ) : null}

        {status !== 'error' && error ? (
          <p className="mt-3 text-xs text-muted" role="status">
            {error}
          </p>
        ) : null}

        <div className="flex flex-wrap items-center gap-3 text-sm text-muted">
          <p>
            {playbackElapsed} / {playbackTotal}
          </p>

          <label className="flex min-h-11 items-center gap-2">
            <span>Speed</span>
            <select
              value={playbackRate}
              onChange={onSpeedChange}
              className="h-11 rounded-lg border border-line/60 bg-surface/80 px-2 text-sm text-text"
            >
              <option value={0.5}>0.5x</option>
              <option value={1}>1x</option>
              <option value={1.25}>1.25x</option>
              <option value={1.5}>1.5x</option>
              <option value={2}>2x</option>
            </select>
          </label>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {playlistUrl ? (
            <a
              href={playlistUrl}
              download={`${talk?.title ?? 'talk'}.m3u8`}
              className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-line/60 bg-surface/80 px-3 text-sm text-text transition hover:bg-surface/90"
            >
              <ArrowDownToLine className="h-4 w-4" />
              Download HLS Playlist
            </a>
          ) : null}

          {talk?.sourceRef ? (
            <a
              href={getArchiveBlobUrl(talk.sourceRef)}
              download={`${talk.title}.mp4`}
              className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-line/60 bg-surface/80 px-3 text-sm text-text transition hover:bg-surface/90"
            >
              <ArrowDownToLine className="h-4 w-4" />
              Download Source MP4
            </a>
          ) : null}
        </div>
      </section>

      {talk ? (
        <section className="space-y-3 border-t border-line/40 pt-5">
          <h1 className="text-xl font-semibold leading-tight text-text md:text-2xl">{talk.title}</h1>
          <p className="mt-3 text-sm text-muted">Speaker: {talk.creatorName || truncateDid(talk.creatorDid)}</p>
          <p className="mt-2 text-sm text-muted">
            Duration: {formatDuration(talk.durationNs)} • Published {formatDate(talk.createdAt)}
          </p>
        </section>
      ) : null}
    </div>
  )
}
