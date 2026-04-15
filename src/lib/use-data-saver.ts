import { useCallback, useEffect, useState } from 'react'

import {
  isDataSaverEnabled,
  isDataSaverSupported,
  setDataSaverEnabled,
  subscribeToDataSaver,
} from '@/lib/data-saver'

export function useDataSaver() {
  const [enabled, setEnabled] = useState<boolean>(() => isDataSaverEnabled())
  const [supported] = useState<boolean>(() => isDataSaverSupported())

  useEffect(() => {
    return subscribeToDataSaver((nextEnabled) => {
      setEnabled(nextEnabled)
    })
  }, [])

  const updateEnabled = useCallback((nextEnabled: boolean) => {
    setDataSaverEnabled(nextEnabled)
    setEnabled(nextEnabled)
  }, [])

  return {
    enabled,
    supported,
    setEnabled: updateEnabled,
  }
}
