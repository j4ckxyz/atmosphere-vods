interface EmbeddingEntry {
  uri: string
  sourceRepoDid?: string
  createdAt?: string
  title?: string
  embedding: number[]
}

interface EmbeddingIndex {
  version: number
  generatedAt: string
  model: string
  entries: EmbeddingEntry[]
}

interface MinimalTalkRecord {
  uri: string
  sourceRepoDid: string
  title: string
  createdAt?: string
}

interface PagesFunctionContextLike {
  request: Request
  env: {
    OPENROUTER_API_KEY?: string
    OPENROUTER_EMBEDDING_MODEL?: string
    EMBEDDINGS_INDEX_URL?: string
    ASSETS?: {
      fetch: (request: Request) => Promise<Response>
    }
  }
}

type RankedEntry = {
  uri: string
  score: number
  semantic: number
  lexical: number
  freshness: number
}

let cachedIndex: { loadedAt: number; index: EmbeddingIndex; norms: number[] } | null = null
let cachedLiveCatalog: {
  loadedAt: number
  talks: MinimalTalkRecord[]
  titleByUri: Map<string, string>
  recencyByUri: Map<string, string>
} | null = null
const INDEX_TTL_MS = 5 * 60 * 1000
const LIVE_CATALOG_TTL_MS = 2 * 60 * 1000

function normalizeVector(vector: number[]): number {
  let sum = 0
  for (const value of vector) {
    sum += value * value
  }
  return Math.sqrt(sum)
}

function cosineSimilarity(a: number[], b: number[], normA: number, normB: number): number {
  if (normA === 0 || normB === 0 || a.length !== b.length) {
    return 0
  }

  let dot = 0
  for (let i = 0; i < a.length; i += 1) {
    dot += a[i] * b[i]
  }

  return dot / (normA * normB)
}

function lexicalScore(query: string, title: string): number {
  const normalizedQuery = query.trim().toLowerCase()
  if (!normalizedQuery) {
    return 0
  }

  const normalizedTitle = title.toLowerCase()
  if (normalizedTitle.includes(normalizedQuery)) {
    return 1
  }

  const terms = normalizedQuery.split(/\s+/).filter(Boolean)
  if (terms.length === 0) {
    return 0
  }

  let matched = 0
  for (const term of terms) {
    if (normalizedTitle.includes(term)) {
      matched += 1
    }
  }

  return matched / terms.length
}

function parseLimit(value: string | null): number {
  if (!value) {
    return 100
  }

  const parsed = Number.parseInt(value, 10)
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return 100
  }

  return Math.min(parsed, 500)
}

async function fetchJsonWithTimeout<T>(url: string, timeoutMs: number = 8_000): Promise<T> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const response = await fetch(url, { signal: controller.signal })
    if (!response.ok) {
      throw new Error(`Request failed (${response.status})`)
    }
    return (await response.json()) as T
  } finally {
    clearTimeout(timeout)
  }
}

async function resolvePdsUrl(did: string): Promise<string> {
  const didDoc = await fetchJsonWithTimeout<{
    service?: Array<{ id?: string; serviceEndpoint?: string }>
  }>(`https://plc.directory/${did}`)
  const pdsService = didDoc.service?.find((entry) => entry.id === '#atproto_pds')
  if (!pdsService?.serviceEndpoint) {
    throw new Error(`PDS endpoint missing for ${did}`)
  }
  return pdsService.serviceEndpoint.replace(/\/$/, '')
}

async function fetchReposByCollection(collection: string): Promise<string[]> {
  const dids = new Set<string>()
  let cursor: string | undefined

  do {
    const query = new URLSearchParams({
      collection,
      limit: '1000',
    })
    if (cursor) {
      query.set('cursor', cursor)
    }

    const response = await fetchJsonWithTimeout<{
      repos?: Array<{ did?: string }>
      cursor?: string
    }>(`https://bsky.network/xrpc/com.atproto.sync.listReposByCollection?${query.toString()}`)

    for (const entry of response.repos ?? []) {
      if (entry.did) {
        dids.add(entry.did)
      }
    }

    cursor = response.cursor
  } while (cursor)

  return [...dids]
}

