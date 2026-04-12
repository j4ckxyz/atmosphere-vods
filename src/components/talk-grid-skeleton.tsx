import { Skeleton } from '@/components/ui/skeleton'

export function TalkGridSkeleton() {
  return (
    <div className="grid grid-cols-[repeat(auto-fit,minmax(260px,1fr))] gap-4 md:gap-5">
      {Array.from({ length: 12 }).map((_, index) => (
        <article key={index} className="glass-panel rounded-2xl p-4">
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
