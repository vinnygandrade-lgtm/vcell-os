import { db } from './db'

export const RECEIVE_DRAFT_KEY = 'vcell-receive-draft'

export interface ReceiveDraftText {
  phone: string
  name: string
  customerId?: string
  brand: string
  model: string
  color: string
  defect: string
  imei: string
  unlock: string
  notes: string
  price: string
  more: boolean
  location: string
}

export function emptyDraft(): ReceiveDraftText {
  return {
    phone: '',
    name: '',
    brand: '',
    model: '',
    color: '',
    defect: '',
    imei: '',
    unlock: '',
    notes: '',
    price: '',
    more: false,
    location: '',
  }
}

export function loadDraftText(): ReceiveDraftText | null {
  try {
    const raw = localStorage.getItem(RECEIVE_DRAFT_KEY)
    if (!raw) return null
    return { ...emptyDraft(), ...JSON.parse(raw) }
  } catch {
    return null
  }
}

export function saveDraftText(draft: ReceiveDraftText) {
  try {
    localStorage.setItem(RECEIVE_DRAFT_KEY, JSON.stringify(draft))
  } catch {
    // armazenamento cheio ou bloqueado
  }
}

export function clearDraftText() {
  try {
    localStorage.removeItem(RECEIVE_DRAFT_KEY)
  } catch {
    // ignore
  }
}

export async function saveDraftPhotos(photos: Blob[]) {
  await db.drafts.put({ key: 'receive', photos, updatedAt: Date.now() })
}

export async function loadDraftPhotos() {
  const row = await db.drafts.get('receive')
  return row?.photos ?? []
}

export async function clearDraftPhotos() {
  await db.drafts.delete('receive')
}

export async function clearReceiveDraft() {
  clearDraftText()
  await clearDraftPhotos()
}
