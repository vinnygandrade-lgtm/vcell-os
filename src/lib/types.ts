export type OrderStatus = 'received' | 'repairing' | 'ready' | 'delivered'

export interface Customer {
  id: string
  name: string
  phone: string
  createdAt: number
  updatedAt: number
}

export interface Order {
  id: string
  number: number
  customerId: string
  brand: string
  model: string
  color: string
  imei: string
  unlock: string
  defect: string
  notes: string
  price: number | null
  location: string
  pickupWarnedAt: number | null
  saleWarnedAt: number | null
  status: OrderStatus
  receivedAt: number
  readyAt: number | null
  deliveredAt: number | null
  createdAt: number
  updatedAt: number
}

export interface Photo {
  id: string
  orderId: string
  blob: Blob
  createdAt: number
  driveFileId?: string
}

export type TombstoneKind = 'customer' | 'order' | 'photo'

export interface Tombstone {
  id: string
  kind: TombstoneKind
  deletedAt: number
}

export interface Meta {
  key: string
  value: number
}

export interface ReceivePhotoDraft {
  key: 'receive'
  photos: Blob[]
  updatedAt: number
}

export const STATUS_LABEL: Record<OrderStatus, string> = {
  received: 'Na loja',
  repairing: 'Em conserto',
  ready: 'Pronto',
  delivered: 'Entregue',
}

export const STATUS_ORDER: OrderStatus[] = [
  'received',
  'repairing',
  'ready',
  'delivered',
]
