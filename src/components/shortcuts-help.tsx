import { HelpCircle, X } from 'lucide-react'
import { useState } from 'react'

export interface ShortcutItem {
  key: string
  description: string
}

interface ShortcutsHelpProps {
  title: string
  items: ShortcutItem[]
}

export function ShortcutsHelp({ title, items }: ShortcutsHelpProps) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex min-h-11 items-center gap-2 rounded-md border border-line/45 bg-surface/70 px-3 text-xs text-muted transition hover:border-line/60 hover:text-text"
        aria-label="Show keyboard shortcuts"
      >
        <HelpCircle className="h-4 w-4" />
        ?
      </button>

      {open ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-bg/75 p-4" role="dialog" aria-modal="true">
          <section className="w-full max-w-md rounded-xl border border-line/50 bg-surface/95 p-4 shadow-2xl supports-[backdrop-filter]:backdrop-blur-md">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-text">{title}</h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="inline-flex min-h-11 items-center rounded-md border border-line/45 px-3 text-xs text-muted transition hover:text-text"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <ul className="mt-3 space-y-2">
              {items.map((item) => (
                <li key={`${item.key}-${item.description}`} className="flex items-start justify-between gap-4 text-xs">
                  <kbd className="rounded border border-line/50 bg-bg/70 px-2 py-1 text-text">{item.key}</kbd>
                  <span className="text-muted">{item.description}</span>
                </li>
              ))}
            </ul>
          </section>
        </div>
      ) : null}
    </>
  )
}
