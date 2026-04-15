import { fetchVideoPlaylist } from './api'
import { isDataSaverEnabled } from './data-saver'

const THUMBNAIL_KEY_PREFIX = 'thumb:'
const THUMBNAIL_QUALITY = 0.6
const THUMBNAIL_SEEK_SECONDS = 15
const THUMBNAIL_MAX_WIDTH = 480
const THUMBNAIL_MAX_HEIGHT = 270
const EXTRACTION_CONCURRENCY = 2
const IDLE_EXTRACTION_TIMEOUT_MS = 2_000

type ThumbnailResult = string | null

type IdleCallback = (deadline: { didTimeout: boolean; timeRemaining: () => number }) => void

type IdleWindow = Window & {
  requestIdleCallback?: (callback: IdleCallback, options?: { timeout: number }) => number
}

const inflightExtractions = new Map<string, Promise<ThumbnailResult>>()
const extractionQueue: Array<() => void> = []
let activeExtractions = 0

function getStorageKey(uri: string): string {
  return `${THUMBNAIL_KEY_PREFIX}${uri}`
}

function canUseDom(): boolean {
  return typeof window !== 'undefined' && typeof document !== 'undefined'
}

function prefersReducedData(): boolean {
  if (!canUseDom()) {
    return false
  }

  return isDataSaverEnabled()
}

function runWhenBrowserIdle(task: () => Promise<ThumbnailResult>): Promise<ThumbnailResult> {
  if (!canUseDom()) {
    return task()
  }

  const idleWindow = window as IdleWindow
  return new Promise((resolve, reject) => {
    const execute: IdleCallback = () => {
      task().then(resolve).catch(reject)
    }

    if (typeof idleWindow.requestIdleCallback === 'function') {
      idleWindow.requestIdleCallback(execute, { timeout: IDLE_EXTRACTION_TIMEOUT_MS })
      return
    }

    window.setTimeout(execute, 0)
  })
}

function runWithConcurrencyLimit(task: () => Promise<ThumbnailResult>): Promise<ThumbnailResult> {
  return new Promise((resolve, reject) => {
    const run = () => {
      activeExtractions += 1
      task()
        .then(resolve)
        .catch(reject)
        .finally(() => {
          activeExtractions -= 1
          const next = extractionQueue.shift()
          if (next) {
            next()
          }
        })
    }

    if (activeExtractions < EXTRACTION_CONCURRENCY) {
      run()
      return
    }

    extractionQueue.push(run)
  })
}

function waitForVideoEvent(
  video: HTMLVideoElement,
  eventName: 'loadedmetadata' | 'seeked',
  timeoutMs: number = 12_000,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const timeout = window.setTimeout(() => {
      cleanup()
      reject(new Error(`Video ${eventName} timed out`))
    }, timeoutMs)

    function cleanup() {
      window.clearTimeout(timeout)
      video.removeEventListener(eventName, onSuccess)
      video.removeEventListener('error', onError)
    }

    function onSuccess() {
      cleanup()
      resolve()
    }

    function onError() {
      cleanup()
      reject(new Error('Video extraction failed'))
    }

    video.addEventListener(eventName, onSuccess, { once: true })
    video.addEventListener('error', onError, { once: true })
  })
}

function saveThumbnail(uri: string, dataUrl: string) {
  try {
    localStorage.setItem(getStorageKey(uri), dataUrl)
  } catch {
    // no-op: storage quota or unavailable storage should not block UI
  }
}

export function getCachedThumbnail(uri: string): string | null {
  if (!canUseDom()) {
    return null
  }

  try {
    return localStorage.getItem(getStorageKey(uri))
  } catch {
    return null
  }
}

async function extractThumbnail(uri: string): Promise<ThumbnailResult> {
  if (!canUseDom() || prefersReducedData()) {
    return null
  }

  const cached = getCachedThumbnail(uri)
  if (cached) {
    return cached
  }

  const playlistUrl = await fetchVideoPlaylist(uri)
  const video = document.createElement('video')

  video.crossOrigin = 'anonymous'
  video.muted = true
  video.preload = 'metadata'
  video.playsInline = true
  video.setAttribute('muted', '')
  video.setAttribute('aria-hidden', 'true')
  video.style.position = 'fixed'
  video.style.left = '-9999px'
  video.style.top = '-9999px'
  video.style.width = '1px'
  video.style.height = '1px'
  video.style.opacity = '0'

  document.body.appendChild(video)

  let hls: { destroy: () => void; loadSource: (source: string) => void; attachMedia: (media: HTMLMediaElement) => void } | null = null

  try {
    if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = playlistUrl
    } else {
      const { default: Hls } = await import('hls.js')
      if (!Hls.isSupported()) {
        return null
      }

      const hlsInstance = new Hls({
        maxBufferLength: 10,
        lowLatencyMode: true,
      })
      hlsInstance.loadSource(playlistUrl)
      hlsInstance.attachMedia(video)
      hls = hlsInstance
    }

    if (!(video.readyState >= 1 && Number.isFinite(video.duration) && video.duration > 0)) {
      await waitForVideoEvent(video, 'loadedmetadata')
    }

    if (!Number.isFinite(video.duration) || video.duration <= 0) {
      return null
    }

    const targetTime = video.duration >= THUMBNAIL_SEEK_SECONDS
      ? THUMBNAIL_SEEK_SECONDS
      : video.duration * 0.1

    if (targetTime > 0.01 && Math.abs(video.currentTime - targetTime) > 0.05) {
      const seekPromise = waitForVideoEvent(video, 'seeked')
      video.currentTime = Math.min(targetTime, Math.max(video.duration - 0.1, 0))
      await seekPromise
    }

    if (video.videoWidth <= 0 || video.videoHeight <= 0) {
      return null
    }

    const scale = Math.min(
      1,
      THUMBNAIL_MAX_WIDTH / video.videoWidth,
      THUMBNAIL_MAX_HEIGHT / video.videoHeight,
    )
    const outputWidth = Math.max(1, Math.round(video.videoWidth * scale))
    const outputHeight = Math.max(1, Math.round(video.videoHeight * scale))

    const canvas = document.createElement('canvas')
    canvas.width = outputWidth
    canvas.height = outputHeight

    const ctx = canvas.getContext('2d')
    if (!ctx) {
      return null
    }

    ctx.imageSmoothingEnabled = true
    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(video, 0, 0, outputWidth, outputHeight)
    const dataUrl = canvas.toDataURL('image/jpeg', THUMBNAIL_QUALITY)

    if (!dataUrl.startsWith('data:image/jpeg')) {
      return null
    }

    saveThumbnail(uri, dataUrl)
    return dataUrl
  } catch {
    return null
  } finally {
    if (hls) {
      hls.destroy()
    }
    video.pause()
    video.removeAttribute('src')
    video.load()
    video.remove()
  }
}

export async function getOrCreateThumbnail(uri: string): Promise<ThumbnailResult> {
  const cached = getCachedThumbnail(uri)
  if (cached) {
    return cached
  }

  if (prefersReducedData()) {
    return null
  }

  const inflight = inflightExtractions.get(uri)
  if (inflight) {
    return inflight
  }

  const pending = runWithConcurrencyLimit(() => runWhenBrowserIdle(() => extractThumbnail(uri))).finally(
    () => {
      inflightExtractions.delete(uri)
    },
  )

  inflightExtractions.set(uri, pending)
  return pending
}
