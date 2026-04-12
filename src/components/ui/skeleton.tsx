import { cn } from '@/lib/utils'

export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'rounded-xl bg-surface/80 before:absolute before:inset-0 before:animate-pulse before:rounded-xl before:bg-white/5',
        'relative overflow-hidden',
        className,
      )}
      aria-hidden="true"
    />
  )
}
