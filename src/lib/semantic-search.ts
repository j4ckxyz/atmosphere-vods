export interface RemoteSearchResult {
  uris: string[]
  mode: 'semantic' | 'lexical'
  notice?: string
  generatedAt?: string
  indexedCount?: number
}

export async function searchTalkUris(
  query: string,
  limit: number = 200,
  signal?: AbortSignal,
): Promise<RemoteSearchResult> {
  const params = new URLSearchParams({
    q: query,
    limit: String(limit),
  })

  const response = await fetch(`/api/search?${params.toString()}`, {
    method: 'GET',
    signal,
  })

  if (!response.ok) {
    throw new Error(`Search request failed (${response.status})`)
  }

  const data = (await response.json()) as RemoteSearchResult
  return {
    uris: data.uris ?? [],
    mode: data.mode ?? 'lexical',
    notice: data.notice,
    generatedAt: data.generatedAt,
    indexedCount: data.indexedCount,
  }
}