async function fetchRecordsForRepo(did: string): Promise<MinimalTalkRecord[]> {
  const pdsUrl = await resolvePdsUrl(did)
  const talks: MinimalTalkRecord[] = []
  let cursor: string | undefined

  do {
    const query = new URLSearchParams({
      repo: did,
      collection: 'place.stream.video',
      limit: '100',
    })
    if (cursor) {
      query.set('cursor', cursor)
    }

    const response = await fetchJsonWithTimeout<{
      records?: Array<{
        uri?: string
        value?: {
          title?: string
          createdAt?: string
        }
      }>
      cursor?: string
    }>(`${pdsUrl}/xrpc/com.atproto.repo.listRecords?${query.toString()}`)

    for (const record of response.records ?? []) {
      if (!record.uri) {
        continue
      }
      talks.push({
        uri: record.uri,
        sourceRepoDid: did,
        title: record.value?.title ?? 'Untitled',
        createdAt: record.value?.createdAt,
      })
    }

    cursor = response.cursor
  } while (cursor)

  return talks
}

async function loadLiveCatalog(): Promise<{
  talks: MinimalTalkRecord[]
  titleByUri: Map<string, string>
  recencyByUri: Map<string, string>
}> {
  if (cachedLiveCatalog && Date.now() - cachedLiveCatalog.loadedAt < LIVE_CATALOG_TTL_MS) {
    return {
      talks: cachedLiveCatalog.talks,
      titleByUri: cachedLiveCatalog.titleByUri,
      recencyByUri: cachedLiveCatalog.recencyByUri,
    }
  }

  const repoDids = await fetchReposByCollection('place.stream.video')
  const batches = await Promise.all(
    repoDids.map(async (did) => {
      try {
        return await fetchRecordsForRepo(did)
      } catch {
        return []
      }
    }),
  )

  const talks = batches.flat()
  const titleByUri = new Map(talks.map((talk) => [talk.uri, talk.title]))
  const recencyByUri = new Map(
    talks
      .filter((talk) => Boolean(talk.createdAt))
      .map((talk) => [talk.uri, talk.createdAt as string]),
  )

  cachedLiveCatalog = {
    loadedAt: Date.now(),
    talks,
    titleByUri,
    recencyByUri,
  }

  return { talks, titleByUri, recencyByUri }
}

async function loadEmbeddingIndex(context: PagesFunctionContextLike): Promise<{ index: EmbeddingIndex; norms: number[] }> {
  if (cachedIndex && Date.now() - cachedIndex.loadedAt < INDEX_TTL_MS) {
    return { index: cachedIndex.index, norms: cachedIndex.norms }
  }

  let index: EmbeddingIndex | null = null

  const remoteIndexUrl = context.env.EMBEDDINGS_INDEX_URL
  if (remoteIndexUrl) {
    try {
      const remoteResponse = await fetch(remoteIndexUrl, {
        headers: {
          Accept: 'application/json',
          'Cache-Control': 'no-cache',
        },
      })

      if (remoteResponse.ok) {
        index = validateEmbeddingIndex((await remoteResponse.json()) as EmbeddingIndex)
      }
    } catch {
      index = null
    }
  }

  if (!index) {
    const assets = context.env.ASSETS
    if (!assets) {
      throw new Error('Cloudflare ASSETS binding unavailable')
    }

    const origin = new URL(context.request.url).origin
    const assetsRequest = new Request(`${origin}/video-embeddings.json`, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
      },
    })
    const response = await assets.fetch(assetsRequest)

    if (!response.ok) {
      throw new Error(`Embeddings asset unavailable (${response.status})`)
    }

    index = validateEmbeddingIndex((await response.json()) as EmbeddingIndex)
  }

  const norms = (index.entries ?? []).map((entry) => normalizeVector(entry.embedding ?? []))

  cachedIndex = {
    loadedAt: Date.now(),
    index,
    norms,
  }

  return { index, norms }
}

