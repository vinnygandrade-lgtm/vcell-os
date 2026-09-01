import { useSyncExternalStore } from 'react'
import { getCloudUiStatus, subscribeCloudStatus } from '@/lib/cloud'

export function useCloudStatus() {
  return useSyncExternalStore(subscribeCloudStatus, getCloudUiStatus, getCloudUiStatus)
}
