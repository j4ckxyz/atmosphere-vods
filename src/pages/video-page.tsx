import {
  ArrowLeft,
  Maximize,
  Minimize,
  Pause,
  Play,
  Volume2,
  VolumeX,
} from 'lucide-react'
import {
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
import { fetchVideoPlaylist } from '@/lib/api'
import { formatDate, formatDuration, truncateDid } from '@/lib/format'
import { playHaptic } from '@/lib/haptics'
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
  const [isPlaying, setIsPlaying] = useState<boolean>(false)
  const [currentTime, setCurrentTime] = useState<number>(0)
  const [duration, setDuration] = useState<number>(0)
  const [volume, setVolume] = useState<number>(1)
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false)

  const resolvedUri = useMemo(
    () => (encodedUri ? fromVideoParam(encodedUri) : undefined),
    [encodedUri],
  )

  const talk = useMemo(() => talks.find((item) => item.uri === resolvedUri), [talks, resolvedUri])

  useEffect(() => {
    const onFullscreenChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement))
    }

    document.addEventListener('fullscreenchange', onFullscreenChange)
    return () => {
      document.removeEventListener('fullscreenchange', onFullscreenChange)
    }
  }, [])

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
          const { default: Hls } = await import('hls.js')
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

        setStatus('ready')
      } catch (loadError) {
        if (cancelled) {
          return
        }

        const message = loadError instanceof Error ? loadError.message : 'Failed to load video playlist.'
        setError(message)
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
    }
  }, [resolvedUri])

  const onTogglePlayback = useCallback(async () => {
    playHaptic()
    const video = videoRef.current
    if (!video) {
      return
    }

    if (video.paused) {
      try {
        await video.play()
        setIsPlaying(true)
      } catch {
        setError('Playback was blocked by the browser. Tap play again to retry.')
      }
      return
    }

    video.pause()
    setIsPlaying(false)
  }, [])

  const onTimeUpdate = useCallback(() => {
    if (!videoRef.current) {
      return
    }

    setCurrentTime(videoRef.current.currentTime)
    setDuration(Number.isFinite(videoRef.current.duration) ? videoRef.current.duration : 0)
    setIsPlaying(!videoRef.current.paused)
  }, [])

  const onSeek = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    const video = videoRef.current
    if (!video) {
      return
    }

    const seconds = Number(event.target.value)
    video.currentTime = seconds
    setCurrentTime(seconds)
  }, [])

  const onVolume = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    const video = videoRef.current
    if (!video) {
      return
    }

    const nextVolume = Number(event.target.value)
    video.volume = nextVolume
    video.muted = nextVolume === 0
    setVolume(nextVolume)
  }, [])

  const onToggleFullscreen = useCallback(async () => {
    const container = playerContainerRef.current
    if (!container) {
      return
    }

    if (!document.fullscreenElement) {
      await container.requestFullscreen()
      return
    }

    await document.exitFullscreen()
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
      <section className="glass-panel rounded-2xl p-5">
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
    <div className="space-y-5">
      <Button asChild variant="ghost" className="animate-rise">
        <Link to="/">
          <ArrowLeft className="h-4 w-4" />
          Back to browse
        </Link>
      </Button>

      <section className="glass-panel animate-rise rounded-2xl p-4 md:p-6" ref={playerContainerRef}>
        <div className="relative overflow-hidden rounded-xl border border-line bg-black/30">
          <video
            ref={videoRef}
            className="aspect-video w-full"
            controls={false}
            onTimeUpdate={onTimeUpdate}
            onLoadedMetadata={onTimeUpdate}
            onPause={() => setIsPlaying(false)}
            onPlay={() => setIsPlaying(true)}
          />

          {status === 'loading' ? (
            <div className="absolute inset-0 flex items-center justify-center bg-black/30 backdrop-blur-sm">
              <p className="text-sm text-text">Loading stream...</p>
            </div>
          ) : null}
        </div>

        {status === 'error' ? (
          <div className="mt-4">
            <ErrorPanel
              title="Playback failed"
              message={error ?? 'The video playlist could not be loaded.'}
              onRetry={() => window.location.reload()}
            />
          </div>
        ) : null}

        {status !== 'error' && error ? (
          <p className="mt-3 text-xs text-accent/90" role="status">
            {error}
          </p>
        ) : null}

        <div className="mt-4 space-y-4">
          <div className="flex items-center gap-2">
            <Button
              type="button"
              size="icon"
              variant="secondary"
              onClick={onTogglePlayback}
              aria-label={isPlaying ? 'Pause' : 'Play'}
            >
              {isPlaying ? <Pause /> : <Play />}
            </Button>

            <label className="flex-1">
              <span className="sr-only">Seek</span>
              <input
                type="range"
                min={0}
                max={Math.max(duration, 1)}
                value={Math.min(currentTime, duration || 0)}
                onChange={onSeek}
                className="h-11 w-full accent-[oklch(0.78_0.12_205)]"
              />
            </label>

            <Button
              type="button"
              size="icon"
              variant="secondary"
              onClick={onToggleFullscreen}
              aria-label={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
            >
              {isFullscreen ? <Minimize /> : <Maximize />}
            </Button>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-muted">
            <p>
              {formatDuration(currentTime * 1_000_000_000)} /{' '}
              {formatDuration(duration * 1_000_000_000 || talk?.durationNs || 0)}
            </p>

            <div className="flex min-h-11 items-center gap-2">
              {volume === 0 ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
              <label>
                <span className="sr-only">Volume</span>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={volume}
                  onChange={onVolume}
                  className="h-11 w-32 accent-[oklch(0.78_0.12_205)]"
                />
              </label>
            </div>

            <p className="text-xs text-muted md:hidden">Swipe down to dismiss</p>
          </div>
        </div>
      </section>

      {talk ? (
        <section className="glass-panel animate-rise rounded-2xl p-6" style={{ animationDelay: '80ms' }}>
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
