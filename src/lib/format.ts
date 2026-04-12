export function formatDuration(durationNs: number): string {
  const totalSeconds = Math.max(0, Math.floor(durationNs / 1_000_000_000))
  const seconds = totalSeconds % 60
  const totalMinutes = Math.floor(totalSeconds / 60)

  if (totalMinutes < 60) {
    return `${String(totalMinutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
  }

  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

export function formatDate(iso: string): string {
  const date = new Date(iso)
  return new Intl.DateTimeFormat(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(date)
}

export function truncateDid(did: string): string {
  if (did.length <= 22) {
    return did
  }

  return `${did.slice(0, 14)}...${did.slice(-6)}`
}
