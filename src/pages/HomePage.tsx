import { Link } from 'react-router-dom'
import { AlertTriangle, Clock, Search, Settings, Smartphone, Users } from 'lucide-react'
import { BrandMark } from '@/components/Shell'
import { InstallBanner } from '@/components/InstallBanner'
import { OrderCard } from '@/components/OrderCard'
import { useCustomerMap, useFirstPhotos, useOrders } from '@/hooks/useStore'
import { isDueSoon, isOverdue, matchesQuery, OVERDUE_DAYS } from '@/lib/format'
import { useMemo, useState } from 'react'
import type { Order } from '@/lib/types'

type Filter = 'shop' | 'ready' | 'soon' | 'overdue' | 'delivered' | 'all'

const FILTERS: { id: Filter; label: string }[] = [
  { id: 'shop', label: 'Na loja' },
  { id: 'ready', label: 'Prontos' },
  { id: 'soon', label: 'Quase 60' },
  { id: 'overdue', label: '+60 dias' },
  { id: 'delivered', label: 'Entregues' },
  { id: 'all', label: 'Todos' },
]

function matchesFilter(order: Order, filter: Filter) {
  if (filter === 'all') return true
  if (filter === 'overdue') return isOverdue(order)
  if (filter === 'soon') return isDueSoon(order)
  if (filter === 'shop') return order.status === 'received' || order.status === 'repairing'
  if (filter === 'ready') return order.status === 'ready'
  return order.status === 'delivered'
}

function sortOrders(a: Order, b: Order) {
  const aLate = isOverdue(a)
  const bLate = isOverdue(b)
  if (aLate && !bLate) return -1
  if (bLate && !aLate) return 1
  if (aLate && bLate) return a.receivedAt - b.receivedAt
  const aSoon = isDueSoon(a)
  const bSoon = isDueSoon(b)
  if (aSoon && !bSoon) return -1
  if (bSoon && !aSoon) return 1
  if (aSoon && bSoon) return a.receivedAt - b.receivedAt
  return b.receivedAt - a.receivedAt
}

