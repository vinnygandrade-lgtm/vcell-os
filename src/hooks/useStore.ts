import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useMemo, useState } from 'react'
import { db } from '@/lib/db'
import type { Photo } from '@/lib/types'

export function useCustomers() {
  return useLiveQuery(() => db.customers.orderBy('name').toArray()) ?? []
}

export function useOrders() {
  return useLiveQuery(() => db.orders.orderBy('receivedAt').reverse().toArray()) ?? []
}

export function useOrder(id: string | undefined) {
  return useLiveQuery(() => (id ? db.orders.get(id) : undefined), [id])
}

export function useCustomer(id: string | undefined) {
  return useLiveQuery(() => (id ? db.customers.get(id) : undefined), [id])
}

export function useCustomerMap() {
  const customers = useCustomers()
  return useMemo(
    () => Object.fromEntries(customers.map((customer) => [customer.id, customer])),
    [customers],
  )
}

export function usePhotos(orderId: string | undefined) {
  return useLiveQuery(
    () => (orderId ? db.photos.where('orderId').equals(orderId).sortBy('createdAt') : []),
    [orderId],
  ) ?? []
}

export function useFirstPhotos(orderIds: string[]) {
  const key = orderIds.join('|')
  return (
    useLiveQuery(async () => {
      if (!orderIds.length) return {} as Record<string, Photo>
      const photos = await db.photos.where('orderId').anyOf(orderIds).toArray()
      const first: Record<string, Photo> = {}
      for (const photo of photos.sort((a, b) => a.createdAt - b.createdAt)) {
        if (!first[photo.orderId]) first[photo.orderId] = photo
      }
      return first
    }, [key]) ?? {}
  )
}

export function useObjectUrl(blob: Blob | undefined) {
  const [url, setUrl] = useState<string>()
  useEffect(() => {
    if (!blob) {
      setUrl(undefined)
      return
    }
    const next = URL.createObjectURL(blob)
    setUrl(next)
    return () => URL.revokeObjectURL(next)
  }, [blob])
  return url
}
