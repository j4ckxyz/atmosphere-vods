import { Skeleton } from '@/components/ui/skeleton'

export function TalkGridSkeleton() {
  return (
    <div className="grid grid-cols-[repeat(auto-fit,minmax(240px,1fr))] gap-3 md:grid-cols-[repeat(auto-fit,minmax(280px,1fr))] md:gap-4">
      {Array.from({ length: 12 }).map((_, index) => (
        <article
          key={index}
          className={
            index === 0
              ? 'perf-content-auto rounded-xl border border-line/45 bg-surface/80 p-5 md:p-6'
              : 'perf-content-auto rounded-xl border border-line/45 bg-surface/80 p-4'
          }
        >
          <Skeleton className="h-5 w-11/12" />
          <Skeleton className="mt-2 h-5 w-3/4" />
          <div className="mt-7 space-y-2">
            <Skeleton className="h-3.5 w-4/5" />
            <Skeleton className="h-3.5 w-2/5" />
            <Skeleton className="h-3.5 w-3/5" />
          </div>
        </article>
      ))}
    </div>
  )
}
