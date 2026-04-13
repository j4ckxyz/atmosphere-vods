import type { AppTalk } from './types'

const FALLBACK_STOPWORDS = new Set([
  'the', 'and', 'for', 'with', 'from', 'that', 'this', 'your', 'into', 'about', 'what', 'when',
  'where', 'have', 'will', 'just', 'talk', 'video', 'stream', 'conference', 'atmosphere', 'place',
  'vod', 'beta', '2026', 'how', 'why', 'can', 'you', 'all', 'are', 'its', 'our', 'new', 'more',
  'using', 'use', 'intro', 'introduction', 'deep', 'dive',
])

export function normalizeSearchValue(value: string): string {
  return value.trim().toLowerCase()
}

function unique(values: Array<string | undefined>): string[] {
  const seen = new Set<string>()
  const output: string[] = []

  for (const value of values) {
    if (!value) {
      continue
    }

    const normalized = normalizeSearchValue(value)
    if (!normalized || seen.has(normalized)) {
      continue
    }

    seen.add(normalized)
    output.push(normalized)
  }

  return output
}

function extractFallbackTokens(value: string, max: number = 6): string[] {
  const output: string[] = []
  const seen = new Set<string>()
  const words = value.toLowerCase().match(/[a-z0-9][a-z0-9-]{2,}/g) ?? []

  for (const word of words) {
    if (FALLBACK_STOPWORDS.has(word) || seen.has(word)) {
      continue
    }

    seen.add(word)
    output.push(word)
    if (output.length >= max) {
      break
    }
  }

  return output
}

export function getTalkTaxonomyTokens(talk: AppTalk): string[] {
  const explicitTokens = unique([
    talk.taxonomyGroup,
    ...(talk.taxonomyTags ?? []),
    ...(talk.taxonomyTopics ?? []),
    ...(talk.taxonomyKeywords ?? []),
  ])

  if (explicitTokens.length > 0) {
    return explicitTokens
  }

  return unique([
    ...extractFallbackTokens(talk.title, 4),
    ...extractFallbackTokens(talk.description ?? '', 3),
  ])
}

export function matchesTagRoute(talk: AppTalk, tag: string): boolean {
  const needle = normalizeSearchValue(tag)
  if (!needle) {
    return false
  }

  return getTalkTaxonomyTokens(talk).some((token) => token === needle)
}

export function scoreTalkForQuery(talk: AppTalk, query: string): number {
  const normalizedQuery = normalizeSearchValue(query)
  if (!normalizedQuery) {
    return 1
  }

  const terms = normalizedQuery.split(/\s+/).filter(Boolean)
  if (terms.length === 0) {
    return 1
  }

  const title = normalizeSearchValue(talk.title)
  const description = normalizeSearchValue(talk.description ?? '')
  const taxonomyTokens = getTalkTaxonomyTokens(talk)
  const taxonomyCorpus = taxonomyTokens.join(' ')

  let score = 0
  let allTermsPresent = true

  if (title.includes(normalizedQuery)) {
    score += 8
  }
  if (description.includes(normalizedQuery)) {
    score += 4
  }
  if (taxonomyCorpus.includes(normalizedQuery)) {
    score += 5
  }

  for (const term of terms) {
    const inTitle = title.includes(term)
    const inDescription = description.includes(term)
    const inTaxonomy = taxonomyTokens.some((token) => token.includes(term))

    if (!(inTitle || inDescription || inTaxonomy)) {
      allTermsPresent = false
      continue
    }

    if (inTitle) {
      score += 3
    }
    if (inDescription) {
      score += 2
    }
    if (inTaxonomy) {
      score += 4
    }
  }

  if (!allTermsPresent) {
    return 0
  }

  return score
}
