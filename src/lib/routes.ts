const VIDEO_URI_PATTERN = /^at:\/\/(did:[^/]+)\/place\.stream\.video\/([^/]+)$/

export function toVideoPath(uri: string): string {
  const parsed = parseVideoUri(uri)
  if (!parsed) {
    return '/'
  }
  return `/video/${parsed.did}/${parsed.rkey}`
}

function parseVideoUri(uri: string): { did: string; rkey: string } | null {
  const match = uri.match(VIDEO_URI_PATTERN)
  if (!match) {
    return null
  }

  return {
    did: match[1],
    rkey: match[2],
  }
}

export function toVideoUriFromParams(didParam: string, rkeyParam: string): string | undefined {
  try {
    const did = decodeURIComponent(didParam).trim()
    const rkey = decodeURIComponent(rkeyParam).trim()
    if (!did.startsWith('did:') || !rkey) {
      return undefined
    }
    return `at://${did}/place.stream.video/${rkey}`
  } catch {
    return undefined
  }
}

export function toTagPath(tag: string): string {
  return `/tag/${encodeURIComponent(tag)}`
}

export function fromTagParam(param: string): string | undefined {
  try {
    const decoded = decodeURIComponent(param).trim()
    return decoded ? decoded : undefined
  } catch {
    return undefined
  }
}
