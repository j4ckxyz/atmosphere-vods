function toBase64Url(value: string): string {
  const bytes = new TextEncoder().encode(value)
  let binary = ''

  for (const byte of bytes) {
    binary += String.fromCharCode(byte)
  }

  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

function fromBase64Url(value: string): string {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (value.length % 4)) % 4)
  const binary = atob(padded)
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0))
  return new TextDecoder().decode(bytes)
}

export function toVideoPath(uri: string): string {
  return `/video/${toBase64Url(uri)}`
}

export function fromVideoParam(param: string): string | undefined {
  try {
    const maybeLegacy = decodeURIComponent(param)
    if (maybeLegacy.startsWith('at://')) {
      return maybeLegacy
    }

    const decoded = fromBase64Url(param)
    return decoded.startsWith('at://') ? decoded : undefined
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
