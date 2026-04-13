import { readFile, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import path from 'node:path'

const PLC_DIRECTORY_URL = 'https://plc.directory'
const BSKY_RELAY_SYNC_API = 'https://bsky.network'
const STREAMPLACE_VIDEO_COLLECTION = 'place.stream.video'
const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1'
const EMBEDDING_MODEL = process.env.OPENROUTER_EMBEDDING_MODEL ?? 'qwen/qwen3-embedding-8b'
const OUTPUT_PATH = path.resolve(
  process.cwd(),
  process.env.EMBEDDINGS_OUTPUT_PATH ?? 'public/video-embeddings.json',
)
const EXISTING_PATH = path.resolve(
  process.cwd(),
  process.env.EXISTING_EMBEDDINGS_PATH ?? process.env.EMBEDDINGS_OUTPUT_PATH ?? 'public/video-embeddings.json',
)
const TAXONOMY_PATH = path.resolve(process.cwd(), 'src/lib/video-taxonomy.json')
const IONOSPHERE_DID = 'did:plc:lkeq4oghyhnztbu4dxr3joff'
const IONOSPHERE_EVENT_URI =
  'at://did:plc:lkeq4oghyhnztbu4dxr3joff/tv.ionosphere.event/atmosphereconf-2026'
const EMBEDDING_BATCH_SIZE = Number.parseInt(process.env.EMBEDDING_BATCH_SIZE ?? '64', 10)

function asString(value) {
  return typeof value === 'string' ? value : ''
}

function normalizeWhitespace(value) {
  return value.replace(/\s+/g, ' ').trim()
}

function parseEnvFile(content) {
  const vars = {}

  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line || line.startsWith('#')) {
      continue
    }

    const idx = line.indexOf('=')
    if (idx <= 0) {
      continue
    }

    const key = line.slice(0, idx).trim()
    let value = line.slice(idx + 1).trim()
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1)
    }

    vars[key] = value
  }

  return vars
}

async function loadEnv() {
  const candidatePaths = [
    path.resolve(process.cwd(), '.env'),
    path.resolve(process.cwd(), '..', '.env'),
  ]

  for (const filePath of candidatePaths) {
    if (!existsSync(filePath)) {
      continue
    }

    const content = await readFile(filePath, 'utf8')
    const parsed = parseEnvFile(content)

    for (const [key, value] of Object.entries(parsed)) {
      if (!process.env[key]) {
        process.env[key] = value
      }
    }
  }
}

async function fetchJson(url) {
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`Request failed (${response.status}) for ${url}`)
  }
  return response.json()
}

function isFiniteNumber(value) {
  return typeof value === 'number' && Number.isFinite(value)
}

async function loadExistingIndex() {
  if (!existsSync(EXISTING_PATH)) {
    return null
  }

  const raw = await readFile(EXISTING_PATH, 'utf8')
  try {
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed.entries)) {
      return null
    }
    return parsed
  } catch {
    return null
  }
}

