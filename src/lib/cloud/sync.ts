import { db } from '../db'
import type { Customer, Order, Tombstone } from '../types'
import {
  downloadData,
  downloadPhoto,
  explainCloudError,
  listPhotoNames,
  pingCloud,
  removePhoto,
  uploadData,
  uploadPhoto,
} from './api'
import { isCloudConnected, loadCloudConfig, saveCloudConfig } from './config'

interface CloudPayload {
  version: 2
  exportedAt: number
  customers: Customer[]
  orders: Order[]
  photoMeta: Array<{
    id: string
    orderId: string
    createdAt: number
  }>
  deleted: Tombstone[]
  orderSeq: number
}

type Listener = () => void
const listeners = new Set<Listener>()

export type CloudUiStatus = {
  connected: boolean
  syncing: boolean
  lastSyncAt: number
  lastError: string
}

let snapshot: CloudUiStatus = {
  connected: false,
  syncing: false,
  lastSyncAt: 0,
  lastError: '',
}

let syncing = false
let running = false
let queued = false
let hooksRegistered = false
let applying = false
let initStarted = false
let timer = 0

function currentStatus(): CloudUiStatus {
  const cfg = loadCloudConfig()
  return {
    connected: cfg.connected,
    syncing,
    lastSyncAt: cfg.lastSyncAt,
    lastError: cfg.lastError,
  }
}

function sameStatus(a: CloudUiStatus, b: CloudUiStatus) {
  return (
    a.connected === b.connected &&
    a.syncing === b.syncing &&
    a.lastSyncAt === b.lastSyncAt &&
    a.lastError === b.lastError
  )
}

function emit() {
  const next = currentStatus()
  if (!sameStatus(snapshot, next)) snapshot = next
  for (const listener of listeners) listener()
}

export function getCloudUiStatus(): CloudUiStatus {
  const next = currentStatus()
  if (!sameStatus(snapshot, next)) snapshot = next
  return snapshot
}

export function subscribeCloudStatus(listener: Listener) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

function setError(message: string) {
  saveCloudConfig({ lastError: message })
  emit()
}

function mergeByUpdated<T extends { id: string; updatedAt: number }>(local: T[], remote: T[]) {
  const map = new Map<string, T>()
  for (const row of local) map.set(row.id, row)
  for (const row of remote) {
    const current = map.get(row.id)
    if (!current || row.updatedAt >= current.updatedAt) map.set(row.id, row)
  }
  return [...map.values()]
}

function mergeTombstones(local: Tombstone[], remote: Tombstone[]) {
  const map = new Map<string, Tombstone>()
  for (const row of [...local, ...remote]) {
    const current = map.get(row.id)
    if (!current || row.deletedAt > current.deletedAt) map.set(row.id, row)
  }
  return [...map.values()]
}

function alive<T extends { id: string; updatedAt?: number; createdAt?: number }>(
  rows: T[],
  tombstones: Map<string, Tombstone>,
) {
  return rows.filter((row) => {
    const stamp = tombstones.get(row.id)
    if (!stamp) return true
    const updated = row.updatedAt ?? row.createdAt ?? 0
    return updated > stamp.deletedAt
  })
}

function normalizeOrder(order: Order): Order {
  return {
    ...order,
    location: order.location ?? '',
    pickupWarnedAt: order.pickupWarnedAt ?? null,
    saleWarnedAt: order.saleWarnedAt ?? null,
  }
}

async function readRemote(): Promise<CloudPayload | null> {
  try {
    const blob = await downloadData()
    if (!blob) return null
    const text = (await blob.text()).trim()
    if (!text || text === '{}') return null
    const data = JSON.parse(text) as Partial<CloudPayload>
    if (!Array.isArray(data.orders) && !Array.isArray(data.customers)) return null
    return {
      version: 2,
      exportedAt: data.exportedAt ?? 0,
      customers: data.customers ?? [],
      orders: (data.orders ?? []).map(normalizeOrder),
      photoMeta: data.photoMeta ?? [],
      deleted: data.deleted ?? [],
      orderSeq: data.orderSeq ?? 0,
    }
  } catch {
    return null
  }
}

