import {
  BSKY_PUBLIC_API,
  PLC_DIRECTORY_URL,
  REPO_DID,
  VOD_PLAYLIST_ENDPOINT,
} from './constants'
import { truncateDid } from './format'
import type {
  ActorProfile,
  AppTalk,
  ListRecordsResponse,
  PlcDidDocument,
} from './types'

const profileCache = new Map<string, Promise<ActorProfile | null>>()
let pdsUrlPromise: Promise<string> | null = null

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`Request failed (${response.status})`)
  }

  return (await response.json()) as T
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
  const profiles = await Promise.all(uniqueCreators.map((did) => getCachedProfile(did)))
  const profileMap = new Map(uniqueCreators.map((did, index) => [did, profiles[index]]))

  return sorted.map((record) => {
    const profile = profileMap.get(record.value.creator)
    const creatorName = profile?.displayName?.trim() || profile?.handle || truncateDid(record.value.creator)

    return {
      uri: record.uri,
      cid: record.cid,
      title: record.value.title,
      creatorDid: record.value.creator,
      creatorName,
      creatorHandle: profile?.handle,
      durationNs: record.value.duration,
      createdAt: record.value.createdAt,
    }
  })
}

export async function fetchVideoPlaylist(uri: string): Promise<string> {
  const query = new URLSearchParams({ uri })
  const playlistUrl = `${VOD_PLAYLIST_ENDPOINT}?${query.toString()}`
  const response = await fetch(playlistUrl)

  if (!response.ok) {
    throw new Error(`Unable to load playlist (${response.status})`)
  }

  const text = await response.text()

  if (!text.includes('#EXTM3U')) {
    throw new Error('Playback endpoint did not return an HLS playlist')
  }

  return playlistUrl
}
