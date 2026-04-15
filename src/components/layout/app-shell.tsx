import { Film, Info, Search, Sparkles } from 'lucide-react'
import { NavLink, type NavLinkProps } from 'react-router-dom'
import { type PropsWithChildren, useEffect, useRef, useState } from 'react'

import { hapticTap } from '@/lib/haptics'
import { cn } from '@/lib/utils'

const navItems = [
  {
    label: 'Browse',
    icon: Film,
    to: '/',
    end: true,
  },
  {
    label: 'Atmosphere',
    icon: Sparkles,
    to: '/atmosphereconf-2026',
  },
  {
    label: 'Search',
    icon: Search,
    to: '/search',
  },
  {
    label: 'About',
    icon: Info,
    to: '/about',
  },
]

function NavItem({
  label,
  icon: Icon,
  compact = false,
  ...props
}: NavLinkProps & { label: string; icon: typeof Film; compact?: boolean }) {
  return (
    <NavLink
      {...props}
      onClick={(event) => {
        props.onClick?.(event)
        if (event.defaultPrevented) {
          return
        }
        hapticTap()
      }}
      className={({ isActive }) =>
        cn(
          'flex min-h-11 items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-[background-color,color,border-color] md:justify-start md:px-3.5',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-text/35 md:text-sm',
          compact && 'px-2.5 sm:px-3',
          isActive
            ? 'border border-accent/45 bg-surface/80 text-accent'
            : 'border border-transparent text-muted hover:border-line/45 hover:bg-surface/70 hover:text-text',
        )
      }
    >
      <Icon className="h-4 w-4" />
      <span className={cn(compact && 'hidden min-[360px]:inline')}>{label}</span>
    </NavLink>
  )
}

export function AppShell({ children }: PropsWithChildren) {
  const [isHeaderHidden, setIsHeaderHidden] = useState(false)
  const lastScrollYRef = useRef(0)

  useEffect(() => {
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (prefersReducedMotion) {
      return
    }

    let ticking = false

    const onScroll = () => {
      if (ticking) {
        return
      }

      ticking = true
      window.requestAnimationFrame(() => {
        const currentY = window.scrollY
        const delta = currentY - lastScrollYRef.current

        if (currentY <= 8) {
          setIsHeaderHidden(false)
        } else if (delta > 10 && currentY > 72) {
          setIsHeaderHidden(true)
        } else if (delta < -10) {
          setIsHeaderHidden(false)
        }

        lastScrollYRef.current = currentY
        ticking = false
      })
    }

    window.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      window.removeEventListener('scroll', onScroll)
    }
  }, [])

  return (
    <div className="relative isolate min-h-svh bg-bg">
      <header
        className={cn(
          'sticky top-0 z-40 border-b border-line/45 bg-surface/80 transition-transform duration-300 ease-out supports-[backdrop-filter]:backdrop-blur-md',
          isHeaderHidden ? '-translate-y-full' : 'translate-y-0',
        )}
        onFocusCapture={() => setIsHeaderHidden(false)}
      >
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-3 px-3 py-2.5 sm:px-4 md:px-6 md:py-3">
          <p className="text-base font-bold tracking-[0.01em] text-text md:text-lg">Streamplace VOD Client</p>

          <a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-2 focus:rounded-md focus:bg-surface focus:px-3 focus:py-2 focus:text-sm focus:text-text">
            Skip to content
          </a>

          <nav className="hidden items-center gap-1.5 md:flex lg:gap-2" aria-label="Primary">
            {navItems.map((item) => (
              <NavItem key={item.to} label={item.label} to={item.to} end={item.end} icon={item.icon} />
            ))}
          </nav>
        </div>
      </header>

      <main
        id="main-content"
        className="relative z-0 mx-auto w-full max-w-5xl px-3 pb-24 pt-7 sm:px-4 md:px-6 md:pb-10 md:pt-10"
      >
        {children}
      </main>

      <footer className="relative z-10 border-t border-line/45 bg-surface/80 supports-[backdrop-filter]:backdrop-blur-md">
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-2 px-3 py-4 text-xs text-muted sm:px-4 md:flex-row md:items-center md:justify-between md:px-6">
          <p>Open source · MIT licence</p>
          <p className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
            <a
              href="https://tangled.sh/@j4ck.xyz/atmosphere-vods"
              target="_blank"
              rel="noreferrer"
              className="inline-flex min-h-11 items-center underline-offset-4 hover:text-text hover:underline"
            >
              Tangled
            </a>
            <a
              href="https://github.com/j4ckxyz/atmosphere-vods"
              target="_blank"
              rel="noreferrer"
              className="inline-flex min-h-11 items-center underline-offset-4 hover:text-text hover:underline"
            >
              GitHub
            </a>
            <a
              href="https://vod.j4ck.xyz"
              target="_blank"
              rel="noreferrer"
              className="inline-flex min-h-11 items-center underline-offset-4 hover:text-text hover:underline"
            >
              iStream →
            </a>
          </p>
          <p>
            Built for Streamplace VOD beta ·{' '}
            <a
              href="https://vods.j4ck.xyz"
              target="_blank"
              rel="noreferrer"
              className="underline-offset-4 hover:text-text hover:underline"
            >
              vods.j4ck.xyz
            </a>
          </p>
        </div>
      </footer>

      <nav
        className="fixed inset-x-2 bottom-[max(0.5rem,env(safe-area-inset-bottom))] z-50 flex min-h-16 items-center gap-1.5 rounded-xl border border-line/45 bg-surface/80 px-1.5 py-1.5 supports-[backdrop-filter]:backdrop-blur-md sm:inset-x-3 sm:gap-2 sm:px-2 sm:py-2 md:hidden"
        aria-label="Bottom tabs"
      >
        {navItems.map((item) => (
          <NavItem key={item.to} label={item.label} to={item.to} end={item.end} icon={item.icon} compact />
        ))}
      </nav>
    </div>
  )
}
