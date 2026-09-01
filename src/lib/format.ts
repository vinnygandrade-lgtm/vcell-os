import { shop } from './shop'
import type { Order, OrderStatus } from './types'

export function onlyDigits(value: string) {
  return value.replace(/\D/g, '')
}

export function formatPhone(value: string) {
  const d = onlyDigits(value).slice(0, 11)
  if (d.length === 0) return ''
  if (d.length <= 2) return `(${d}`
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`
  if (d.length <= 10) {
    return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`
  }
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`
}

export function formatOs(number: number) {
  return `VC-${String(number).padStart(4, '0')}`
}

export function formatMoney(value: number | null) {
  if (value === null || Number.isNaN(value)) return ''
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export function parseMoney(value: string) {
  const cleaned = value.replace(/[^\d,.-]/g, '').replace(/\./g, '').replace(',', '.')
  if (!cleaned) return null
  const n = Number(cleaned)
  return Number.isFinite(n) ? n : null
}

export function formatDateTime(ms: number) {
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(ms)
}

export function formatDate(ms: number) {
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(ms)
}

export const OVERDUE_DAYS = 60

export function timeInShop(from: number, to = Date.now()) {
  const days = Math.max(0, Math.floor((to - from) / 86_400_000))
  if (days === 0) return 'hoje'
  if (days === 1) return '1 dia'
  if (days >= OVERDUE_DAYS) return `${days} dias`
  if (days < 30) return `${days} dias`
  const months = Math.floor(days / 30)
  if (months === 1) return '1 mês'
  return `${months} meses`
}

export function daysInShop(from: number, to = Date.now()) {
  return Math.max(0, Math.floor((to - from) / 86_400_000))
}

export function isOverdue(order: Order) {
  return order.status !== 'delivered' && daysInShop(order.receivedAt) >= OVERDUE_DAYS
}

export function deviceLabel(order: Pick<Order, 'brand' | 'model' | 'color'>) {
  return [order.brand, order.model, order.color].filter(Boolean).join(' · ')
}

export function fold(value: string) {
  return value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim()
}

export function matchesQuery(
  query: string,
  order: Order,
  customerName: string,
  customerPhone: string,
) {
  const q = fold(query)
  if (!q) return true
  const hay = fold(
    [
      formatOs(order.number),
      String(order.number),
      customerName,
      customerPhone,
      order.brand,
      order.model,
      order.color,
      order.imei,
      order.defect,
      order.notes,
      order.location ?? '',
    ].join(' '),
  )
  return q.split(/\s+/).every((part) => hay.includes(part) || customerPhone.includes(onlyDigits(part)))
}

export function whatsappLink(phone: string, text: string) {
  const d = onlyDigits(phone)
  const withCountry = d.startsWith('55') ? d : `55${d}`
  return `https://wa.me/${withCountry}?text=${encodeURIComponent(text)}`
}

export function readyMessage(customerName: string, order: Order) {
  const first = customerName.split(' ')[0] || 'cliente'
  return [
    `Olá ${first}, seu aparelho ${deviceLabel(order)} está PRONTO na ${shop.name}.`,
    `OS ${formatOs(order.number)}`,
    shop.address,
    shop.phoneDisplay,
  ].join('\n')
}

export function overdueMessage(customerName: string, order: Order) {
  const first = customerName.split(' ')[0] || 'cliente'
  const days = daysInShop(order.receivedAt)
  return [
    `Olá ${first}, seu aparelho ${deviceLabel(order)} está na ${shop.name} há ${days} dias.`,
    `OS ${formatOs(order.number)}.`,
    'Pode passar na loja para retirar ou falar o que deseja fazer com o aparelho.',
    shop.address,
    shop.phoneDisplay,
  ].join('\n')
}

export function receivedMessage(customerName: string, order: Order) {
  const first = customerName.split(' ')[0] || 'cliente'
  return [
    `Olá ${first}, recebemos seu ${deviceLabel(order)} na ${shop.name}.`,
    `OS ${formatOs(order.number)} — guarde este número.`,
    order.defect ? `Defeito: ${order.defect}` : '',
    shop.address,
    shop.phoneDisplay,
  ]
    .filter(Boolean)
    .join('\n')
}

export function isDueSoon(order: Order) {
  if (order.status === 'delivered' || isOverdue(order)) return false
  return daysInShop(order.receivedAt) >= 30
}

export function daysUntilOverdue(order: Order) {
  return Math.max(0, OVERDUE_DAYS - daysInShop(order.receivedAt))
}

export function orderSummary(order: Order, customerName: string) {
  return [
    formatOs(order.number),
    customerName,
    deviceLabel(order),
    order.location ? `Local: ${order.location}` : '',
    order.unlock ? `Senha: ${order.unlock}` : '',
    order.status === 'delivered' ? 'Entregue' : `Na loja há ${timeInShop(order.receivedAt)}`,
  ]
    .filter(Boolean)
    .join('\n')
}

export function urgency(order: Order): 'ok' | 'warn' | 'late' {
  if (order.status === 'delivered') return 'ok'
  const days = daysInShop(order.receivedAt)
  if (days >= OVERDUE_DAYS) return 'late'
  if (days >= 30) return 'warn'
  return 'ok'
}

export function statusTone(status: OrderStatus) {
  switch (status) {
    case 'received':
      return 'bg-navy-mid/40 text-blue-200 ring-blue-500/30'
    case 'repairing':
      return 'bg-amber-500/15 text-amber-200 ring-amber-400/30'
    case 'ready':
      return 'bg-emerald-500/15 text-emerald-200 ring-emerald-400/30'
    case 'delivered':
      return 'bg-white/8 text-mute ring-white/10'
  }
}
