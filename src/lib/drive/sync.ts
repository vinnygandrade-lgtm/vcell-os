import { db } from '../db'
import type { Customer, Order, Tombstone } from '../types'
import {
  downloadFile,
  ensureDriveFolders,
  explainDriveError,
  firstConnect,
  listPhotoFiles,
  multipartUpload,
  trashFile,
  uploadMedia,
} from './api'
import { clearToken, fetchUserEmail, getAccessToken, loadGis } from './auth'
import { isDriveConnected, loadDriveConfig, saveDriveConfig } from './config'

export interface DrivePayload {
  version: 2
  exportedAt: number
  customers: Customer[]
  orders: Order[]
  photoMeta: Array<{
    id: string
    orderId: string
    createdAt: number
    fileId?: string
  }>
  deleted: Tombstone[]
  orderSeq: number
}

type Listener = () => void

const listeners = new Set<Listener>()

export type DriveUiStatus = {
  connected: boolean
  syncing: boolean
  lastSyncAt: number
  lastError: string
  email: string
}

let snapshot: DriveUiStatus = {
  connected: false,
  syncing: false,
  lastSyncAt: 0,
  lastError: '',
  email: '',
}

function readStatus(): DriveUiStatus {
  const cfg = loadDriveConfig()
  return {
    connected: cfg.connected,
    syncing,
    lastSyncAt: cfg.lastSyncAt,
    lastError: cfg.lastError,
    email: cfg.email,
  }
}

function sameStatus(a: DriveUiStatus, b: DriveUiStatus) {
  return (
    a.connected === b.connected &&
    a.syncing === b.syncing &&
    a.lastSyncAt === b.lastSyncAt &&
    a.lastError === b.lastError &&
    a.email === b.email
  )
}

function emit() {
  const next = readStatus()
  if (!sameStatus(snapshot, next)) snapshot = next
  for (const listener of listeners) listener()
}

export function getDriveUiStatus(): DriveUiStatus {
  const next = readStatus()
  if (!sameStatus(snapshot, next)) snapshot = next
  return snapshot
}

let syncing = false
let running = false
let queued = false
let hooksRegistered = false
let applying = false
let initStarted = false
let timer = 0

export function subscribeDriveStatus(listener: Listener) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