async function embedQuery(
  context: PagesFunctionContextLike,
  query: string,
  embeddingModel: string,
): Promise<number[] | null> {
  const apiKey = context.env.OPENROUTER_API_KEY
  if (!apiKey) {
    return null
  }

  const response = await fetch('https://openrouter.ai/api/v1/embeddings', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': new URL(context.request.url).origin,
      'X-OpenRouter-Title': 'Streamplace VOD semantic search',
    },
    body: JSON.stringify({
      model: embeddingModel,
      input: query,
      input_type: 'search_query',
    }),
  })

  if (!response.ok) {
    throw new Error(`Embedding request failed (${response.status})`)
  }

  const payload = (await response.json()) as { data?: Array<{ embedding?: number[] }> }
  const vector = payload.data?.[0]?.embedding
  return Array.isArray(vector) ? vector : null
}

function recencyBounds(entries: EmbeddingEntry[]): { min: number; max: number } {
  let min = Number.POSITIVE_INFINITY
  let max = Number.NEGATIVE_INFINITY

  for (const entry of entries) {
    const timestamp = Date.parse(entry.createdAt ?? '')
    if (!Number.isFinite(timestamp)) {
      continue
    }
    if (timestamp < min) {
      min = timestamp
    }
    if (timestamp > max) {
      max = timestamp
    }
  }

  if (!Number.isFinite(min) || !Number.isFinite(max)) {
    return { min: 0, max: 0 }
  }

  return { min, max }
}

function recencyScore(createdAt: string | undefined, bounds: { min: number; max: number }): number {
  if (bounds.max <= bounds.min) {
    return 0
  }

  const timestamp = Date.parse(createdAt ?? '')
  if (!Number.isFinite(timestamp)) {
    return 0
  }

  return (timestamp - bounds.min) / (bounds.max - bounds.min)
}

function mapNormsByUri(entries: EmbeddingEntry[], norms: number[]): Map<string, number> {
  const normByUri = new Map<string, number>()
  for (let i = 0; i < entries.length; i += 1) {
    normByUri.set(entries[i].uri, norms[i] ?? 0)
  }
  return normByUri
}

function validateEmbeddingIndex(index: EmbeddingIndex): EmbeddingIndex {
  if (!Array.isArray(index.entries)) {
    throw new Error('Embedding index entries missing')
  }

  let expectedDimensions = 0

  const validEntries = index.entries.filter((entry) => {
    if (!entry?.uri || !Array.isArray(entry.embedding)) {
      return false
    }

    if (entry.embedding.length === 0) {
      return false
    }

    if (!entry.embedding.every((value) => Number.isFinite(value))) {
      return false
    }

    if (expectedDimensions === 0) {
      expectedDimensions = entry.embedding.length
    }

    return entry.embedding.length === expectedDimensions
  })

  if (validEntries.length === 0) {
    throw new Error('No valid embeddings in index')
  }

  return {
    ...index,
    entries: validEntries,
  }
}

function jsonResponse(body: unknown, init?: ResponseInit): Response {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'public, max-age=60, s-maxage=300',
      ...(init?.headers ?? {}),
    },
  })
}

