type HapticPattern = number | ReadonlyArray<number>

const HAPTICS_DISABLED_KEY = 'haptics-disabled'
const SEEK_HAPTIC_INTERVAL_MS = 500

const PATTERNS = {
  tap: 8,
  select: 12,
  play: [10, 50, 20],
  seek: 6,
  success: [10, 80, 15],
  error: [30, 50, 30, 50, 30],
  back: 8,
} as const

let lastSeekHapticAt = 0

function supportsTouchMobile(): boolean {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return false
  }

  return navigator.maxTouchPoints > 0 && window.matchMedia('(hover: none)').matches
}

function hapticsDisabledByUser(): boolean {
  if (typeof window === 'undefined') {
    return false
  }

  return window.localStorage.getItem(HAPTICS_DISABLED_KEY) === 'true'
}

function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined') {
    return false
  }

  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

function canVibrate(): boolean {
  if (typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function') {
    return false
  }

  if (!supportsTouchMobile()) {
    return false
  }

  if (hapticsDisabledByUser()) {
    return false
  }

  if (prefersReducedMotion()) {
    return false
  }

  return true
}

function vibrate(pattern: HapticPattern) {
  if (!canVibrate()) {
    return
  }

  const normalizedPattern: number | number[] =
    typeof pattern === 'number' ? pattern : [...pattern]
  navigator.vibrate(normalizedPattern)
}

export function isTouchDevice(): boolean {
  if (typeof navigator === 'undefined') {
    return false
  }

  return navigator.maxTouchPoints > 0
}

export function isHapticsDisabledByUser(): boolean {
  return hapticsDisabledByUser()
}

export function setHapticsDisabled(disabled: boolean) {
  if (typeof window === 'undefined') {
    return
  }

  if (disabled) {
    window.localStorage.setItem(HAPTICS_DISABLED_KEY, 'true')
    return
  }

  window.localStorage.removeItem(HAPTICS_DISABLED_KEY)
}

export function hapticTap() {
  vibrate(PATTERNS.tap)
}

export function hapticSelect() {
  vibrate(PATTERNS.select)
}

export function hapticPlay() {
  vibrate(PATTERNS.play)
}

export function hapticSeek() {
  const now = Date.now()
  if (now - lastSeekHapticAt < SEEK_HAPTIC_INTERVAL_MS) {
    return
  }

  lastSeekHapticAt = now
  vibrate(PATTERNS.seek)
}

export function hapticSuccess() {
  vibrate(PATTERNS.success)
}

export function hapticError() {
  vibrate(PATTERNS.error)
}

export function hapticBack() {
  vibrate(PATTERNS.back)
}

export function cardTapHaptic() {
  hapticTap()
}
