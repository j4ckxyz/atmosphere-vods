import {
  ATMOSPHERE_REPO_DID,
  BSKY_PUBLIC_API,
  BSKY_RELAY_SYNC_APIS,
  FALLBACK_REPO_DIDS,
  PLC_DIRECTORY_URL,
  STREAMPLACE_VIDEO_COLLECTION,
  VOD_PLAYLIST_ENDPOINT,
} from './constants'
import { truncateDid } from './format'
import taxonomyData from './video-taxonomy.json'
import type {
  ActorProfile,
  AppTalk,
  GetRecordResponse,
  ListRecordsResponse,
  ListReposByCollectionResponse,
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
const pdsUrlCache = new Map<string, Promise<string>>()
const REQUEST_TIMEOUT_MS = 8_000
const PROFILE_CONCURRENCY = 6
const REPO_FETCH_CONCURRENCY = 4
const DISCOVERY_LIMIT = 1_000
const RECORDS_PAGE_LIMIT = 100
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

async function fetchReposByCollection(collection: string): Promise<string[]> {
  const errors: Error[] = []

  for (const relayBase of BSKY_RELAY_SYNC_APIS) {
    const dids = new Set<string>()
    let cursor: string | undefined

    try {
      do {
        const query = new URLSearchParams({
          collection,
          limit: String(DISCOVERY_LIMIT),
        })

        if (cursor) {
          query.set('cursor', cursor)
        }

        const data = await fetchJson<ListReposByCollectionResponse>(
          `${relayBase}/xrpc/com.atproto.sync.listReposByCollection?${query.toString()}`,
        )

        for (const entry of data.repos ?? []) {
          if (entry.did) {
            dids.add(entry.did)
          }
        }

        cursor = data.cursor
      } while (cursor)

      if (dids.size > 0) {
        return [...dids].sort((a, b) => a.localeCompare(b))
      }
    } catch (error) {
      if (error instanceof Error) {
        errors.push(error)
      }
    }
  }

  if (errors.length > 0) {
    return [...new Set(FALLBACK_REPO_DIDS)].sort((a, b) => a.localeCompare(b))
  }

  return [...new Set(FALLBACK_REPO_DIDS)].sort((a, b) => a.localeCompare(b))
}

export function resolvePdsUrl(did: string): Promise<string> {
  const cached = pdsUrlCache.get(did)
  if (cached) {
    return cached
  }

  const pending = (async () => {
    try {
      const didDoc = await fetchJson<PlcDidDocument>(`${PLC_DIRECTORY_URL}/${did}`)
      const pdsService = didDoc.service?.find((entry) => entry.id === '#atproto_pds')

      if (!pdsService?.serviceEndpoint) {
        throw new Error('PDS endpoint missing from DID document')
      }

      return pdsService.serviceEndpoint.replace(/\/$/, '')
    } catch (error) {
      pdsUrlCache.delete(did)
      throw error
    }
  })()

  pdsUrlCache.set(did, pending)
  return pending
}

async function fetchRepoCollectionRecords(
  repoDid: string,
  collection: string,
): Promise<ListRecordsResponse['records']> {
  const pdsUrl = await resolvePdsUrl(repoDid)
  const records: ListRecordsResponse['records'] = []
  let cursor: string | undefined

  do {
    const query = new URLSearchParams({
      repo: repoDid,
      collection,
      limit: String(RECORDS_PAGE_LIMIT),
    })

    if (cursor) {
      query.set('cursor', cursor)
    }

    const data = await fetchJson<ListRecordsResponse>(
      `${pdsUrl}/xrpc/com.atproto.repo.listRecords?${query.toString()}`,
    )

    records.push(...(data.records ?? []))
    cursor = data.cursor
  } while (cursor)

  return records
}

async function fetchProfile(did: string): Promise<ActorProfile | null> {
  if (!did) {
    return null
  }

  const query = new URLSearchParams({ actor: did })

  try {
    return await fetchJson<ActorProfile>(
      `${BSKY_PUBLIC_API}/xrpc/app.bsky.actor.getProfile?${query.toString()}`,
    )
  } catch {
    return null
  }
}

function getCreatorDid(record: { value: { creator?: string }; sourceRepoDid: string }): string {
  return record.value.creator?.trim() || record.sourceRepoDid
}

function byCreatedAtDesc(
  left: { value: { createdAt?: string } },
  right: { value: { createdAt?: string } },
): number {
  const leftTs = Date.parse(left.value.createdAt ?? '')
  const rightTs = Date.parse(right.value.createdAt ?? '')
  const safeLeft = Number.isFinite(leftTs) ? leftTs : 0
  const safeRight = Number.isFinite(rightTs) ? rightTs : 0
  return safeRight - safeLeft
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
  const discoveredRepoDids = await fetchReposByCollection(STREAMPLACE_VIDEO_COLLECTION)
  if (discoveredRepoDids.length === 0) {
    return []
  }

  let successfulRepoCount = 0
  const repoRecords = await mapWithConcurrency(
    discoveredRepoDids,
    REPO_FETCH_CONCURRENCY,
    async (repoDid) => {
      try {
        const records = await fetchRepoCollectionRecords(repoDid, STREAMPLACE_VIDEO_COLLECTION)
        successfulRepoCount += 1
        return records.map((record) => ({
          ...record,
          sourceRepoDid: repoDid,
        }))
      } catch {
        return []
      }
    },
  )

  if (successfulRepoCount === 0) {
    throw new Error('Unable to load video records from discovered repos')
  }

  const merged = repoRecords.flat()
  const sorted = [...merged].sort(byCreatedAtDesc)

  const uniqueCreators = Array.from(new Set(sorted.map((record) => getCreatorDid(record))))
  const profiles = await mapWithConcurrency(
    uniqueCreators,
    PROFILE_CONCURRENCY,
    (did) => getCachedProfile(did),
  )
  const profileMap = new Map(uniqueCreators.map((did, index) => [did, profiles[index]]))

  return sorted.map((record) => {
    const taxonomy = taxonomyByUri.get(record.uri)
    const creatorDid = getCreatorDid(record)
    const profile = profileMap.get(creatorDid)
    const creatorName = profile?.displayName?.trim() || profile?.handle || truncateDid(creatorDid)

    return {
      uri: record.uri,
      cid: record.cid,
      sourceRepoDid: record.sourceRepoDid,
      title: record.value.title,
      description: record.value.description,
      creatorDid,
      creatorName,
      creatorHandle: profile?.handle,
      durationNs: record.value.duration,
      createdAt: record.value.createdAt ?? new Date(0).toISOString(),
      sourceRef: record.value.source?.ref,
      sourceMimeType: record.value.source?.mimeType,
      taxonomyGroup: taxonomy?.group,
      taxonomyTags: taxonomy?.tags ?? [],
      taxonomyTopics: taxonomy?.topics ?? [],
      taxonomyKeywords: taxonomy?.keywords ?? [],
    }
  })
}

export function isAtmosphereTalk(talk: AppTalk): boolean {
  return talk.sourceRepoDid === ATMOSPHERE_REPO_DID
}

function parseVideoUri(uri: string): { did: string; rkey: string } | null {
  const match = uri.match(/^at:\/\/(did:[^/]+)\/place\.stream\.video\/([^/]+)$/)
  if (!match) {
    return null
  }

  return {
    did: match[1],
    rkey: match[2],
  }
}

async function toAppTalkFromRecord(record: GetRecordResponse): Promise<AppTalk> {
  const uriInfo = parseVideoUri(record.uri)
  if (!uriInfo) {
    throw new Error('Invalid video URI')
  }

  const taxonomy = taxonomyByUri.get(record.uri)
  const creatorDid = record.value.creator?.trim() || uriInfo.did
  const profile = await getCachedProfile(creatorDid)
  const creatorName = profile?.displayName?.trim() || profile?.handle || truncateDid(creatorDid)

  return {
    uri: record.uri,
    cid: record.cid,
    sourceRepoDid: uriInfo.did,
    title: record.value.title,
    description: record.value.description,
    creatorDid,
    creatorName,
    creatorHandle: profile?.handle,
    durationNs: record.value.duration,
    createdAt: record.value.createdAt ?? new Date(0).toISOString(),
    sourceRef: record.value.source?.ref,
    sourceMimeType: record.value.source?.mimeType,
    taxonomyGroup: taxonomy?.group,
    taxonomyTags: taxonomy?.tags ?? [],
    taxonomyTopics: taxonomy?.topics ?? [],
    taxonomyKeywords: taxonomy?.keywords ?? [],
  }
}

export async function fetchTalkByUri(uri: string): Promise<AppTalk> {
  const uriInfo = parseVideoUri(uri)
  if (!uriInfo) {
    throw new Error('Invalid video URI')
  }

  const pdsUrl = await resolvePdsUrl(uriInfo.did)
  const query = new URLSearchParams({
    repo: uriInfo.did,
    collection: STREAMPLACE_VIDEO_COLLECTION,
    rkey: uriInfo.rkey,
    uri,
  })
  const record = await fetchJson<GetRecordResponse>(
    `${pdsUrl}/xrpc/com.atproto.repo.getRecord?${query.toString()}`,
  )

  return toAppTalkFromRecord(record)
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

export function getArchiveBlobUrl(sourceRepoDid: string, sourceRef: string): string {
  return `https://vod-beta.stream.place/xrpc/com.atproto.sync.getBlob?did=${encodeURIComponent(sourceRepoDid)}&cid=${encodeURIComponent(sourceRef)}`
}
