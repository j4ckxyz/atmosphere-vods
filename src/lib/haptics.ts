type HapticPattern = number | ReadonlyArray<number>
type HapticIntent = 'tap' | 'select' | 'play' | 'seek' | 'success' | 'error' | 'back'

type BrowserVibrationPattern = number | Iterable<number>

type VibratingNavigator = Navigator & {
  vibrate?: (pattern: BrowserVibrationPattern) => boolean
}

type TelegramImpactStyle = 'light' | 'medium' | 'heavy' | 'rigid' | 'soft'
type TelegramNotificationType = 'error' | 'success' | 'warning'

interface TelegramWebAppHapticFeedback {
  impactOccurred?: (style: TelegramImpactStyle) => void
  notificationOccurred?: (type: TelegramNotificationType) => void
  selectionChanged?: () => void
}

interface TelegramNamespace {
  WebApp?: {
    HapticFeedback?: TelegramWebAppHapticFeedback
  }
}

type CapacitorImpactStyle = 'LIGHT' | 'MEDIUM' | 'HEAVY'
type CapacitorNotificationType = 'SUCCESS' | 'WARNING' | 'ERROR'

interface CapacitorHapticsPlugin {
  impact?: (options: { style: CapacitorImpactStyle }) => Promise<void> | void
  notification?: (options: { type: CapacitorNotificationType }) => Promise<void> | void
  selectionChanged?: () => Promise<void> | void
  vibrate?: (options?: { duration?: number }) => Promise<void> | void
}

interface CapacitorNamespace {
  Plugins?: {
    Haptics?: CapacitorHapticsPlugin
  }
}

type HapticsWindow = Window & {
  Telegram?: TelegramNamespace
  Capacitor?: CapacitorNamespace
}

const HAPTICS_DISABLED_KEY = 'haptics-disabled'
const SEEK_HAPTIC_INTERVAL_MS = 500
const GLOBAL_HAPTIC_INTERVAL_MS = 24
const MIN_HAPTIC_MS = 10
const MAX_HAPTIC_MS = 500
const IOS_SWITCH_MAX_PULSES = 5

const PATTERNS = {
  tap: 12,
  select: 16,
  play: [12, 36, 18],
  seek: 10,
  success: [10, 48, 20],
  error: [22, 34, 22, 34, 22],
  back: 12,
} as const

let lastSeekHapticAt = 0
let lastGlobalHapticAt = 0

function getHapticsWindow(): HapticsWindow | null {
  if (typeof window === 'undefined') {
    return null
  }

  return window as HapticsWindow
}

function getTelegramHaptics(): TelegramWebAppHapticFeedback | null {
  return getHapticsWindow()?.Telegram?.WebApp?.HapticFeedback ?? null
}

function getCapacitorHaptics(): CapacitorHapticsPlugin | null {
  return getHapticsWindow()?.Capacitor?.Plugins?.Haptics ?? null
}

function hasNavigatorVibrationSupport(): boolean {
  if (typeof navigator === 'undefined') {
    return false
  }

  return typeof (navigator as VibratingNavigator).vibrate === 'function'
}

function hasTelegramHapticsSupport(): boolean {
  const haptics = getTelegramHaptics()
  if (!haptics) {
    return false
  }

  return (
    typeof haptics.selectionChanged === 'function' ||
    typeof haptics.impactOccurred === 'function' ||
    typeof haptics.notificationOccurred === 'function'
  )
}

function hasCapacitorHapticsSupport(): boolean {
  const haptics = getCapacitorHaptics()
  if (!haptics) {
    return false
  }

  return (
    typeof haptics.selectionChanged === 'function' ||
    typeof haptics.impact === 'function' ||
    typeof haptics.notification === 'function' ||
    typeof haptics.vibrate === 'function'
  )
}

