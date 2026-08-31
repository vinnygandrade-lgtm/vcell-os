import { Link, useNavigate } from 'react-router-dom'
import { ChevronLeft, Search } from 'lucide-react'
import { useCustomers, useOrders } from '@/hooks/useStore'
import { fold, formatPhone } from '@/lib/format'
import { useMemo, useState } from 'react'

export function CustomersPage() {
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const customers = useCustomers()
  const orders = useOrders()
  const counts = useMemo(() => {
    const map: Record<string, number> = {}
    for (const order of orders) {
      map[order.customerId] = (map[order.customerId] ?? 0) + 1
    }
    return map
  }, [orders])
  const visible = customers.filter((customer) => {
    const q = fold(query)
    if (!q) return true
    return fold(customer.name).includes(q) || customer.phone.includes(query.replace(/\D/g, ''))
  })

  return (
    <div className="min-h-dvh pb-8">
      <header className="sticky top-0 z-30 bg-ink/90 px-2 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))] backdrop-blur">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="flex h-10 w-10 items-center justify-center"
            aria-label="Voltar"
          >
            <ChevronLeft />
          </button>
          <p className="font-display text-xl tracking-wide">Clientes</p>
        </div>
        <div className="relative mt-2 px-2">
          <Search size={18} className="pointer-events-none absolute left-5 top-1/2 -translate-y-1/2 text-mute" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Nome ou telefone"
            className="w-full rounded-2xl bg-raised py-3 pl-11 pr-4 text-[16px] outline-none ring-1 ring-line"
          />
        </div>
      </header>
      <div className="grid gap-2 px-4">
        {visible.length === 0 && (
          <p className="mt-8 text-center text-sm text-mute">Nenhum cliente ainda.</p>
        )}
        {visible.map((customer) => (
          <Link
            key={customer.id}
            to={`/clientes/${customer.id}`}
            className="rounded-3xl bg-panel px-4 py-3 ring-1 ring-line"
          >
            <p className="font-semibold">{customer.name}</p>
            <p className="text-sm text-mute">
              {formatPhone(customer.phone) || 'Sem telefone'}
              {counts[customer.id] ? ` · ${counts[customer.id]} OS` : ''}
            </p>
          </Link>
        ))}
      </div>
    </div>
  )
}
