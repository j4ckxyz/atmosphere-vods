import {
  createContext,
  type PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react'

import { fetchTalks } from '@/lib/api'
import type { AppTalk } from '@/lib/types'

interface VideosContextValue {
  talks: AppTalk[]
  loading: boolean
  error: string | null
  refresh: () => void
}

const VideosContext = createContext<VideosContextValue | undefined>(undefined)

export function VideosProvider({ children }: PropsWithChildren) {
  const [talks, setTalks] = useState<AppTalk[]>([])
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshIndex, setRefreshIndex] = useState<number>(0)

  useEffect(() => {
    let active = true

    async function load() {
      setLoading(true)
      setError(null)

      try {
        const nextTalks = await fetchTalks()
        if (!active) {
          return
        }
        setTalks(nextTalks)
        setError(null)
      } catch (fetchError) {
        if (!active) {
          return
        }
        const message = fetchError instanceof Error ? fetchError.message : 'Failed to fetch talks'
        setError(message)
      } finally {
        if (active) {
          setLoading(false)
        }
      }
    }

    load()

    return () => {
      active = false
    }
  }, [refreshIndex])

  const refresh = useCallback(() => {
    setRefreshIndex((value) => value + 1)
  }, [])

  const value = useMemo(
    () => ({
      talks,
      loading,
      error,
      refresh,
    }),
    [talks, loading, error, refresh],
  )

  return <VideosContext.Provider value={value}>{children}</VideosContext.Provider>
}

export function useVideos() {
  const context = useContext(VideosContext)
  if (!context) {
    throw new Error('useVideos must be used inside VideosProvider')
  }
  return context
}
