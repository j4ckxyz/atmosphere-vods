import { AlertTriangle, RefreshCcw } from 'lucide-react'

import { Button } from '@/components/ui/button'

interface ErrorPanelProps {
  title: string
  message: string
  onRetry?: () => void
}

export function ErrorPanel({ title, message, onRetry }: ErrorPanelProps) {
  return (
    <section className="glass-panel rounded-2xl p-6">
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-accent" />
        <div>
          <h2 className="text-base font-semibold text-text">{title}</h2>
          <p className="mt-2 max-w-[65ch] text-sm leading-relaxed text-muted">{message}</p>
        </div>
      </div>

      {onRetry ? (
        <Button variant="secondary" className="mt-5" onClick={onRetry}>
          <RefreshCcw className="h-4 w-4" />
          Retry
        </Button>
      ) : null}
    </section>
  )
}
