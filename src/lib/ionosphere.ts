import { BSKY_PUBLIC_API } from './constants'
import { resolvePdsUrl } from './api'
import type {
  ActorProfile,
  AppTalk,
  IonosphereAnnotationRecord,
  IonosphereConceptRecord,
  IonosphereEnrichment,
  IonosphereEnrichmentResult,
  IonosphereSpeakerRecord,
  IonosphereTalkRecord,
} from './types'

const IONOSPHERE_DID = 'did:plc:lkeq4oghyhnztbu4dxr3joff'
const IONOSPHERE_EVENT_URI =
  'at://did:plc:lkeq4oghyhnztbu4dxr3joff/tv.ionosphere.event/atmosphereconf-2026'
const RECORDS_PAGE_LIMIT = 100
const REQUEST_TIMEOUT_MS = 8_000

interface GenericListRecordsResponse {
  records?: Array<{
    uri: string
    cid: string
    value: Record<string, unknown>
  }>
  cursor?: string
}

let enrichmentCache: Promise<IonosphereEnrichmentResult> | null = null
const profileCache = new Map<string, Promise<ActorProfile | null>>()

async function fetchWithTimeout(url: string): Promise<Response> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
  try {
    return await fetch(url, { signal: controller.signal })
  } finally {
    clearTimeout(timeout)
  }
}

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetchWithTimeout(url)
  if (!response.ok) {
    throw new Error(`Request failed (${response.status})`)
  }
  return (await response.json()) as T
}

async function fetchCollection(collection: string): Promise<GenericListRecordsResponse['records']> {
  const pds = await resolvePdsUrl(IONOSPHERE_DID)
  const out: GenericListRecordsResponse['records'] = []
  let cursor: string | undefined

  do {
    const query = new URLSearchParams({
      repo: IONOSPHERE_DID,
      collection,
      limit: String(RECORDS_PAGE_LIMIT),
    })
    if (cursor) {
      query.set('cursor', cursor)
    }

    const page = await fetchJson<GenericListRecordsResponse>(
      `${pds}/xrpc/com.atproto.repo.listRecords?${query.toString()}`,
    )

    out.push(...(page.records ?? []))
    cursor = page.cursor
  } while (cursor)

  return out
}

