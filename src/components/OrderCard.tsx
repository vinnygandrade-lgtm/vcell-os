import { Link } from 'react-router-dom'
import { Camera } from 'lucide-react'
import { StatusBadge } from '@/components/Ui'
import { useObjectUrl } from '@/hooks/useStore'
import {
  daysInShop,
  deviceLabel,
  formatOs,
  isOverdue,
  OVERDUE_DAYS,
  timeInShop,
  urgency,
} from '@/lib/format'
import type { Customer, Order, Photo } from '@/lib/types'

export function OrderCard({
  order,
  customer,
  photo,
}: {
  order: Order
  customer?: Customer
  photo?: Photo
}) {
  const url = useObjectUrl(photo?.blob)
  const days = daysInShop(order.receivedAt, order.deliveredAt ?? Date.now())
  const overdue = isOverdue(order)
  const tone = urgency(order)
  const waitColor =
    tone === 'late' ? 'text-red-hot' : tone === 'warn' ? 'text-amber-300' : 'text-mute'

  return (
    <Link
      to={`/os/${order.id}`}
      className={`flex gap-3 rounded-3xl bg-panel p-3 ring-1 transition active:scale-[0.99] ${
        overdue ? 'ring-red/80 shadow-[0_0_24px_rgba(225,6,19,0.18)]' : 'ring-line'
      }`}
    >
      <div className="relative h-[4.5rem] w-[4.5rem] shrink-0 overflow-hidden rounded-2xl bg-raised">
        {url ? (
          <img src={url} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-mute">
            <Camera size={22} />
          </div>
        )}
        {overdue && (
          <span className="absolute inset-x-0 bottom-0 bg-red py-0.5 text-center text-[9px] font-bold uppercase tracking-wide text-white">
            {OVERDUE_DAYS}+ dias
          </span>
        )}
      </div>
      <div className="min-w-0 flex-1 py-0.5">
        <div className="flex items-start justify-between gap-2">
          <p className="font-display text-lg leading-none tracking-wide text-red">
            {formatOs(order.number)}
          </p>
          <StatusBadge status={order.status} />
        </div>
        <p className="mt-1.5 truncate font-semibold">{customer?.name ?? 'Cliente'}</p>
        <p className="truncate text-sm text-mute">{deviceLabel(order) || 'Aparelho sem modelo'}</p>
        <p className={`mt-1 text-xs font-medium ${waitColor}`}>
          {order.status === 'delivered'
            ? `Entregue · ${timeInShop(order.receivedAt, order.deliveredAt ?? Date.now())} na loja`
            : overdue
              ? `Parado há ${days} dias — ligar para o cliente`
              : days >= 30
                ? `Há ${timeInShop(order.receivedAt)} na loja`
                : `Na loja há ${timeInShop(order.receivedAt)}`}
        </p>
      </div>
    </Link>
  )
}