export const onRequestGet = async (context: PagesFunctionContextLike): Promise<Response> => {
  const url = new URL(context.request.url)
  const query = (url.searchParams.get('q') ?? '').trim()
  const limit = parseLimit(url.searchParams.get('limit'))

  if (!query) {
    return jsonResponse({ uris: [], mode: 'lexical', notice: 'Query is empty.' })
  }

  try {
    const [{ index, norms }, liveCatalog] = await Promise.all([
      loadEmbeddingIndex(context),
      loadLiveCatalog(),
    ])
    const entries = index.entries ?? []
    if (liveCatalog.talks.length === 0) {
      return jsonResponse({ uris: [], mode: 'lexical', notice: 'No videos discovered from repos.' })
    }

    const liveUris = new Set(liveCatalog.talks.map((talk) => talk.uri))
    const embeddedEntries = entries.filter((entry) => liveUris.has(entry.uri))
    const embeddedUriSet = new Set(embeddedEntries.map((entry) => entry.uri))
    const unembeddedTalks = liveCatalog.talks.filter((talk) => !embeddedUriSet.has(talk.uri))

    if (embeddedEntries.length === 0) {
      const lexicalOnly = liveCatalog.talks
        .map((talk) => ({
          uri: talk.uri,
          score: lexicalScore(query, talk.title),
        }))
        .filter((entry) => entry.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, limit)

      return jsonResponse({
        uris: lexicalOnly.map((entry) => entry.uri),
        mode: 'lexical',
        notice: 'Embedding index is empty or stale; using lexical fallback over live catalog.',
        generatedAt: index.generatedAt,
        indexedCount: 0,
      })
    }

    const normByUri = mapNormsByUri(entries, norms)
    const queryVector = await embedQuery(context, query, index.model)
    if (!queryVector) {
      const lexicalRanked = liveCatalog.talks
        .map((entry) => ({
          uri: entry.uri,
          score: lexicalScore(query, entry.title ?? ''),
        }))
        .filter((entry) => entry.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, limit)

      return jsonResponse({
        uris: lexicalRanked.map((entry) => entry.uri),
        mode: 'lexical',
        notice: 'OpenRouter key missing; using lexical title search fallback.',
        generatedAt: index.generatedAt,
        indexedCount: embeddedEntries.length,
      })
    }

    const expectedDimensions = embeddedEntries[0]?.embedding.length ?? 0
    if (expectedDimensions > 0 && queryVector.length !== expectedDimensions) {
      const lexicalRanked = liveCatalog.talks
        .map((entry) => ({
          uri: entry.uri,
          score: lexicalScore(query, entry.title ?? ''),
        }))
        .filter((entry) => entry.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, limit)

      return jsonResponse({
        uris: lexicalRanked.map((entry) => entry.uri),
        mode: 'lexical',
        notice: `Embedding model mismatch (${index.model}); using lexical title search fallback.`,
        generatedAt: index.generatedAt,
        indexedCount: embeddedEntries.length,
      })
    }

    const queryNorm = normalizeVector(queryVector)
    const bounds = recencyBounds(embeddedEntries)
    const ranked: RankedEntry[] = []

    for (let i = 0; i < embeddedEntries.length; i += 1) {
      const entry = embeddedEntries[i]
      const similarity = cosineSimilarity(queryVector, entry.embedding ?? [], queryNorm, normByUri.get(entry.uri) ?? 0)
      const liveTitle = liveCatalog.titleByUri.get(entry.uri) ?? entry.title ?? ''
      const lexical = lexicalScore(query, liveTitle)
      const freshness = recencyScore(liveCatalog.recencyByUri.get(entry.uri) ?? entry.createdAt, bounds)
      const semantic = (similarity + 1) / 2
      const score = semantic * 0.9 + lexical * 0.08 + freshness * 0.02

      if (score > 0) {
        ranked.push({ uri: entry.uri, score, semantic, lexical, freshness })
      }
    }

    const lexicalForUnembedded = unembeddedTalks
      .map((talk) => ({
        uri: talk.uri,
        score: lexicalScore(query, talk.title) * 0.55,
        semantic: 0,
        lexical: lexicalScore(query, talk.title),
        freshness: 0,
      }))
      .filter((entry) => entry.score > 0)

    ranked.push(...lexicalForUnembedded)

    ranked.sort(
      (a, b) =>
        b.score - a.score ||
        b.semantic - a.semantic ||
        b.lexical - a.lexical ||
        b.freshness - a.freshness ||
        a.uri.localeCompare(b.uri),
    )

    const stalenessNotice =
      unembeddedTalks.length > 0
        ? `${unembeddedTalks.length} newly discovered videos are currently lexical-ranked until the embedding index refreshes.`
        : 'All discovered videos are represented in the embedding index.'

    return jsonResponse({
      uris: ranked.slice(0, limit).map((entry) => entry.uri),
      mode: 'semantic',
      notice: `${stalenessNotice} AtmosphereConf entries rank best where tags/topics are available.`,
      generatedAt: index.generatedAt,
      indexedCount: embeddedEntries.length,
    })
  } catch (error) {
    return jsonResponse(
      {
        uris: [],
        mode: 'lexical',
        notice: error instanceof Error ? error.message : 'Search backend unavailable.',
        generatedAt: null,
        indexedCount: 0,
      },
      { status: 200 },
    )
  }
}
