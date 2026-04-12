import { Film, Info, Search } from 'lucide-react'
import { NavLink, type NavLinkProps } from 'react-router-dom'
import { type PropsWithChildren } from 'react'

import { cn } from '@/lib/utils'

const navItems = [
  {
    label: 'Browse',
    icon: Film,
    to: '/',
    end: true,
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

function NavItem({ label, icon: Icon, ...props }: NavLinkProps & { label: string; icon: typeof Film }) {
  return (
    <NavLink
      {...props}
      className={({ isActive }) =>
        cn(
          'group min-h-11 rounded-xl border border-transparent px-3 py-2 text-xs text-muted transition-all duration-200 hover:text-text',
          'flex flex-1 items-center justify-center gap-2 md:w-full md:justify-start md:px-4 md:text-sm',
          isActive && 'glass-panel text-text shadow-glass',
        )
      }
    >
      <Icon className="h-4 w-4" />
      <span>{label}</span>
    </NavLink>
  )
}

export function AppShell({ children }: PropsWithChildren) {
  return (
    <div className="relative min-h-svh overflow-x-hidden">
      <div className="aurora animate-aurora" aria-hidden="true" />
      <div className="noise-overlay animate-noise" aria-hidden="true" />

      <div className="relative z-10 mx-auto flex min-h-svh w-full max-w-7xl pb-24 md:pb-0">
        <aside className="hidden w-64 shrink-0 p-4 md:block lg:p-6">
          <div className="glass-panel sticky top-6 rounded-2xl p-4">
            <h1 className="text-lg font-semibold text-text">Atmosphere VODs</h1>
            <p className="mt-2 max-w-[22ch] text-sm leading-relaxed text-muted">
              Browse every ATmosphereConf 2026 talk in a fast glassy PWA.
            </p>

            <nav className="mt-6 flex flex-col gap-2">
              {navItems.map((item) => (
                <NavItem key={item.to} label={item.label} to={item.to} end={item.end} icon={item.icon} />
              ))}
            </nav>
          </div>
        </aside>

        <main className="w-full p-4 md:p-6 lg:p-8">{children}</main>
      </div>

      <nav className="glass-panel fixed inset-x-3 bottom-3 z-20 flex min-h-16 items-center gap-2 rounded-2xl px-2 py-2 md:hidden">
        {navItems.map((item) => (
          <NavItem key={item.to} label={item.label} to={item.to} end={item.end} icon={item.icon} />
        ))}
      </nav>
    </div>
  )
}
