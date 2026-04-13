import { AlertTriangle, RefreshCcw } from 'lucide-react'

import { Button } from '@/components/ui/button'

interface ErrorPanelProps {
  title: string
  message: string
  onRetry?: () => void
}

export function ErrorPanel({ title, message, onRetry }: ErrorPanelProps) {
  return (
    <section className="rounded-lg border border-line/45 bg-surface/80 p-5">
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-muted" />
        <div>
          <h2 className="text-base font-semibold text-text">{title}</h2>
          <p className="mt-2 max-w-[65ch] text-sm leading-relaxed text-text/85">{message}</p>
        </div>
      </div>

      {onRetry ? (
        <Button variant="secondary" className="mt-5" onClick={onRetry}>
          <RefreshCcw className="h-4 w-4" />
          Try again
        </Button>
      ) : null}
    </section>
  )
}
