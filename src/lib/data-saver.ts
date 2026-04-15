const DATA_SAVER_KEY = 'data-saver-enabled'
const DATA_SAVER_EVENT = 'data-saver-change'

type NavigatorWithConnection = Navigator & {
  connection?: {
    saveData?: boolean
  }
}

interface DataSaverChangeDetail {
  enabled: boolean
}

interface DataSaverWindow extends Window {
  CustomEvent: typeof CustomEvent
}

type DataSaverListener = (enabled: boolean) => void

function canUseDom(): boolean {
  return typeof window !== 'undefined' && typeof navigator !== 'undefined'
}

function isTouchDevice(): boolean {
  if (typeof navigator === 'undefined') {
    return false
  }

  return navigator.maxTouchPoints > 0
}

function getSystemReducedDataPreference(): boolean {
  if (!canUseDom()) {
    return false
  }

  const saveDataEnabled = Boolean((navigator as NavigatorWithConnection).connection?.saveData)
  const reducedDataMedia =
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-data: reduce)').matches

  return saveDataEnabled || reducedDataMedia
}

function getStoredPreference(): boolean | null {
  if (!canUseDom()) {
    return null
  }

  try {
    const raw = window.localStorage.getItem(DATA_SAVER_KEY)
    if (raw === 'true') {
      return true
    }
    if (raw === 'false') {
      return false
    }
  } catch {
    return null
  }

  return null
}

function dispatchDataSaverChange(enabled: boolean) {
  if (typeof window === 'undefined') {
    return
  }

  const safeWindow = window as DataSaverWindow
  window.dispatchEvent(new safeWindow.CustomEvent<DataSaverChangeDetail>(DATA_SAVER_EVENT, { detail: { enabled } }))
}

export function isDataSaverSupported(): boolean {
  return isTouchDevice()
}

export function isDataSaverEnabled(): boolean {
  const stored = getStoredPreference()
  if (stored !== null) {
    return stored
  }

  return getSystemReducedDataPreference()
}

export function setDataSaverEnabled(enabled: boolean) {
  if (!canUseDom()) {
    return
  }

  try {
    window.localStorage.setItem(DATA_SAVER_KEY, enabled ? 'true' : 'false')
  } catch {
    return
  }

  dispatchDataSaverChange(enabled)
}

export function subscribeToDataSaver(listener: DataSaverListener): () => void {
  if (typeof window === 'undefined') {
    return () => undefined
  }

  const onCustomChange = (event: Event) => {
    const detail = (event as CustomEvent<DataSaverChangeDetail>).detail
    if (detail && typeof detail.enabled === 'boolean') {
      listener(detail.enabled)
      return
    }

    listener(isDataSaverEnabled())
  }

  const onStorage = (event: StorageEvent) => {
    if (event.key && event.key !== DATA_SAVER_KEY) {
      return
    }
    listener(isDataSaverEnabled())
  }

  window.addEventListener(DATA_SAVER_EVENT, onCustomChange)
  window.addEventListener('storage', onStorage)

  return () => {
    window.removeEventListener(DATA_SAVER_EVENT, onCustomChange)
    window.removeEventListener('storage', onStorage)
  }
}