function setError(message: string) {
  saveDriveConfig({ lastError: message })
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

async function readRemotePayload(dataFileId: string): Promise<DrivePayload | null> {
  try {
    const blob = await downloadFile(dataFileId)
    const text = (await blob.text()).trim()
    if (!text || text === '{}') return null
    const data = JSON.parse(text) as Partial<DrivePayload>
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
  const folders = await ensureDriveFolders(false)
  const [customers, orders, photos, tombstones, seq] = await Promise.all([
    db.customers.toArray(),
    db.orders.toArray(),
    db.photos.toArray(),
    db.tombstones.toArray(),
    db.meta.get('orderSeq'),
  ])

  const remote = await readRemotePayload(folders.dataFileId)
  const mergedTombs = mergeTombstones(tombstones, remote?.deleted ?? [])
  const tombMap = new Map(mergedTombs.map((row) => [row.id, row]))

  const mergedCustomers = alive(mergeByUpdated(customers, remote?.customers ?? []), tombMap)
  const mergedOrders = alive(
    mergeByUpdated(orders.map(normalizeOrder), remote?.orders ?? []),
    tombMap,
  ).map(normalizeOrder)

  const remoteMeta = new Map((remote?.photoMeta ?? []).map((row) => [row.id, row]))
  const localMeta = new Map(
    photos.map((photo) => [
      photo.id,
      {
        id: photo.id,
        orderId: photo.orderId,
        createdAt: photo.createdAt,
        fileId: photo.driveFileId,
      },
    ]),
  )
  const allPhotoIds = new Set([...remoteMeta.keys(), ...localMeta.keys()])
  const photoMeta: DrivePayload['photoMeta'] = []
  for (const id of allPhotoIds) {
    const stamp = tombMap.get(id)
    const meta = localMeta.get(id) ?? remoteMeta.get(id)
    if (!meta) continue
    if (stamp && (meta.createdAt ?? 0) <= stamp.deletedAt) continue
    photoMeta.push({
      ...meta,
      fileId: localMeta.get(id)?.fileId || remoteMeta.get(id)?.fileId,
    })
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

  const drivePhotos = await listPhotoFiles(folders.photosFolderId)
  const byName = new Map(drivePhotos.map((file) => [file.name, file]))
  const byId = new Map(drivePhotos.map((file) => [file.id, file]))

  for (const stamp of mergedTombs.filter((row) => row.kind === 'photo')) {
    const named = byName.get(`${stamp.id}.jpg`)
    const meta = photoMeta.find((row) => row.id === stamp.id)
    const fileId = named?.id || meta?.fileId
    if (fileId && byId.has(fileId)) {
      await trashFile(fileId)
    }
  }

  const afterTrash = await listPhotoFiles(folders.photosFolderId)
  const liveByName = new Map(afterTrash.map((file) => [file.name, file]))

  for (const meta of photoMeta) {
    const local = await db.photos.get(meta.id)
    const remoteFile = liveByName.get(`${meta.id}.jpg`) || (meta.fileId ? afterTrash.find((f) => f.id === meta.fileId) : undefined)

    if (local?.blob && !remoteFile) {
      const uploaded = await multipartUpload(
        {
          name: `${meta.id}.jpg`,
          parents: [folders.photosFolderId],
          appProperties: { vcellPhotoId: meta.id, vcellOrderId: meta.orderId },
        },
        local.blob,
      )
      meta.fileId = uploaded.id
      applying = true
      try {
        await db.photos.update(meta.id, { driveFileId: uploaded.id })
      } finally {
        applying = false
      }
    } else if (local?.blob && remoteFile) {
      meta.fileId = remoteFile.id
      if (local.driveFileId !== remoteFile.id) {
        applying = true
        try {
          await db.photos.update(meta.id, { driveFileId: remoteFile.id })
        } finally {
          applying = false
        }
      }
    } else if (!local && remoteFile) {
      const blob = await downloadFile(remoteFile.id)
      applying = true
      try {
        await db.photos.put({
          id: meta.id,
          orderId: meta.orderId,
          blob,
          createdAt: meta.createdAt,
          driveFileId: remoteFile.id,
        })
      } finally {
        applying = false
      }
      meta.fileId = remoteFile.id
    }
  }

  const payload: DrivePayload = {
    version: 2,
    exportedAt: Date.now(),
    customers: mergedCustomers,
    orders: mergedOrders,
    photoMeta,
    deleted: mergedTombs,
    orderSeq,
  }
  await uploadMedia(folders.dataFileId, JSON.stringify(payload), 'application/json')
  saveDriveConfig({ lastSyncAt: Date.now(), lastError: '' })
}

export async function syncNow() {
  if (!isDriveConnected()) return
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
    setError(explainDriveError(err))
  } finally {
    running = false
    syncing = false
    emit()
  }
}

export function scheduleSync() {
  if (applying || !isDriveConnected()) return
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

export async function connectDrive(clientId: string) {
  const id = clientId.trim()
  if (!id) throw new Error('Cole o ID do cliente Google em Ajustes.')
  saveDriveConfig({ clientId: id, lastError: '' })
  await loadGis()
  const token = await getAccessToken(true)
  const email = await fetchUserEmail(token)
  await firstConnect(true)
  saveDriveConfig({ connected: true, email, lastError: '' })
  emit()
  await syncNow()
}

export async function disconnectDrive() {
  clearToken()
  saveDriveConfig({ connected: false, lastError: '' })
  emit()
}

export function initDrive() {
  try {
    registerDriveHooks()
    if (initStarted) return
    initStarted = true
    if (isDriveConnected()) void syncNow()
    window.addEventListener('online', () => {
      if (isDriveConnected()) scheduleSync()
    })
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible' && isDriveConnected()) scheduleSync()
    })
  } catch (err) {
    console.error(err)
  }
}

export function registerDriveHooks() {
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
