import { cn } from '@/lib/utils'

export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'rounded-lg bg-surface/45 before:absolute before:inset-0 before:animate-pulse before:rounded-lg before:bg-text/6',
        'relative overflow-hidden',
        className,
      )}
      aria-hidden="true"
    />
  )
}
