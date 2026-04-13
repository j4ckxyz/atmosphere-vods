import {
  BSKY_PUBLIC_API,
  PLC_DIRECTORY_URL,
  REPO_DID,
  VOD_PLAYLIST_ENDPOINT,
} from './constants'
import { truncateDid } from './format'
import taxonomyData from './video-taxonomy.json'
import type {
  ActorProfile,
  AppTalk,
  ListRecordsResponse,
  PlcDidDocument,
} from './types'

interface TaxonomyEntry {
  uri: string
  group?: string
  tags?: string[]
  topics?: string[]
  keywords?: string[]
}

const profileCache = new Map<string, Promise<ActorProfile | null>>()
let pdsUrlPromise: Promise<string> | null = null
const REQUEST_TIMEOUT_MS = 8_000
const PROFILE_CONCURRENCY = 6
const taxonomyByUri = new Map(
  (taxonomyData.entries as TaxonomyEntry[]).map((entry) => [entry.uri, entry]),
)

async function fetchWithTimeout(
  url: string,
  init?: RequestInit,
  timeoutMs: number = REQUEST_TIMEOUT_MS,
): Promise<Response> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)

  try {
    return await fetch(url, { ...init, signal: controller.signal })
  } finally {
    clearTimeout(timeout)
  }
}

async function fetchJson<T>(url: string): Promise<T> {
  let response: Response

  try {
    response = await fetchWithTimeout(url)
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new Error('Request timed out')
    }

    throw error
  }

  if (!response.ok) {
    throw new Error(`Request failed (${response.status})`)
  }

  return (await response.json()) as T
}

async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  mapper: (item: T) => Promise<R>,
): Promise<R[]> {
  if (items.length === 0) {
    return []
  }

  const results = new Array<R>(items.length)
  let nextIndex = 0

  async function worker() {
    while (nextIndex < items.length) {
      const index = nextIndex
      nextIndex += 1
      results[index] = await mapper(items[index])
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, () => worker()),
  )
  return results
}

export function resolvePdsUrl(): Promise<string> {
  if (pdsUrlPromise) {
    return pdsUrlPromise
  }

  pdsUrlPromise = (async () => {
    try {
      const didDoc = await fetchJson<PlcDidDocument>(`${PLC_DIRECTORY_URL}/${REPO_DID}`)
      const pdsService = didDoc.service?.find((entry) => entry.id === '#atproto_pds')

      if (!pdsService?.serviceEndpoint) {
        throw new Error('PDS endpoint missing from DID document')
      }

      return pdsService.serviceEndpoint.replace(/\/$/, '')
    } catch (error) {
      pdsUrlPromise = null
      throw error
    }
  })()

  return pdsUrlPromise
}

async function fetchProfile(did: string): Promise<ActorProfile | null> {
  const query = new URLSearchParams({ actor: did })

  try {
    return await fetchJson<ActorProfile>(
      `${BSKY_PUBLIC_API}/xrpc/app.bsky.actor.getProfile?${query.toString()}`,
    )
  } catch {
    return null
  }
}

function getCachedProfile(did: string): Promise<ActorProfile | null> {
  const cached = profileCache.get(did)
  if (cached) {
    return cached
  }

  const pending = fetchProfile(did)
  profileCache.set(did, pending)
  return pending
}

export async function fetchTalks(): Promise<AppTalk[]> {
  const pdsUrl = await resolvePdsUrl()
  const query = new URLSearchParams({
    repo: REPO_DID,
    collection: 'place.stream.video',
    limit: '100',
  })

  const data = await fetchJson<ListRecordsResponse>(
    `${pdsUrl}/xrpc/com.atproto.repo.listRecords?${query.toString()}`,
  )

  const sorted = [...data.records].sort(
    (a, b) => new Date(b.value.createdAt).getTime() - new Date(a.value.createdAt).getTime(),
  )

  const uniqueCreators = Array.from(new Set(sorted.map((record) => record.value.creator)))
  const profiles = await mapWithConcurrency(
    uniqueCreators,
    PROFILE_CONCURRENCY,
    (did) => getCachedProfile(did),
  )
  const profileMap = new Map(uniqueCreators.map((did, index) => [did, profiles[index]]))

  return sorted.map((record) => {
    const taxonomy = taxonomyByUri.get(record.uri)
    const profile = profileMap.get(record.value.creator)
    const creatorName = profile?.displayName?.trim() || profile?.handle || truncateDid(record.value.creator)

    return {
      uri: record.uri,
      cid: record.cid,
      title: record.value.title,
      description: record.value.description,
      creatorDid: record.value.creator,
      creatorName,
      creatorHandle: profile?.handle,
      durationNs: record.value.duration,
      createdAt: record.value.createdAt,
      sourceRef: record.value.source?.ref,
      sourceMimeType: record.value.source?.mimeType,
      taxonomyGroup: taxonomy?.group,
      taxonomyTags: taxonomy?.tags ?? [],
      taxonomyTopics: taxonomy?.topics ?? [],
      taxonomyKeywords: taxonomy?.keywords ?? [],
    }
  })
}

export async function fetchVideoPlaylist(uri: string): Promise<string> {
  const query = new URLSearchParams({ uri })
  const playlistUrl = `${VOD_PLAYLIST_ENDPOINT}?${query.toString()}`
  let response: Response

  try {
    response = await fetchWithTimeout(playlistUrl, undefined, 10_000)
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new Error('Playlist request timed out')
    }

    throw error
  }

  if (!response.ok) {
    throw new Error(`Unable to load playlist (${response.status})`)
  }

  const text = await response.text()

  if (!text.includes('#EXTM3U')) {
    throw new Error('Playback endpoint did not return an HLS playlist')
  }

  return playlistUrl
}

export function getArchiveBlobUrl(sourceRef: string): string {
  return `https://vod-beta.stream.place/xrpc/com.atproto.sync.getBlob?did=${encodeURIComponent(REPO_DID)}&cid=${encodeURIComponent(sourceRef)}`
}
