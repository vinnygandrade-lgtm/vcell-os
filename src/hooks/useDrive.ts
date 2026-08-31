import { useSyncExternalStore } from 'react'
import { getDriveUiStatus, subscribeDriveStatus } from '@/lib/drive'

export function useDriveStatus() {
  return useSyncExternalStore(subscribeDriveStatus, getDriveUiStatus, getDriveUiStatus)
}
