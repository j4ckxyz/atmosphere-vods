import { readFile, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import path from 'node:path'

const REPO_DID = 'did:plc:rbvrr34edl5ddpuwcubjiost'
const PLC_DIRECTORY_URL = 'https://plc.directory'
const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1'
const CATEGORIZER_MODEL = process.env.OPENROUTER_TAXONOMY_MODEL ?? 'google/gemini-3.1-flash-lite-preview'
const EMBEDDING_MODEL = process.env.OPENROUTER_EMBEDDING_MODEL ?? 'openai/text-embedding-3-small'
const OUTPUT_PATH = path.resolve(process.cwd(), 'src/lib/video-taxonomy.json')

const STOPWORDS = new Set([
  'the', 'and', 'for', 'with', 'from', 'that', 'this', 'your', 'into', 'about', 'what', 'when',
  'where', 'have', 'will', 'just', 'talk', 'video', 'stream', 'conference', 'atmosphere', 'place',
  'vod', 'beta', '2026', 'how', 'why', 'can', 'you', 'all', 'are', 'its', 'our', 'new', 'more',
  'using', 'use', 'intro', 'introduction', 'deep', 'dive',
])

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

function normalizeToken(value) {
  return value
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9\s-]+/g, ' ')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

function uniqueTokens(values, max = 4) {
  const output = []
  const seen = new Set()

  for (const raw of values) {
    const token = normalizeToken(raw)
    if (!token || seen.has(token)) {
      continue
    }

    seen.add(token)
    output.push(token)
    if (output.length >= max) {
      break
    }
  }

  return output
}

function extractJsonObject(text) {
  const fencedMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/i)
  const source = fencedMatch ? fencedMatch[1] : text
  const start = source.indexOf('{')
  const end = source.lastIndexOf('}')

  if (start < 0 || end < 0 || end <= start) {
    throw new Error('No JSON object found in model response')
  }

  return JSON.parse(source.slice(start, end + 1))
}

async function fetchJson(url) {
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`Request failed (${response.status}) for ${url}`)
  }
  return response.json()
}

async function resolvePdsUrl() {
  const didDoc = await fetchJson(`${PLC_DIRECTORY_URL}/${REPO_DID}`)
  const pdsService = didDoc.service?.find((entry) => entry.id === '#atproto_pds')

  if (!pdsService?.serviceEndpoint) {
    throw new Error('Could not resolve PDS endpoint from PLC DID document')
  }

  return pdsService.serviceEndpoint.replace(/\/$/, '')
}

async function fetchAllTalkRecords() {
  const pdsUrl = await resolvePdsUrl()
  const records = []
  let cursor = undefined

  do {
    const query = new URLSearchParams({
      repo: REPO_DID,
      collection: 'place.stream.video',
      limit: '100',
    })
    if (cursor) {
      query.set('cursor', cursor)
    }

    const page = await fetchJson(`${pdsUrl}/xrpc/com.atproto.repo.listRecords?${query.toString()}`)
    records.push(...(page.records ?? []))
    cursor = page.cursor
  } while (cursor)

  return records.map((record) => ({
    uri: record.uri,
    title: record.value?.title ?? 'Untitled',
    description: record.value?.description,
    createdAt: record.value?.createdAt,
  }))
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
      'X-OpenRouter-Title': 'Atmosphere VODs taxonomy generation',
    },
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`OpenRouter request failed (${response.status}): ${errorText}`)
  }

  return response.json()
}

async function buildEmbeddingVectors(talks) {
  const input = talks.map((talk) => [talk.title, talk.description].filter(Boolean).join('\n\n'))
  const response = await callOpenRouter('/embeddings', {
    model: EMBEDDING_MODEL,
    input,
    input_type: 'search_document',
  })

  return response.data.map((entry) => entry.embedding)
}

function cosineSimilarity(a, b) {
  let dot = 0
  let magA = 0
  let magB = 0

  for (let i = 0; i < a.length; i += 1) {
    dot += a[i] * b[i]
    magA += a[i] * a[i]
    magB += b[i] * b[i]
  }

  if (magA === 0 || magB === 0) {
    return 0
  }

  return dot / (Math.sqrt(magA) * Math.sqrt(magB))
}

function titleKeywords(title) {
  return (title.toLowerCase().match(/[a-z0-9][a-z0-9-]{2,}/g) ?? [])
    .map((word) => normalizeToken(word))
    .filter((word) => word && !STOPWORDS.has(word))
}

