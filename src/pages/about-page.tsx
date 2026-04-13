import { useState } from 'react'

import {
  getStoredThemePreference,
  setThemePreference,
  type ThemePreference,
} from '@/lib/theme'
import {
  hapticTap,
  isHapticsDisabledByUser,
  isTouchDevice,
  setHapticsDisabled,
} from '@/lib/haptics'

export function AboutPage() {
  const [themePreference, setLocalThemePreference] = useState<ThemePreference>(() => getStoredThemePreference())
  const [showHapticsToggle] = useState<boolean>(() => isTouchDevice())
  const [hapticsDisabled, setLocalHapticsDisabled] = useState<boolean>(() => isHapticsDisabledByUser())

  const onThemeChange = (value: ThemePreference) => {
    setLocalThemePreference(value)
    setThemePreference(value)
    hapticTap()
  }

  const onHapticsToggle = () => {
    const nextDisabled = !hapticsDisabled
    setLocalHapticsDisabled(nextDisabled)
    setHapticsDisabled(nextDisabled)
    if (!nextDisabled) {
      hapticTap()
    }
  }

  return (
    <div className="space-y-4">
      <section className="rounded-lg border border-line/45 bg-surface/80 p-5 md:p-6">
        <h1 className="text-2xl font-semibold text-text">About Streamplace VOD Client</h1>
        <p className="mt-2 text-sm font-medium text-muted">Open source AT Protocol video browser</p>
        <p className="mt-4 max-w-[70ch] text-sm leading-relaxed text-muted">
          Streamplace VOD Client discovers repos that publish <code>place.stream.video</code> records via
          Bluesky relay sync APIs, then loads records directly from each repo PDS. Playback uses the
          Streamplace VOD beta endpoint.
        </p>
        <p className="mt-4 max-w-[70ch] text-sm leading-relaxed text-muted">
          Search supports all discovered VODs. AtmosphereConf 2026 records include richer OpenRouter
          tag/topic metadata, so Atmosphere queries are usually more precise than general VOD queries.
        </p>
        <p className="mt-4 max-w-[70ch] text-sm leading-relaxed text-muted">
          Live deployment:{' '}
          <a href="https://vods.j4ck.xyz" className="underline-offset-4 hover:text-text hover:underline">
            vods.j4ck.xyz
          </a>
        </p>
      </section>

      <section className="rounded-lg border border-line/45 bg-surface/80 p-5 md:p-6">
        <h2 className="text-base font-semibold text-text">Keyboard shortcuts</h2>
        <ul className="mt-3 space-y-2 text-sm text-muted">
          <li>Browse/Search: <code>J</code> next, <code>K</code> previous, <code>/</code> focus search, <code>Enter</code> open selected card.</li>
          <li>Video: <code>Space</code> or <code>K</code> play/pause, <code>J</code>/<code>L</code> seek +/- 10 seconds.</li>
          <li>Video: <code>F</code> fullscreen, <code>M</code> mute, <code>0-9</code> jump to 0-90%.</li>
          <li>Video: <code>&lt;</code>/<code>&gt;</code> change speed by 0.25x, <code>Esc</code> return to Browse.</li>
        </ul>
      </section>

      <section className="rounded-lg border border-line/45 bg-surface/80 p-5 md:p-6">
        <h2 className="text-base font-semibold text-text">Theme</h2>
        <p className="mt-2 text-sm text-muted">Preference is saved in this browser.</p>
        <fieldset className="mt-3" aria-label="Theme preference">
          <legend className="sr-only">Theme preference</legend>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => onThemeChange('system')}
              aria-pressed={themePreference === 'system'}
              className="inline-flex min-h-11 items-center rounded-md border border-line/45 bg-surface/80 px-3 text-xs text-muted transition hover:border-line/60 hover:text-text aria-pressed:border-accent/60 aria-pressed:text-text"
            >
              System
            </button>
            <button
              type="button"
              onClick={() => onThemeChange('light')}
              aria-pressed={themePreference === 'light'}
              className="inline-flex min-h-11 items-center rounded-md border border-line/45 bg-surface/80 px-3 text-xs text-muted transition hover:border-line/60 hover:text-text aria-pressed:border-accent/60 aria-pressed:text-text"
            >
              Light
            </button>
            <button
              type="button"
              onClick={() => onThemeChange('dark')}
              aria-pressed={themePreference === 'dark'}
              className="inline-flex min-h-11 items-center rounded-md border border-line/45 bg-surface/80 px-3 text-xs text-muted transition hover:border-line/60 hover:text-text aria-pressed:border-accent/60 aria-pressed:text-text"
            >
              Dark
            </button>
          </div>
        </fieldset>
      </section>

      {showHapticsToggle ? (
        <section className="rounded-lg border border-line/45 bg-surface/80 p-5 md:p-6">
          <h2 className="text-base font-semibold text-text">Haptic feedback</h2>
          <p className="mt-2 text-sm text-muted">Subtle vibrations on interactions (Android only).</p>
          <div className="mt-3 flex items-center gap-3">
            <button
              type="button"
              role="switch"
              aria-checked={!hapticsDisabled}
              onClick={onHapticsToggle}
              className="inline-flex h-11 w-[3.25rem] items-center rounded-full border border-line/45 bg-surface/80 px-1 transition"
            >
              <span
                className={`h-5 w-5 rounded-full bg-text transition-transform ${hapticsDisabled ? 'translate-x-0' : 'translate-x-5'}`}
              />
            </button>
            <span className="text-sm text-muted">{!hapticsDisabled ? 'Enabled' : 'Disabled'}</span>
          </div>
        </section>
      ) : null}
    </div>
  )
}
