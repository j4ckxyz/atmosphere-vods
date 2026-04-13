import { CalendarDays, Clock3, UserRound } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'

import { cardTapHaptic } from '@/lib/haptics'
import { formatDate, formatDuration, truncateDid } from '@/lib/format'
import { toVideoPath } from '@/lib/routes'
import { getCachedThumbnail, getOrCreateThumbnail } from '@/lib/thumbnails'
import type { AppTalk } from '@/lib/types'
import { cn } from '@/lib/utils'

interface TalkCardProps {
  talk: AppTalk
  featured?: boolean
}

export function TalkCard({ talk, featured = false }: TalkCardProps) {
  const cardRef = useRef<HTMLAnchorElement | null>(null)
  const [thumbnail, setThumbnail] = useState<string | null>(() => getCachedThumbnail(talk.uri))
  const [hasEnteredView, setHasEnteredView] = useState<boolean>(false)
  const featuredThumbnail = featured ? thumbnail : null

  useEffect(() => {
    if (!featured || thumbnail || hasEnteredView || !cardRef.current) {
      return
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries
        if (!entry?.isIntersecting) {
          return
        }

        setHasEnteredView(true)
        observer.disconnect()
      },
      {
        rootMargin: '240px 0px',
        threshold: 0.12,
      },
    )

    observer.observe(cardRef.current)

    return () => {
      observer.disconnect()
    }
  }, [featured, thumbnail, hasEnteredView])

  useEffect(() => {
    if (!featured || !hasEnteredView || thumbnail) {
      return
    }

    let active = true

    getOrCreateThumbnail(talk.uri).then((result) => {
      if (!active || !result) {
        return
      }
      setThumbnail(result)
    })

    return () => {
      active = false
    }
  }, [featured, hasEnteredView, thumbnail, talk.uri])

  return (
    <Link
      ref={cardRef}
      to={toVideoPath(talk.uri)}
      onClick={cardTapHaptic}
      className={cn(
        'group relative block w-full overflow-hidden rounded-xl border transition-[background-color,border-color,box-shadow] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-text/35',
        featured
          ? 'border-line/45 bg-surface/80 hover:border-line/60 supports-[backdrop-filter]:backdrop-blur-md'
          : 'border-line/35 bg-surface/80 hover:border-line/50',
        !featured && 'perf-content-auto',
        featured ? 'p-5 md:p-6' : 'p-4',
      )}
    >
      {featuredThumbnail ? (
        <div className="pointer-events-none absolute -inset-px">
          <img
            src={featuredThumbnail}
            alt=""
            aria-hidden="true"
            loading="lazy"
            decoding="async"
            className="block h-full w-full object-cover"
          />
          <div
            className="absolute inset-0"
            style={{
              backgroundImage:
                'linear-gradient(165deg, oklch(0 0 0 / 0.84), oklch(0.12 0 0 / 0.66))',
            }}
          />
        </div>
      ) : null}

      <div className="relative z-10">
        <h3
          className={cn(
            'line-clamp-2 font-semibold leading-tight text-text',
            featured ? 'text-lg md:text-xl' : 'text-base',
          )}
        >
          {talk.title}
        </h3>

        <div className={cn('text-sm text-muted', featured ? 'mt-5 space-y-2' : 'mt-4 space-y-1')}>
          <p className="flex items-center gap-2 leading-relaxed">
            <UserRound className="h-3.5 w-3.5 text-muted" />
            <span className="truncate">{talk.creatorName || truncateDid(talk.creatorDid)}</span>
          </p>
          <p className={cn('flex items-center gap-2 leading-relaxed', featured && 'flex-wrap')}>
            <Clock3 className="h-3.5 w-3.5 text-muted" />
            <span>{formatDuration(talk.durationNs)}</span>
            <span aria-hidden="true">•</span>
            <CalendarDays className="h-3.5 w-3.5 text-muted" />
            <span>{formatDate(talk.createdAt)}</span>
          </p>
        </div>
      </div>
    </Link>
  )
}
