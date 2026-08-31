import {
  daysInShop,
  deviceLabel,
  formatMoney,
  formatOs,
} from './format'
import { shop } from './shop'
import type { Order } from './types'

export type MessageKind = 'pickup' | 'sale' | 'ready' | 'received'

const STORAGE_KEY = 'vcell-wa-templates'

export const DEFAULT_TEMPLATES: Record<MessageKind, string> = {
  pickup: `Olá {nome}, seu {aparelho} está na {loja} há {dias} dias.
OS {os}.
Pode passar na loja para retirar ou falar o que deseja fazer com o aparelho.
{endereco}
{telefone}`,
  sale: `Olá {nome}, seu {aparelho} está na {loja} há {dias} dias sem retirada.
OS {os}.

Como passou de 60 dias, avisamos que o aparelho poderá ser vendido para cobrir o serviço e a guarda.

Se quiser retirar, responda esta mensagem ou passe na loja.
{endereco}
{telefone}`,
  ready: `Olá {nome}, seu aparelho {aparelho} está PRONTO na {loja}.
OS {os}
{endereco}
{telefone}`,
  received: `Olá {nome}, recebemos seu {aparelho} na {loja}.
OS {os} — guarde este número.
{endereco}
{telefone}`,
}

export const MESSAGE_LABEL: Record<MessageKind, string> = {
  pickup: 'Avisar retirada',
  sale: 'Aviso de venda',
  ready: 'Aparelho pronto',
  received: 'Confirmamos o recebimento',
}

function loadAll() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return {} as Partial<Record<MessageKind, string>>
    return JSON.parse(raw) as Partial<Record<MessageKind, string>>
  } catch {
    return {}
  }
}

export function getTemplate(kind: MessageKind) {
  const saved = loadAll()[kind]?.trim()
  return saved || DEFAULT_TEMPLATES[kind]
}

export function saveTemplate(kind: MessageKind, text: string) {
  const all = loadAll()
  all[kind] = text
  localStorage.setItem(STORAGE_KEY, JSON.stringify(all))
}

export function resetTemplate(kind: MessageKind) {
  const all = loadAll()
  delete all[kind]
  localStorage.setItem(STORAGE_KEY, JSON.stringify(all))
}

export function messageVars(customerName: string, order: Order) {
  const first = customerName.split(' ')[0] || 'cliente'
  return {
    nome: first,
    aparelho: deviceLabel(order) || 'celular',
    os: formatOs(order.number),
    dias: String(daysInShop(order.receivedAt)),
    loja: shop.name,
    endereco: shop.address,
    telefone: shop.phoneDisplay,
    valor: formatMoney(order.price) || 'a combinar',
    local: order.location?.trim() || 'na loja',
  }
}

export function renderTemplate(template: string, customerName: string, order: Order) {
  const vars = messageVars(customerName, order)
  return template.replace(/\{(\w+)\}/g, (_, key: string) => vars[key as keyof typeof vars] ?? '')
}

export function buildMessage(kind: MessageKind, customerName: string, order: Order) {
  return renderTemplate(getTemplate(kind), customerName, order)
}
