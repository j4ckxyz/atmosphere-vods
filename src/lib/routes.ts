export function toVideoPath(uri: string): string {
  return `/video/${encodeURIComponent(uri)}`
}

export function fromVideoParam(param: string): string {
  return decodeURIComponent(param)
}
