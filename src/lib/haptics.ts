export function vibrate(pattern: number | number[]) {
  if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
    navigator.vibrate(pattern)
  }
}

export function cardTapHaptic() {
  vibrate(10)
}

export function playHaptic() {
  vibrate([10, 20, 20])
}
