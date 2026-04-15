interface PagesFunctionContextLike {
  request: Request
  env: {
    ASSETS?: {
      fetch: (request: Request) => Promise<Response>
    }
  }
  params?: {
    didParam?: string
    rkeyParam?: string
  }
}

interface TalkMetadata {
  title: string
  description: string
}

const STREAMPLACE_COLLECTION = 'place.stream.video'
const SITE_NAME = 'Streamplace VOD Client'
const DEFAULT_DESCRIPTION = 'Browse Streamplace and AtmosphereConf VODs with deep links and fast playback.'
const OG_MARKER_PATTERN = /<!--OG_META_START-->[\s\S]*?<!--OG_META_END-->/

function decodePathValue(value: string | undefined): string | null {
  if (!value) {
    return null
  }

  try {
    const decoded = decodeURIComponent(value).trim()
    return decoded || null
  } catch {
    return null
  }
}

function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) {
    return text
  }

  return `${text.slice(0, Math.max(1, maxLength - 1)).trimEnd()}…`
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
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
    throw new Error('PDS endpoint not found')
  }

  return pdsService.serviceEndpoint.replace(/\/$/, '')
}

async function fetchTalkMetadata(videoUri: string, did: string, rkey: string): Promise<TalkMetadata | null> {
  try {
    const pdsUrl = await resolvePdsUrl(did)
    const query = new URLSearchParams({
      repo: did,
      collection: STREAMPLACE_COLLECTION,
      rkey,
      uri: videoUri,
    })
    const record = await fetchJsonWithTimeout<{
      value?: {
        title?: string
        description?: string
      }
    }>(`${pdsUrl}/xrpc/com.atproto.repo.getRecord?${query.toString()}`)

    const title = record.value?.title?.trim()
    if (!title) {
      return null
    }

    const description = record.value?.description?.trim() || DEFAULT_DESCRIPTION

    return {
      title: truncate(title, 100),
      description: truncate(description, 240),
    }
  } catch {
    return null
  }
}

function buildOgMetaBlock(input: {
  title: string
  description: string
  canonicalUrl: string
  imageUrl: string
}): string {
  const title = escapeHtml(input.title)
  const description = escapeHtml(input.description)
  const canonicalUrl = escapeHtml(input.canonicalUrl)
  const imageUrl = escapeHtml(input.imageUrl)

  return [
    `<meta name="description" content="${description}" />`,
    `<meta property="og:site_name" content="${SITE_NAME}" />`,
    '<meta property="og:type" content="video.other" />',
    `<meta property="og:title" content="${title}" />`,
    `<meta property="og:description" content="${description}" />`,
    `<meta property="og:url" content="${canonicalUrl}" />`,
    `<meta property="og:image" content="${imageUrl}" />`,
    `<meta property="og:image:secure_url" content="${imageUrl}" />`,
    '<meta property="og:image:type" content="image/png" />',
    '<meta property="og:image:width" content="1200" />',
    '<meta property="og:image:height" content="630" />',
    `<meta property="og:image:alt" content="${title}" />`,
    '<meta name="twitter:card" content="summary_large_image" />',
    `<meta name="twitter:title" content="${title}" />`,
    `<meta name="twitter:description" content="${description}" />`,
    `<meta name="twitter:image" content="${imageUrl}" />`,
    `<meta name="twitter:image:alt" content="${title}" />`,
    `<link rel="canonical" href="${canonicalUrl}" />`,
  ].join('\n    ')
}

async function loadBaseHtml(context: PagesFunctionContextLike, origin: string): Promise<string> {
  if (!context.env.ASSETS) {
    return `<!doctype html><html lang="en"><head><!--OG_META_START--><!--OG_META_END--><title>${SITE_NAME}</title></head><body><div id="root"></div></body></html>`
  }

  const assetsRequest = new Request(`${origin}/index.html`, {
    method: 'GET',
    headers: {
      Accept: 'text/html',
    },
  })
  const response = await context.env.ASSETS.fetch(assetsRequest)
  if (!response.ok) {
    throw new Error(`Unable to load index.html (${response.status})`)
  }

  return response.text()
}

function injectOgMeta(html: string, metaBlock: string): string {
  if (OG_MARKER_PATTERN.test(html)) {
    return html.replace(
      OG_MARKER_PATTERN,
      `<!--OG_META_START-->\n    ${metaBlock}\n    <!--OG_META_END-->`,
    )
  }

  if (html.includes('</head>')) {
    return html.replace('</head>', `    ${metaBlock}\n  </head>`)
  }

  return `${html}\n${metaBlock}`
}

export const onRequestGet = async (context: PagesFunctionContextLike): Promise<Response> => {
  const url = new URL(context.request.url)

  const didParam = decodePathValue(context.params?.didParam)
  const rkeyParam = decodePathValue(context.params?.rkeyParam)

  if (!didParam || !rkeyParam || !didParam.startsWith('did:')) {
    return new Response('Invalid video URL', {
      status: 400,
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
      },
    })
  }

  const videoUri = `at://${didParam}/${STREAMPLACE_COLLECTION}/${rkeyParam}`
  const metadata = await fetchTalkMetadata(videoUri, didParam, rkeyParam)
  const title = metadata?.title ? `${metadata.title} | ${SITE_NAME}` : `${SITE_NAME} Video`
  const description = metadata?.description ?? DEFAULT_DESCRIPTION
  const imageUrl = `${url.origin}/og-default.png`

  const baseHtml = await loadBaseHtml(context, url.origin)
  const ogMetaBlock = buildOgMetaBlock({
    title,
    description,
    canonicalUrl: url.toString(),
    imageUrl,
  })
  const html = injectOgMeta(baseHtml, ogMetaBlock)

  return new Response(html, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'public, max-age=0, s-maxage=600',
    },
  })
}