function normalizeTitle(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function titleScore(left: string, right: string): number {
  if (!left || !right) {
    return 0
  }

  if (left === right) {
    return 1
  }

  if (left.includes(right) || right.includes(left)) {
    return 0.86
  }

  const leftWords = new Set(left.split(' '))
  const rightWords = new Set(right.split(' '))
  const overlap = [...leftWords].filter((word) => rightWords.has(word)).length
  const denominator = Math.max(leftWords.size, rightWords.size, 1)
  return overlap / denominator
}

function pickBestTalkByTitle(
  talk: AppTalk,
  ionosphereTalks: IonosphereTalkRecord[],
): IonosphereTalkRecord | undefined {
  const normalizedVodTitle = normalizeTitle(talk.title)
  let best: IonosphereTalkRecord | undefined
  let bestScore = 0

  for (const ionosphereTalk of ionosphereTalks) {
    const normalizedIonosphereTitle = normalizeTitle(ionosphereTalk.value.title ?? '')
    const score = titleScore(normalizedVodTitle, normalizedIonosphereTitle)
    if (score > bestScore) {
      best = ionosphereTalk
      bestScore = score
    }
  }

  if (bestScore < 0.45) {
    return undefined
  }

  return best
}

async function getProfileByHandle(handle: string): Promise<ActorProfile | null> {
  const key = handle.toLowerCase()
  const cached = profileCache.get(key)
  if (cached) {
    return cached
  }

  const pending = (async () => {
    try {
      const query = new URLSearchParams({ actor: handle })
      return await fetchJson<ActorProfile>(
        `${BSKY_PUBLIC_API}/xrpc/app.bsky.actor.getProfile?${query.toString()}`,
      )
    } catch {
      return null
    }
  })()

  profileCache.set(key, pending)
  return pending
}

function asIonosphereTalks(records: GenericListRecordsResponse['records']): IonosphereTalkRecord[] {
  return (records ?? []).map((record) => ({
    uri: record.uri,
    cid: record.cid,
    value: record.value as IonosphereTalkRecord['value'],
  }))
}

function asIonosphereConcepts(
  records: GenericListRecordsResponse['records'],
): IonosphereConceptRecord[] {
  return (records ?? []).map((record) => ({
    uri: record.uri,
    cid: record.cid,
    value: record.value as IonosphereConceptRecord['value'],
  }))
}

function asIonosphereAnnotations(
  records: GenericListRecordsResponse['records'],
): IonosphereAnnotationRecord[] {
  return (records ?? []).map((record) => ({
    uri: record.uri,
    cid: record.cid,
    value: record.value as IonosphereAnnotationRecord['value'],
  }))
}

function asIonosphereSpeakers(
  records: GenericListRecordsResponse['records'],
): IonosphereSpeakerRecord[] {
  return (records ?? []).map((record) => ({
    uri: record.uri,
    cid: record.cid,
    value: record.value as IonosphereSpeakerRecord['value'],
  }))
}

async function buildEnrichment(talks: AppTalk[]): Promise<IonosphereEnrichmentResult> {
  const [talksRaw, conceptsRaw, annotationsRaw, speakersRaw] = await Promise.all([
    fetchCollection('tv.ionosphere.talk'),
    fetchCollection('tv.ionosphere.concept'),
    fetchCollection('tv.ionosphere.annotation'),
    fetchCollection('tv.ionosphere.speaker'),
  ])

  const ionosphereTalks = asIonosphereTalks(talksRaw).filter(
    (record) => record.value.eventUri === IONOSPHERE_EVENT_URI,
  )
  const conceptByUri = new Map(
    asIonosphereConcepts(conceptsRaw).map((record) => [
      record.uri,
      record.value.name ?? record.value.aliases?.[0] ?? '',
    ]),
  )

  const topicsByTalkUri = new Map<string, string[]>()
  for (const annotation of asIonosphereAnnotations(annotationsRaw)) {
    const talkUri = annotation.value.talkUri
    const conceptUri = annotation.value.conceptUri
    if (!talkUri || !conceptUri) {
      continue
    }
    const conceptName = conceptByUri.get(conceptUri)
    if (!conceptName) {
      continue
    }
    const list = topicsByTalkUri.get(talkUri) ?? []
    if (!list.includes(conceptName)) {
      list.push(conceptName)
    }
    topicsByTalkUri.set(talkUri, list)
  }

  const speakerByUri = new Map(asIonosphereSpeakers(speakersRaw).map((record) => [record.uri, record]))
  const byVodUri = new Map<string, IonosphereEnrichment>()
  const allTopics = new Set<string>()

  for (const vodTalk of talks) {
    const match = pickBestTalkByTitle(vodTalk, ionosphereTalks)
    if (!match) {
      continue
    }

    const topics = (topicsByTalkUri.get(match.uri) ?? []).slice(0, 10)
    for (const topic of topics) {
      allTopics.add(topic)
    }

    let speakerName: string | undefined
    let speakerHandle: string | undefined
    let speakerAvatar: string | undefined

    const firstSpeakerUri = match.value.speakerUris?.[0]
    if (firstSpeakerUri) {
      const speakerRecord = speakerByUri.get(firstSpeakerUri)
      speakerName = speakerRecord?.value.name
      speakerHandle = speakerRecord?.value.handle

      if (speakerHandle) {
        const profile = await getProfileByHandle(speakerHandle)
        speakerAvatar = profile?.avatar
        speakerName = profile?.displayName?.trim() || speakerName
        speakerHandle = profile?.handle || speakerHandle
      }
    }

    byVodUri.set(vodTalk.uri, {
      room: match.value.room,
      scheduledAt: match.value.startsAt,
      track: match.value.track || match.value.category,
      topics,
      speakerName,
      speakerHandle,
      speakerAvatar,
    })
  }

  return {
    byVodUri,
    allTopics: [...allTopics].sort((a, b) => a.localeCompare(b)),
  }
}

export function fetchAtmosphereIonosphereEnrichment(
  talks: AppTalk[],
): Promise<IonosphereEnrichmentResult> {
  if (!enrichmentCache) {
    enrichmentCache = buildEnrichment(talks).catch(() => ({
      byVodUri: new Map<string, IonosphereEnrichment>(),
      allTopics: [],
    }))
  }

  return enrichmentCache
}