function isLikelyIOSDevice(): boolean {
  if (typeof navigator === 'undefined') {
    return false
  }

  const ua = navigator.userAgent ?? ''
  const platform = navigator.platform ?? ''

  return /iPad|iPhone|iPod/.test(ua) || (platform === 'MacIntel' && navigator.maxTouchPoints > 1)
}

function hasIosSwitchHapticsSupport(): boolean {
  if (typeof document === 'undefined') {
    return false
  }

  return isLikelyIOSDevice() && isTouchDevice() && typeof document.createElement === 'function'
}

function supportsNavigatorVibrationPath(): boolean {
  return hasNavigatorVibrationSupport() && isTouchDevice()
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

function isDocumentVisible(): boolean {
  if (typeof document === 'undefined') {
    return true
  }

  return document.visibilityState === 'visible'
}

function normalizePattern(pattern: HapticPattern): number | number[] {
  if (typeof pattern === 'number') {
    const normalized = Math.round(pattern)
    return Math.max(MIN_HAPTIC_MS, Math.min(MAX_HAPTIC_MS, normalized))
  }

  const normalized = pattern
    .map((value) => Math.round(value))
    .map((value, index) => {
      if (index % 2 === 1) {
        return Math.max(0, Math.min(MAX_HAPTIC_MS, value))
      }
      return Math.max(MIN_HAPTIC_MS, Math.min(MAX_HAPTIC_MS, value))
    })

  return normalized
}

function getFirstPulseDuration(pattern: number | number[]): number {
  if (typeof pattern === 'number') {
    return pattern
  }

  if (pattern.length === 0) {
    return MIN_HAPTIC_MS
  }

  return pattern[0]
}

function hasAnyHapticsSupport(): boolean {
  return (
    hasTelegramHapticsSupport() ||
    hasCapacitorHapticsSupport() ||
    supportsNavigatorVibrationPath() ||
    hasIosSwitchHapticsSupport()
  )
}

function canTriggerHaptics(): boolean {
  if (!hasAnyHapticsSupport()) {
    return false
  }

  if (!isDocumentVisible()) {
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

function triggerTelegramHaptic(intent: HapticIntent): boolean {
  const haptics = getTelegramHaptics()
  if (!haptics) {
    return false
  }

  try {
    if (intent === 'success' || intent === 'error') {
      if (typeof haptics.notificationOccurred === 'function') {
        haptics.notificationOccurred(intent === 'success' ? 'success' : 'error')
        return true
      }
    }

    if (intent === 'play') {
      if (typeof haptics.impactOccurred === 'function') {
        haptics.impactOccurred('medium')
        return true
      }
    }

    if (typeof haptics.selectionChanged === 'function') {
      haptics.selectionChanged()
      return true
    }

    if (typeof haptics.impactOccurred === 'function') {
      haptics.impactOccurred('light')
      return true
    }
  } catch {
    return false
  }

  return false
}

function triggerCapacitorHaptic(intent: HapticIntent, pattern: number | number[]): boolean {
  const haptics = getCapacitorHaptics()
  if (!haptics) {
    return false
  }

  try {
    if (intent === 'success' || intent === 'error') {
      if (typeof haptics.notification === 'function') {
        void haptics.notification({ type: intent === 'success' ? 'SUCCESS' : 'ERROR' })
        return true
      }
    }

    if (intent === 'play') {
      if (typeof haptics.impact === 'function') {
        void haptics.impact({ style: 'MEDIUM' })
        return true
      }
    }

    if (typeof haptics.selectionChanged === 'function') {
      void haptics.selectionChanged()
      return true
    }

    if (typeof haptics.impact === 'function') {
      void haptics.impact({ style: 'LIGHT' })
      return true
    }

    if (typeof haptics.vibrate === 'function') {
      void haptics.vibrate({ duration: getFirstPulseDuration(pattern) })
      return true
    }
  } catch {
    return false
  }

  return false
}

function triggerNavigatorVibration(pattern: number | number[]): boolean {
  if (!supportsNavigatorVibrationPath()) {
    return false
  }

  const vibration = (navigator as VibratingNavigator).vibrate
  if (!vibration) {
    return false
  }

  try {
    const success = vibration(pattern)
    if (success) {
      return true
    }

    if (Array.isArray(pattern) && pattern.length > 0) {
      return vibration(pattern[0])
    }
  } catch {
    return false
  }

  return false
}

function triggerIosSwitchPulse(): boolean {
  if (typeof document === 'undefined' || !document.body) {
    return false
  }

  try {
    const input = document.createElement('input')
    input.type = 'checkbox'
    input.setAttribute('switch', '')
    input.setAttribute('aria-hidden', 'true')
    input.tabIndex = -1

    const label = document.createElement('label')
    label.style.position = 'fixed'
    label.style.left = '-9999px'
    label.style.top = '-9999px'
    label.style.opacity = '0'
    label.style.pointerEvents = 'none'
    label.style.width = '1px'
    label.style.height = '1px'
    label.style.overflow = 'hidden'
    label.appendChild(input)

    document.body.appendChild(label)
    label.click()
    label.remove()
    return true
  } catch {
    return false
  }
}

function triggerIosSwitchHaptic(pattern: number | number[]): boolean {
  if (!hasIosSwitchHapticsSupport()) {
    return false
  }

  const sequence = typeof pattern === 'number' ? [pattern] : [...pattern]
  if (sequence.length === 0) {
    return false
  }

  let offsetMs = 0
  let pulses = 0
  let triggered = false

  for (let index = 0; index < sequence.length && pulses < IOS_SWITCH_MAX_PULSES; index += 1) {
    const step = Math.max(0, Math.round(sequence[index] ?? 0))
    const isPulse = index % 2 === 0

    if (isPulse) {
      const runPulse = () => {
        if (triggerIosSwitchPulse()) {
          triggered = true
        }
      }

      if (offsetMs === 0) {
        runPulse()
      } else {
        window.setTimeout(runPulse, offsetMs)
      }

      pulses += 1
    }

    offsetMs += step
  }

  return triggered || pulses > 0
}

function triggerHaptic(intent: HapticIntent, pattern: HapticPattern) {
  if (!canTriggerHaptics()) {
    return
  }

  const now = Date.now()
  if (now - lastGlobalHapticAt < GLOBAL_HAPTIC_INTERVAL_MS) {
    return
  }

  lastGlobalHapticAt = now
  const normalizedPattern = normalizePattern(pattern)

  if (triggerTelegramHaptic(intent)) {
    return
  }

  if (triggerCapacitorHaptic(intent, normalizedPattern)) {
    return
  }

  if (triggerNavigatorVibration(normalizedPattern)) {
    return
  }

  triggerIosSwitchHaptic(normalizedPattern)
}

export function isTouchDevice(): boolean {
  if (typeof navigator === 'undefined') {
    return false
  }

  return navigator.maxTouchPoints > 0
}

export function isHapticsSupported(): boolean {
  return hasAnyHapticsSupport()
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
  triggerHaptic('tap', PATTERNS.tap)
}

export function hapticSelect() {
  triggerHaptic('select', PATTERNS.select)
}

export function hapticPlay() {
  triggerHaptic('play', PATTERNS.play)
}

export function hapticSeek() {
  const now = Date.now()
  if (now - lastSeekHapticAt < SEEK_HAPTIC_INTERVAL_MS) {
    return
  }

  lastSeekHapticAt = now
  triggerHaptic('seek', PATTERNS.seek)
}

export function hapticSuccess() {
  triggerHaptic('success', PATTERNS.success)
}

export function hapticError() {
  triggerHaptic('error', PATTERNS.error)
}

export function hapticBack() {
  triggerHaptic('back', PATTERNS.back)
}

export function cardTapHaptic() {
  hapticTap()
}
