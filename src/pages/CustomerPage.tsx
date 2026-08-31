import { Link, useNavigate, useParams } from 'react-router-dom'
import { ChevronLeft, MessageCircle } from 'lucide-react'
import { OrderCard } from '@/components/OrderCard'
import { useCustomer, useFirstPhotos, useOrders } from '@/hooks/useStore'
import { formatDate, formatPhone, whatsappLink } from '@/lib/format'
import { shop } from '@/lib/shop'

export function CustomerPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const customer = useCustomer(id)
  const orders = useOrders().filter((order) => order.customerId === id)
  const photos = useFirstPhotos(orders.map((order) => order.id))

  if (!customer) {
    return (
      <div className="px-4 pt-16 text-mute">
        <button type="button" onClick={() => navigate(-1)}>
          Voltar
        </button>
        <p className="mt-4">Cliente não encontrado.</p>
      </div>
    )
  }

  return (
    <div className="min-h-dvh pb-10">
      <header className="sticky top-0 z-30 flex items-center gap-1 bg-ink/90 px-2 py-3 pt-[max(0.75rem,env(safe-area-inset-top))] backdrop-blur">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="flex h-10 w-10 items-center justify-center"
          aria-label="Voltar"
        >
          <ChevronLeft />
        </button>
        <div className="min-w-0">
          <p className="truncate font-display text-xl tracking-wide">{customer.name}</p>
          <p className="text-xs text-mute">Cliente desde {formatDate(customer.createdAt)}</p>
        </div>
      </header>
      <div className="px-4">
        <section className="rounded-3xl bg-panel p-4 ring-1 ring-line">
          <p className="text-sm text-mute">{formatPhone(customer.phone) || 'Sem telefone'}</p>
          {customer.phone && (
            <a
              href={whatsappLink(
                customer.phone,
                `Olá ${customer.name.split(' ')[0]}, aqui é da ${shop.name}.`,
              )}
              className="mt-3 inline-flex items-center gap-2 text-sm font-semibold text-emerald-300"
            >
              <MessageCircle size={16} /> WhatsApp
            </a>
          )}
        </section>
        <div className="mt-4 flex items-center justify-between">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-mute">
            Histórico ({orders.length})
          </p>
          <Link to="/nova" className="text-sm font-semibold text-red">
            Nova OS
          </Link>
        </div>
        <div className="mt-3 grid gap-3">
          {orders.length === 0 && <p className="text-sm text-mute">Ainda sem aparelhos.</p>}
          {orders.map((order) => (
            <OrderCard key={order.id} order={order} customer={customer} photo={photos[order.id]} />
          ))}
        </div>
      </div>
    </div>
  )
}
