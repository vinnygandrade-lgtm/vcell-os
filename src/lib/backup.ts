import { db, uid } from './db'
import { runQuietly, scheduleSync } from './drive'
import type { Customer, Order, Photo } from './types'

interface BackupFile {
  version: 1
  exportedAt: number
  customers: Customer[]
  orders: Order[]
  photos: Array<Omit<Photo, 'blob'> & { dataUrl: string }>
  orderSeq: number
}

function blobToDataUrl(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(blob)
  })
}

async function dataUrlToBlob(dataUrl: string) {
  const res = await fetch(dataUrl)
  return res.blob()
}

export async function exportBackup() {
  const [customers, orders, photos, seq] = await Promise.all([
    db.customers.toArray(),
    db.orders.toArray(),
    db.photos.toArray(),
    db.meta.get('orderSeq'),
  ])
  const payload: BackupFile = {
    version: 1,
    exportedAt: Date.now(),
    customers,
    orders,
    photos: await Promise.all(
      photos.map(async (photo) => ({
        id: photo.id,
        orderId: photo.orderId,
        createdAt: photo.createdAt,
        dataUrl: await blobToDataUrl(photo.blob),
      })),
    ),
    orderSeq: seq?.value ?? 0,
  }
  const blob = new Blob([JSON.stringify(payload)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const stamp = new Date().toISOString().slice(0, 10)
  const a = document.createElement('a')
  a.href = url
  a.download = `vcell-backup-${stamp}.json`
  a.click()
  URL.revokeObjectURL(url)
}

export async function importBackup(file: File) {
  const text = await file.text()
  const data = JSON.parse(text) as BackupFile
  if (data.version !== 1 || !Array.isArray(data.orders)) {
    throw new Error('Arquivo de backup inválido')
  }
  await runQuietly(async () => {
    await db.transaction('rw', db.customers, db.orders, db.photos, db.meta, async () => {
      await db.customers.clear()
      await db.orders.clear()
      await db.photos.clear()
      await db.customers.bulkPut(data.customers ?? [])
      await db.orders.bulkPut(data.orders ?? [])
      const photos: Photo[] = await Promise.all(
        (data.photos ?? []).map(async (photo) => ({
          id: photo.id || uid(),
          orderId: photo.orderId,
          createdAt: photo.createdAt,
          blob: await dataUrlToBlob(photo.dataUrl),
        })),
      )
      if (photos.length) await db.photos.bulkPut(photos)
      await db.meta.put({ key: 'orderSeq', value: data.orderSeq ?? data.orders.length })
    })
  })
  scheduleSync()
}
