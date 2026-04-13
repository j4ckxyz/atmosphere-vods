import { useEffect } from 'react'

interface UseKeyboardOptions {
  enabled?: boolean
  allowInInputs?: boolean
}

function isEditableElement(element: Element | null): boolean {
  if (!(element instanceof HTMLElement)) {
    return false
  }

  const tag = element.tagName.toLowerCase()
  if (tag === 'input' || tag === 'textarea' || tag === 'select') {
    return true
  }

  return element.isContentEditable
}

export function useKeyboard(
  onKeyDown: (event: KeyboardEvent) => void,
  options?: UseKeyboardOptions,
) {
  const enabled = options?.enabled ?? true
  const allowInInputs = options?.allowInInputs ?? false

  useEffect(() => {
    if (!enabled) {
      return
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (!allowInInputs && isEditableElement(document.activeElement)) {
        return
      }

      onKeyDown(event)
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [onKeyDown, enabled, allowInInputs])
}