async function callOpenRouter(pathname, body) {
  const apiKey = process.env.OPENROUTER_API_KEY
  if (!apiKey) {
    throw new Error('OPENROUTER_API_KEY is missing')
  }

  const response = await fetch(`${OPENROUTER_API_URL}${pathname}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://vods.j4ck.xyz',
      'X-OpenRouter-Title': 'Streamplace VOD embeddings generation',
    },
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`OpenRouter request failed (${response.status}): ${errorText}`)
  }

  return response.json()
}

async function resolvePdsUrl(did) {
  const didDoc = await fetchJson(`${PLC_DIRECTORY_URL}/${did}`)
  const pdsService = didDoc.service?.find((entry) => entry.id === '#atproto_pds')

  if (!pdsService?.serviceEndpoint) {
    throw new Error(`Could not resolve PDS endpoint from DID document for ${did}`)
  }

  return pdsService.serviceEndpoint.replace(/\/$/, '')
}

async function fetchReposByCollection(collection) {
  const repos = []
  let cursor = undefined

  do {
    const query = new URLSearchParams({
      collection,
      limit: '1000',
    })

    if (cursor) {
      query.set('cursor', cursor)
    }

    const page = await fetchJson(
      `${BSKY_RELAY_SYNC_API}/xrpc/com.atproto.sync.listReposByCollection?${query.toString()}`,
    )

    for (const repo of page.repos ?? []) {
      if (repo.did) {
        repos.push(repo.did)
      }
    }

    cursor = page.cursor
  } while (cursor)

  return [...new Set(repos)]
}

async function fetchAllRecordsForRepo(repoDid) {
  const pdsUrl = await resolvePdsUrl(repoDid)
  const records = []
  let cursor = undefined

  do {
    const query = new URLSearchParams({
      repo: repoDid,
      collection: STREAMPLACE_VIDEO_COLLECTION,
      limit: '100',
    })
    if (cursor) {
      query.set('cursor', cursor)
    }

    const page = await fetchJson(`${pdsUrl}/xrpc/com.atproto.repo.listRecords?${query.toString()}`)
    records.push(...(page.records ?? []))
    cursor = page.cursor
  } while (cursor)

  return records
}

async function fetchAllCollectionRecords(repoDid, collection) {
  const pdsUrl = await resolvePdsUrl(repoDid)
  const records = []
  let cursor = undefined

  do {
    const query = new URLSearchParams({
      repo: repoDid,
      collection,
      limit: '100',
    })
    if (cursor) {
      query.set('cursor', cursor)
    }

    const page = await fetchJson(`${pdsUrl}/xrpc/com.atproto.repo.listRecords?${query.toString()}`)
    records.push(...(page.records ?? []))
    cursor = page.cursor
  } while (cursor)

  return records
}

function toEmbeddingInput(record) {
  const title = record.value?.title ?? 'Untitled'
  const description = record.value?.description ?? ''
  const creator = record.value?.creator ?? ''
  const transcript = record.ionosphereTranscript ?? ''
  const ionosphereConcepts = record.ionosphereConcepts ?? []
  const taxonomy = record.taxonomy
  const taxonomyLine = taxonomy
    ? [
        ...(taxonomy.tags ?? []),
        ...(taxonomy.topics ?? []),
        ...(taxonomy.keywords ?? []),
      ]
        .filter(Boolean)
        .join(', ')
    : ''

  return [
    `title: ${title}`,
    description ? `description: ${description}` : '',
    creator ? `creator: ${creator}` : '',
    transcript ? `transcript: ${transcript}` : '',
    ionosphereConcepts.length > 0 ? `concepts: ${ionosphereConcepts.join(', ')}` : '',
    taxonomyLine ? `atmosphere-taxonomy: ${taxonomyLine}` : '',
  ]
    .filter(Boolean)
    .join('\n')
}

function computeContentSignature(record) {
  return toEmbeddingInput(record)
}

async function embedBatch(inputs) {
  const embeddingResponse = await callOpenRouter('/embeddings', {
    model: EMBEDDING_MODEL,
    input: inputs,
    input_type: 'search_document',
  })

  return embeddingResponse.data ?? []
}

function catalogSignature(entries) {
  return entries
    .map((entry) => `${entry.uri}|${entry.sourceRepoDid}|${entry.createdAt ?? ''}|${entry.title}`)
    .join('\n')
}

async function main() {
  await loadEnv()

  const taxonomyRaw = await readFile(TAXONOMY_PATH, 'utf8')
  const taxonomyData = JSON.parse(taxonomyRaw)
  const taxonomyByUri = new Map((taxonomyData.entries ?? []).map((entry) => [entry.uri, entry]))

  const repoDids = await fetchReposByCollection(STREAMPLACE_VIDEO_COLLECTION)
  if (repoDids.length === 0) {
    throw new Error('No repos discovered for place.stream.video')
  }

  console.log(`Discovered ${repoDids.length} repos`)

  const [ionosphereTalkRecords, ionosphereConceptRecords, ionosphereAnnotationRecords, ionosphereTranscriptRecords] =
    await Promise.all([
      fetchAllCollectionRecords(IONOSPHERE_DID, 'tv.ionosphere.talk'),
      fetchAllCollectionRecords(IONOSPHERE_DID, 'tv.ionosphere.concept'),
      fetchAllCollectionRecords(IONOSPHERE_DID, 'tv.ionosphere.annotation'),
      fetchAllCollectionRecords(IONOSPHERE_DID, 'tv.ionosphere.transcript'),
    ])

  const ionosphereTalks = ionosphereTalkRecords.filter(
    (record) => record?.value?.eventUri === IONOSPHERE_EVENT_URI && asString(record?.value?.videoUri),
  )
  const talkUriByVideoUri = new Map(
    ionosphereTalks.map((record) => [asString(record.value.videoUri), record.uri]),
  )

  const conceptNameByUri = new Map(
    ionosphereConceptRecords
      .map((record) => {
        const aliases = Array.isArray(record?.value?.aliases)
          ? record.value.aliases.filter((alias) => typeof alias === 'string')
          : []
        const conceptName = asString(record?.value?.name) || asString(aliases[0])
        return [record.uri, conceptName]
      })
      .filter((entry) => Boolean(entry[0] && entry[1])),
  )

  const conceptsByTalkUri = new Map()
  for (const annotation of ionosphereAnnotationRecords) {
    const talkUri = asString(annotation?.value?.talkUri)
    const conceptUri = asString(annotation?.value?.conceptUri)
    if (!talkUri || !conceptUri) {
      continue
    }
    const conceptName = conceptNameByUri.get(conceptUri)
    if (!conceptName) {
      continue
    }
    const existing = conceptsByTalkUri.get(talkUri) ?? []
    if (!existing.includes(conceptName)) {
      existing.push(conceptName)
      conceptsByTalkUri.set(talkUri, existing)
    }
  }

  const transcriptByTalkUri = new Map()
  for (const transcriptRecord of ionosphereTranscriptRecords) {
    const talkUri = asString(transcriptRecord?.value?.talkUri)
    const text = normalizeWhitespace(
      asString(transcriptRecord?.value?.text) || asString(transcriptRecord?.value?.transcript),
    )
    if (!talkUri || !text) {
      continue
    }
    const existing = transcriptByTalkUri.get(talkUri)
    transcriptByTalkUri.set(talkUri, existing ? `${existing}\n${text}` : text)
  }

  console.log(`Loaded ${ionosphereTalks.length} Atmosphere talks from ionosphere`)

  const allRecords = []
  for (const repoDid of repoDids) {
    try {
      const records = await fetchAllRecordsForRepo(repoDid)
      console.log(`Fetched ${records.length} videos from ${repoDid}`)
      for (const record of records) {
        const talkUri = talkUriByVideoUri.get(record.uri)
        allRecords.push({
          ...record,
          sourceRepoDid: repoDid,
          taxonomy: taxonomyByUri.get(record.uri),
          ionosphereTranscript: talkUri ? transcriptByTalkUri.get(talkUri) ?? '' : '',
          ionosphereConcepts: talkUri ? conceptsByTalkUri.get(talkUri) ?? [] : [],
        })
      }
    } catch (error) {
      console.warn(`Skipping ${repoDid}: ${error instanceof Error ? error.message : 'failed'}`)
    }
  }

  if (allRecords.length === 0) {
    throw new Error('No video records available for embedding generation')
  }

  const existing = await loadExistingIndex()
  const canReuseExisting = existing?.model === EMBEDDING_MODEL
  const existingByUri = new Map(
    canReuseExisting
      ? (existing.entries ?? [])
          .filter((entry) => Array.isArray(entry.embedding) && entry.embedding.length > 0)
          .map((entry) => [entry.uri, entry])
      : [],
  )

  if (existing && !canReuseExisting) {
    console.log(
      `Existing index model (${existing.model}) differs from ${EMBEDDING_MODEL}; rebuilding all embeddings`,
    )
  }

  const recordsByUri = new Map(allRecords.map((record) => [record.uri, record]))
  const orderedUris = [...recordsByUri.keys()].sort((left, right) => left.localeCompare(right))
  const orderedRecords = orderedUris.map((uri) => recordsByUri.get(uri))

  const reuseCandidates = []
  const missingRecords = []

  for (const record of orderedRecords) {
    const existingEntry = existingByUri.get(record.uri)
    const nextContentSignature = computeContentSignature(record)
    if (existingEntry?.contentSignature === nextContentSignature) {
      reuseCandidates.push({ record, existingEntry })
    } else {
      missingRecords.push(record)
    }
  }

  const newEmbeddingsByUri = new Map()

  for (let start = 0; start < missingRecords.length; start += EMBEDDING_BATCH_SIZE) {
    const batchRecords = missingRecords.slice(start, start + EMBEDDING_BATCH_SIZE)
    const inputs = batchRecords.map((record) => toEmbeddingInput(record))
    const data = await embedBatch(inputs)

    for (let i = 0; i < batchRecords.length; i += 1) {
      const embedding = data[i]?.embedding
      if (!Array.isArray(embedding) || embedding.length === 0) {
        throw new Error(`Embedding missing for URI ${batchRecords[i].uri}`)
      }
      if (!embedding.every((value) => isFiniteNumber(value))) {
        throw new Error(`Invalid embedding values for URI ${batchRecords[i].uri}`)
      }
      newEmbeddingsByUri.set(batchRecords[i].uri, embedding)
    }

    console.log(
      `Embedded ${Math.min(start + EMBEDDING_BATCH_SIZE, missingRecords.length)}/${missingRecords.length} new records`,
    )
  }

  const nextEntries = orderedRecords.map((record) => {
    const reused = existingByUri.get(record.uri)
    const embedding = reused?.embedding ?? newEmbeddingsByUri.get(record.uri)
    return {
      uri: record.uri,
      sourceRepoDid: record.sourceRepoDid,
      createdAt: record.value?.createdAt,
      title: record.value?.title ?? 'Untitled',
      contentSignature: computeContentSignature(record),
      embedding,
    }
  })

  const previousSignature = existing ? catalogSignature(existing.entries ?? []) : ''
  const nextSignature = catalogSignature(nextEntries)
  const hasCatalogChanges = previousSignature !== nextSignature
  const hasNewEmbeddings = missingRecords.length > 0

  const output = {
    version: 1,
    generatedAt:
      hasNewEmbeddings || hasCatalogChanges || !existing?.generatedAt
        ? new Date().toISOString()
        : existing.generatedAt,
    model: EMBEDDING_MODEL,
    entries: nextEntries,
  }

  await writeFile(OUTPUT_PATH, `${JSON.stringify(output, null, 2)}\n`, 'utf8')
  console.log(`Reused embeddings: ${reuseCandidates.length}`)
  console.log(`New embeddings: ${missingRecords.length}`)
  console.log(`Wrote embeddings to ${OUTPUT_PATH}`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