export function HomePage() {
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<Filter>('shop')
  const orders = useOrders()
  const customers = useCustomerMap()
  const visible = useMemo(() => {
    return orders
      .filter((order) => {
        if (!matchesFilter(order, query.trim() ? 'all' : filter)) return false
        const customer = customers[order.customerId]
        return matchesQuery(query, order, customer?.name ?? '', customer?.phone ?? '')
      })
      .sort(sortOrders)
  }, [orders, customers, filter, query])
  const photos = useFirstPhotos(visible.map((order) => order.id))
  const inShop = orders.filter((o) => o.status === 'received' || o.status === 'repairing').length
  const ready = orders.filter((o) => o.status === 'ready').length
  const overdue = orders.filter(isOverdue)
  const soon = orders.filter(isDueSoon)

  return (
    <div className="flex min-h-dvh flex-col pb-[calc(5.5rem+env(safe-area-inset-bottom))]">
      <header className="relative z-30 px-4 pb-3 pt-[max(1rem,env(safe-area-inset-top))]">
        <div className="flex items-center justify-between">
          <BrandMark />
          <div className="flex gap-1">
            <Link
              to="/clientes"
              className="flex h-10 w-10 items-center justify-center rounded-full bg-raised text-paper ring-1 ring-line"
              aria-label="Clientes"
            >
              <Users size={18} />
            </Link>
            <Link
              to="/ajustes"
              className="flex h-10 w-10 items-center justify-center rounded-full bg-raised text-paper ring-1 ring-line"
              aria-label="Ajustes"
            >
              <Settings size={18} />
            </Link>
          </div>
        </div>
        <div className="relative mt-4">
          <Search size={18} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-mute" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Nome, WhatsApp, IMEI, OS ou local"
            className="w-full rounded-2xl bg-raised py-3.5 pl-11 pr-4 text-[16px] outline-none ring-1 ring-line focus:ring-2 focus:ring-red/70"
            enterKeyHint="search"
          />
        </div>
        <div className="no-scrollbar mt-3 flex gap-2 overflow-x-auto">
          {FILTERS.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setFilter(item.id)}
              className={`shrink-0 rounded-full px-3.5 py-1.5 text-sm font-medium ${
                filter === item.id
                  ? 'bg-red text-white'
                  : item.id === 'overdue' && overdue.length > 0
                    ? 'bg-red/15 text-red-hot ring-1 ring-red/40'
                    : item.id === 'soon' && soon.length > 0
                      ? 'bg-amber-500/15 text-amber-200 ring-1 ring-amber-400/40'
                      : 'bg-raised text-mute ring-1 ring-line'
              }`}
            >
              {item.label}
              {item.id === 'shop' && inShop > 0 ? ` · ${inShop}` : ''}
              {item.id === 'ready' && ready > 0 ? ` · ${ready}` : ''}
              {item.id === 'soon' && soon.length > 0 ? ` · ${soon.length}` : ''}
              {item.id === 'overdue' && overdue.length > 0 ? ` · ${overdue.length}` : ''}
            </button>
          ))}
        </div>
      </header>

      <main className="flex flex-1 flex-col gap-3 px-4">
        <InstallBanner />
        {overdue.length > 0 && filter !== 'overdue' && !query.trim() && (
          <button
            type="button"
            onClick={() => setFilter('overdue')}
            className="flex items-start gap-3 rounded-3xl bg-red px-4 py-3.5 text-left text-white shadow-[0_12px_28px_rgba(225,6,19,0.35)]"
          >
            <AlertTriangle size={20} className="mt-0.5 shrink-0" />
            <span>
              <span className="block font-semibold">
                {overdue.length === 1
                  ? `1 celular passou de ${OVERDUE_DAYS} dias`
                  : `${overdue.length} celulares passaram de ${OVERDUE_DAYS} dias`}
              </span>
              <span className="mt-0.5 block text-sm text-white/80">
                Toque para ver, avisar a retirada ou a venda
              </span>
            </span>
          </button>
        )}
        {soon.length > 0 && filter !== 'soon' && filter !== 'overdue' && !query.trim() && (
          <button
            type="button"
            onClick={() => setFilter('soon')}
            className="flex items-start gap-3 rounded-3xl bg-amber-500/15 px-4 py-3.5 text-left ring-1 ring-amber-400/40"
          >
            <Clock size={20} className="mt-0.5 shrink-0 text-amber-200" />
            <span>
              <span className="block font-semibold text-amber-100">
                {soon.length === 1
                  ? '1 celular está perto dos 60 dias'
                  : `${soon.length} celulares estão perto dos 60 dias`}
              </span>
              <span className="mt-0.5 block text-sm text-amber-200/80">
                Avisa agora, antes de virar briga
              </span>
            </span>
          </button>
        )}
        {visible.length === 0 ? (
          <EmptyState
            hasQuery={Boolean(query.trim())}
            inShop={inShop}
            overdue={filter === 'overdue'}
            soon={filter === 'soon'}
          />
        ) : (
          visible.map((order) => (
            <OrderCard
              key={order.id}
              order={order}
              customer={customers[order.customerId]}
              photo={photos[order.id]}
            />
          ))
        )}
      </main>

      <div className="fixed inset-x-0 bottom-0 z-40 mx-auto w-full max-w-[430px] bg-gradient-to-t from-ink via-ink/95 to-transparent px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-6">
        <Link
          to="/nova"
          className="flex h-14 items-center justify-center rounded-2xl bg-red text-base font-semibold text-white shadow-[0_12px_30px_rgba(225,6,19,0.4)] active:scale-[0.99]"
        >
          Receber aparelho
        </Link>
      </div>
    </div>
  )
}

function EmptyState({
  hasQuery,
  inShop,
  overdue,
  soon,
}: {
  hasQuery: boolean
  inShop: number
  overdue: boolean
  soon: boolean
}) {
  return (
    <div className="mt-8 rounded-3xl bg-panel px-6 py-10 text-center ring-1 ring-line">
      <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-raised text-red">
        <Smartphone size={28} />
      </div>
      <p className="font-display text-2xl tracking-wide">
        {hasQuery
          ? 'Nada encontrado'
          : overdue
            ? 'Nenhum celular com mais de 60 dias'
            : soon
              ? 'Nenhum celular perto dos 60 dias'
              : inShop === 0
                ? 'Nenhum celular na loja'
                : 'Nada neste filtro'}
      </p>
      <p className="mt-2 text-sm text-mute">
        {hasQuery
          ? 'Tente nome, telefone, modelo, local ou número da OS.'
          : overdue
            ? 'Quando um aparelho passar de 60 dias, o alerta aparece aqui.'
            : soon
              ? 'Dos 30 aos 59 dias na loja, o aviso aparece aqui para ligar antes.'
              : 'Toque em Receber aparelho quando o cliente deixar o celular.'}
      </p>
    </div>
  )
}