async function runSync() {
  const [customers, orders, photos, tombstones, seq] = await Promise.all([
    db.customers.toArray(),
    db.orders.toArray(),
    db.photos.toArray(),
    db.tombstones.toArray(),
    db.meta.get('orderSeq'),
  ])

  const remote = await readRemote()
  const mergedTombs = mergeTombstones(tombstones, remote?.deleted ?? [])
  const tombMap = new Map(mergedTombs.map((row) => [row.id, row]))
  const mergedCustomers = alive(mergeByUpdated(customers, remote?.customers ?? []), tombMap)
  const mergedOrders = alive(
    mergeByUpdated(orders.map(normalizeOrder), remote?.orders ?? []),
    tombMap,
  ).map(normalizeOrder)

  const remoteMeta = new Map((remote?.photoMeta ?? []).map((row) => [row.id, row]))
  const localMeta = new Map(
    photos.map((photo) => [photo.id, { id: photo.id, orderId: photo.orderId, createdAt: photo.createdAt }]),
  )
  const allPhotoIds = new Set([...remoteMeta.keys(), ...localMeta.keys()])
  const photoMeta: CloudPayload['photoMeta'] = []
  for (const id of allPhotoIds) {
    const stamp = tombMap.get(id)
    const meta = localMeta.get(id) ?? remoteMeta.get(id)
    if (!meta) continue
    if (stamp && (meta.createdAt ?? 0) <= stamp.deletedAt) continue
    photoMeta.push(meta)
  }

  const maxNumber = mergedOrders.reduce((n, order) => Math.max(n, order.number), 0)
  const orderSeq = Math.max(seq?.value ?? 0, remote?.orderSeq ?? 0, maxNumber)

  applying = true
  try {
    await db.transaction('rw', db.customers, db.orders, db.photos, db.meta, db.tombstones, async () => {
      await db.customers.clear()
      await db.orders.clear()
      await db.tombstones.clear()
      if (mergedCustomers.length) await db.customers.bulkPut(mergedCustomers)
      if (mergedOrders.length) await db.orders.bulkPut(mergedOrders)
      if (mergedTombs.length) await db.tombstones.bulkPut(mergedTombs)
      await db.meta.put({ key: 'orderSeq', value: orderSeq })
      const keep = new Set(photoMeta.map((row) => row.id))
      const currentPhotos = await db.photos.toArray()
      for (const photo of currentPhotos) {
        if (!keep.has(photo.id)) await db.photos.delete(photo.id)
      }
    })
  } finally {
    applying = false
  }

  const remoteNames = new Set(await listPhotoNames())

  for (const stamp of mergedTombs.filter((row) => row.kind === 'photo')) {
    if (remoteNames.has(`${stamp.id}.jpg`)) {
      await removePhoto(stamp.id)
      remoteNames.delete(`${stamp.id}.jpg`)
    }
  }

  for (const meta of photoMeta) {
    const local = await db.photos.get(meta.id)
    const hasRemote = remoteNames.has(`${meta.id}.jpg`)
    if (local?.blob && !hasRemote) {
      await uploadPhoto(meta.id, local.blob)
    } else if (!local && hasRemote) {
      const blob = await downloadPhoto(meta.id)
      if (!blob) continue
      applying = true
      try {
        await db.photos.put({
          id: meta.id,
          orderId: meta.orderId,
          blob,
          createdAt: meta.createdAt,
        })
      } finally {
        applying = false
      }
    }
  }

  const payload: CloudPayload = {
    version: 2,
    exportedAt: Date.now(),
    customers: mergedCustomers,
    orders: mergedOrders,
    photoMeta,
    deleted: mergedTombs,
    orderSeq,
  }
  await uploadData(JSON.stringify(payload))
  saveCloudConfig({ lastSyncAt: Date.now(), lastError: '' })
}

export async function syncNow() {
  if (!isCloudConnected()) return
  if (running) {
    queued = true
    return
  }
  running = true
  syncing = true
  emit()
  try {
    do {
      queued = false
      await runSync()
    } while (queued)
  } catch (err) {
    setError(explainCloudError(err))
  } finally {
    running = false
    syncing = false
    emit()
  }
}

export function scheduleSync() {
  if (applying || !isCloudConnected()) return
  window.clearTimeout(timer)
  timer = window.setTimeout(() => {
    void syncNow()
  }, 2500)
}

export async function runQuietly<T>(fn: () => Promise<T>): Promise<T> {
  applying = true
  try {
    return await fn()
  } finally {
    applying = false
  }
}

export async function connectCloud(url: string, anonKey: string) {
  const cleanUrl = url.trim().replace(/\/$/, '')
  const key = anonKey.trim()
  if (!cleanUrl || !key) throw new Error('Cole a URL e a chave anon do Supabase.')
  saveCloudConfig({ url: cleanUrl, anonKey: key, lastError: '' })
  await pingCloud()
  saveCloudConfig({ connected: true, lastError: '' })
  emit()
  await syncNow()
}

export function disconnectCloud() {
  saveCloudConfig({ connected: false, lastError: '' })
  emit()
}

export function registerCloudHooks() {
  if (hooksRegistered) return
  hooksRegistered = true
  const kick = () => scheduleSync()
  const tomb = (kind: Tombstone['kind']) => (primKey: string | number) => {
    if (applying) return
    return db.tombstones.put({ id: String(primKey), kind, deletedAt: Date.now() }).then(() => kick())
  }
  db.customers.hook('creating', kick)
  db.customers.hook('updating', kick)
  db.customers.hook('deleting', tomb('customer'))
  db.orders.hook('creating', kick)
  db.orders.hook('updating', kick)
  db.orders.hook('deleting', tomb('order'))
  db.photos.hook('creating', kick)
  db.photos.hook('updating', kick)
  db.photos.hook('deleting', tomb('photo'))
}

export function initCloud() {
  try {
    registerCloudHooks()
    if (initStarted) return
    initStarted = true
    if (isCloudConnected()) void syncNow()
    window.addEventListener('online', () => {
      if (isCloudConnected()) scheduleSync()
    })
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible' && isCloudConnected()) scheduleSync()
    })
  } catch (err) {
    console.error(err)
  }
}
