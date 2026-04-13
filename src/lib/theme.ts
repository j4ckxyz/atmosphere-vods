export type ThemePreference = 'system' | 'light' | 'dark'

const THEME_STORAGE_KEY = 'theme-preference'

function isThemePreference(value: string | null): value is ThemePreference {
  return value === 'system' || value === 'light' || value === 'dark'
}

export function getStoredThemePreference(): ThemePreference {
  if (typeof window === 'undefined') {
    return 'system'
  }

  const value = window.localStorage.getItem(THEME_STORAGE_KEY)
  return isThemePreference(value) ? value : 'system'
}

export function applyThemePreference(preference: ThemePreference) {
  if (typeof document === 'undefined') {
    return
  }

  if (preference === 'system') {
    document.documentElement.removeAttribute('data-theme')
    return
  }

  document.documentElement.setAttribute('data-theme', preference)
}

export function setThemePreference(preference: ThemePreference) {
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(THEME_STORAGE_KEY, preference)
  }
  applyThemePreference(preference)
}

export function initializeTheme() {
  applyThemePreference(getStoredThemePreference())
}
