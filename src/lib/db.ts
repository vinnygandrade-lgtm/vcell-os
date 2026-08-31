import Dexie, { type EntityTable } from 'dexie'
import type { Customer, Meta, Order, Photo, ReceivePhotoDraft } from './types'

export const db = new Dexie('vcell-os') as Dexie & {
  customers: EntityTable<Customer, 'id'>
  orders: EntityTable<Order, 'id'>
  photos: EntityTable<Photo, 'id'>
  meta: EntityTable<Meta, 'key'>
  drafts: EntityTable<ReceivePhotoDraft, 'key'>
}

db.version(1).stores({
  customers: 'id, phone, name, createdAt',
  orders: 'id, number, customerId, status, receivedAt, createdAt, imei, model',
  photos: 'id, orderId, createdAt',
  meta: 'key',
})

db.version(2).stores({
  drafts: 'key',
})

db.version(3).stores({
  orders: 'id, number, customerId, status, receivedAt, createdAt, imei, model, location',
})

export function uid() {
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID()
    }
  } catch {
    // HTTP na rede da loja não é contexto seguro
  }
  const bytes = new Uint8Array(16)
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(bytes)
  } else {
    for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256)
  }
  bytes[6] = (bytes[6] & 0x0f) | 0x40
  bytes[8] = (bytes[8] & 0x3f) | 0x80
  const hex = [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

export function explainSaveError(err: unknown) {
  const name = err instanceof Error ? err.name : ''
  const message = err instanceof Error ? err.message : String(err ?? '')
  const text = `${name} ${message}`
  if (/QuotaExceeded/i.test(text) || /quota/i.test(text)) {
    return 'O celular ficou sem espaço para as fotos. Tente com menos fotos, ou salve a OS e tire as fotos depois.'
  }
  if (/randomUUID|secure context|SecureContext/i.test(text)) {
    return 'O Chrome bloqueou o salvamento neste endereço. Feche e abra o app de novo pelo mesmo link.'
  }
  if (/DataError|ConstraintError/i.test(text)) {
    return 'Algum dado não deu para gravar. Confira o nome, o modelo e tente de novo.'
  }
  if (/IndexedDB|DatabaseClosed|InvalidState/i.test(text)) {
    return 'O app não conseguiu gravar neste celular. Feche a aba, abra de novo e tente salvar outra vez.'
  }
  return 'Não deu para salvar. Confira o nome e o modelo do celular e tente de novo.'
}

export async function nextOrderNumber() {
  return db.transaction('rw', db.meta, async () => {
    const row = await db.meta.get('orderSeq')
    const n = (row?.value ?? 0) + 1
    await db.meta.put({ key: 'orderSeq', value: n })
    return n
  })
}
