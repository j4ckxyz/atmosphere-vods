import { CalendarDays, Clock3, UserRound } from 'lucide-react'
import { Link } from 'react-router-dom'

import { cardTapHaptic } from '@/lib/haptics'
import { formatDate, formatDuration, truncateDid } from '@/lib/format'
import { toVideoPath } from '@/lib/routes'
import type { AppTalk } from '@/lib/types'

interface TalkCardProps {
  talk: AppTalk
  index: number
}

export function TalkCard({ talk, index }: TalkCardProps) {
  return (
    <Link
      to={toVideoPath(talk.uri)}
      onClick={cardTapHaptic}
      className="glass-panel group animate-rise rounded-2xl p-4 transition-all duration-300 hover:-translate-y-1 hover:shadow-lift"
      style={{ animationDelay: `${Math.min(index * 35, 350)}ms` }}
    >
      <div className="flex min-h-28 flex-col gap-4">
        <h3 className="line-clamp-2 text-base font-semibold leading-tight text-text">{talk.title}</h3>

        <dl className="mt-auto space-y-2 text-xs text-muted">
          <div className="flex items-center gap-2">
            <UserRound className="h-3.5 w-3.5" />
            <dt className="sr-only">Speaker</dt>
            <dd className="truncate">{talk.creatorName || truncateDid(talk.creatorDid)}</dd>
          </div>
          <div className="flex items-center gap-2">
            <Clock3 className="h-3.5 w-3.5" />
            <dt className="sr-only">Duration</dt>
            <dd>{formatDuration(talk.durationNs)}</dd>
          </div>
          <div className="flex items-center gap-2">
            <CalendarDays className="h-3.5 w-3.5" />
            <dt className="sr-only">Date</dt>
            <dd>{formatDate(talk.createdAt)}</dd>
          </div>
        </dl>
      </div>
    </Link>
  )
}
