export function toVideoPath(uri: string): string {
  return `/video/${encodeURIComponent(uri)}`
}

export function fromVideoParam(param: string): string | undefined {
  try {
    const decoded = decodeURIComponent(param)
    if (!decoded.startsWith('at://')) {
      return undefined
    }
    return decoded
  } catch {
    return undefined
  }
}