function enrichWithEmbeddingNeighbors(entriesByUri, talks, embeddings) {
  for (let i = 0; i < talks.length; i += 1) {
    const talk = talks[i]
    const entry = entriesByUri.get(talk.uri)
    if (!entry) {
      continue
    }

    const scores = []
    for (let j = 0; j < talks.length; j += 1) {
      if (i === j) {
        continue
      }

      scores.push({
        index: j,
        score: cosineSimilarity(embeddings[i], embeddings[j]),
      })
    }

    scores.sort((a, b) => b.score - a.score)
    const neighbors = scores.slice(0, 3)
    const keywordCounts = new Map()

    for (const neighbor of neighbors) {
      for (const keyword of titleKeywords(talks[neighbor.index].title)) {
        keywordCounts.set(keyword, (keywordCounts.get(keyword) ?? 0) + 1)
      }
    }

    const neighborKeywords = [...keywordCounts.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .map(([word]) => word)
      .slice(0, 2)

    entry.keywords = uniqueTokens([...(entry.keywords ?? []), ...neighborKeywords], 6)
  }
}

function fallbackEntry(uri, title) {
  const tokens = titleKeywords(title)
  return {
    uri,
    group: 'general',
    tags: uniqueTokens(tokens.slice(0, 2), 3),
    topics: uniqueTokens(tokens.slice(0, 1), 2),
    keywords: uniqueTokens(tokens.slice(0, 4), 6),
  }
}

async function categorizeTalks(talks) {
  const compactInput = talks.map((talk) => ({
    uri: talk.uri,
    title: talk.title,
    description: talk.description ?? null,
  }))

  const response = await callOpenRouter('/chat/completions', {
    model: CATEGORIZER_MODEL,
    temperature: 0.2,
    max_tokens: 12_000,
    messages: [
      {
        role: 'system',
        content:
          'You classify conference talk metadata into a compact, useful taxonomy. Use lowercase kebab-case tokens only. Keep tags and topics broad and reusable. Output valid JSON only.',
      },
      {
        role: 'user',
        content: `Classify each talk. Constraints:\n- 8-14 groups total across all talks\n- each talk: group (1), tags (2-4), topics (1-2), keywords (2-5)\n- tags/topics must be concise and reusable\n- if description is null, classify from title only\n\nTalks JSON:\n${JSON.stringify(compactInput)}`,
      },
    ],
    response_format: {
      type: 'json_schema',
      json_schema: {
        name: 'video_taxonomy',
        strict: true,
        schema: {
          type: 'object',
          properties: {
            entries: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  uri: { type: 'string' },
                  group: { type: 'string' },
                  tags: { type: 'array', items: { type: 'string' } },
                  topics: { type: 'array', items: { type: 'string' } },
                  keywords: { type: 'array', items: { type: 'string' } },
                },
                required: ['uri', 'group', 'tags', 'topics', 'keywords'],
                additionalProperties: false,
              },
            },
          },
          required: ['entries'],
          additionalProperties: false,
        },
      },
    },
  })

  const content = response.choices?.[0]?.message?.content
  if (typeof content !== 'string') {
    throw new Error('OpenRouter categorizer returned empty content')
  }

  const parsed = extractJsonObject(content)
  return parsed.entries
}

async function main() {
  await loadEnv()

  const talks = await fetchAllTalkRecords()
  talks.sort((a, b) => new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime())

  if (talks.length === 0) {
    throw new Error('No talks found to categorize')
  }

  console.log(`Fetched ${talks.length} talks`)

  const embeddings = await buildEmbeddingVectors(talks)
  console.log(`Generated ${embeddings.length} embeddings with ${EMBEDDING_MODEL}`)

  const llmEntries = await categorizeTalks(talks)
  const entriesByUri = new Map()

  for (const entry of llmEntries) {
    entriesByUri.set(entry.uri, {
      uri: entry.uri,
      group: normalizeToken(entry.group) || 'general',
      tags: uniqueTokens(entry.tags ?? [], 4),
      topics: uniqueTokens(entry.topics ?? [], 3),
      keywords: uniqueTokens(entry.keywords ?? [], 6),
    })
  }

  for (const talk of talks) {
    if (!entriesByUri.has(talk.uri)) {
      entriesByUri.set(talk.uri, fallbackEntry(talk.uri, talk.title))
    }
  }

  enrichWithEmbeddingNeighbors(entriesByUri, talks, embeddings)

  const output = {
    version: 1,
    generatedAt: new Date().toISOString(),
    models: {
      categorizer: CATEGORIZER_MODEL,
      embeddings: EMBEDDING_MODEL,
    },
    entries: talks.map((talk) => entriesByUri.get(talk.uri)),
  }

  await writeFile(OUTPUT_PATH, `${JSON.stringify(output, null, 2)}\n`, 'utf8')
  console.log(`Wrote taxonomy to ${OUTPUT_PATH}`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
