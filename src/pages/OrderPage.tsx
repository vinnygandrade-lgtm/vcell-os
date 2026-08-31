import { Link, useNavigate, useParams } from 'react-router-dom'
import { useState } from 'react'
import {
  ChevronLeft,
  Copy,
  MessageCircle,
  Trash2,
  AlertTriangle,
} from 'lucide-react'
import { PhotoStrip } from '@/components/PhotoStrip'
import { StatusBadge } from '@/components/Ui'
import { useCustomer, useOrder, usePhotos } from '@/hooks/useStore'
import { db, explainSaveError, uid } from '@/lib/db'
import {
  daysInShop,
  deviceLabel,
  formatDateTime,
  formatMoney,
  formatOs,
  formatPhone,
  isOverdue,
  overdueMessage,
  OVERDUE_DAYS,
  readyMessage,
  receivedMessage,
  timeInShop,
  whatsappLink,
} from '@/lib/format'
import { compressImage } from '@/lib/photos'
import { STATUS_LABEL, STATUS_ORDER, type Order, type OrderStatus } from '@/lib/types'

export function OrderPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const order = useOrder(id)

  const loaded = order !== undefined || !id
  if (!loaded) {
    return <Screen title="Carregando…" onBack={() => navigate('/')} />
  }
  if (!order) {
    return <Screen title="OS não encontrada" onBack={() => navigate('/')} />
  }

  return <OrderDetail order={order} />
}

function OrderDetail({ order }: { order: Order }) {
  const navigate = useNavigate()
  const customer = useCustomer(order.customerId)
  const photos = usePhotos(order.id)
  const [photoError, setPhotoError] = useState('')

  async function setStatus(status: OrderStatus) {
    const now = Date.now()
    await db.orders.update(order.id, {
      status,
      updatedAt: now,
      readyAt: status === 'ready' || status === 'delivered' ? order.readyAt ?? now : order.readyAt,
      deliveredAt: status === 'delivered' ? now : null,
    })
  }

  async function addPhotos(files: FileList) {
    setPhotoError('')
    try {
      const rows = []
      for (const file of Array.from(files)) {
        rows.push({
          id: uid(),
          orderId: order.id,
          blob: await compressImage(file),
          createdAt: Date.now(),
        })
      }
      await db.photos.bulkAdd(rows)
    } catch (err) {
      setPhotoError(explainSaveError(err))
    }
  }

  async function remove() {
    if (!confirm(`Apagar ${formatOs(order.number)}? Isso não volta.`)) return
    await db.photos.where('orderId').equals(order.id).delete()
    await db.orders.delete(order.id)
    navigate('/')
  }

  const overdue = isOverdue(order)
  const days = daysInShop(order.receivedAt)
  const waText = overdue
    ? overdueMessage(customer?.name ?? 'cliente', order)
    : order.status === 'ready' || order.status === 'delivered'
      ? readyMessage(customer?.name ?? 'cliente', order)
      : receivedMessage(customer?.name ?? 'cliente', order)

  return (
    <div className="min-h-dvh pb-10">
      <header className="sticky top-0 z-30 flex items-center gap-1 bg-ink/90 px-2 py-3 backdrop-blur pt-[max(0.75rem,env(safe-area-inset-top))]">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="flex h-10 w-10 items-center justify-center"
          aria-label="Voltar"
        >
          <ChevronLeft />
        </button>
        <div className="min-w-0 flex-1">
          <p className="font-display text-2xl leading-none tracking-wide text-red">
            {formatOs(order.number)}
          </p>
          <p className="truncate text-xs text-mute">{deviceLabel(order)}</p>
        </div>
        <StatusBadge status={order.status} />
      </header>

      <div className="px-4">
        {overdue && (
          <section className="mb-4 rounded-3xl bg-red px-4 py-4 text-white shadow-[0_12px_28px_rgba(225,6,19,0.35)]">
            <div className="flex items-start gap-3">
              <AlertTriangle size={20} className="mt-0.5 shrink-0" />
              <div className="min-w-0">
                <p className="font-semibold">Parado na loja há {days} dias</p>
                <p className="mt-1 text-sm text-white/80">
                  Passou de {OVERDUE_DAYS} dias. Avise o cliente para retirar ou decidir o que fazer.
                </p>
              </div>
            </div>
            {customer?.phone && (
              <a
                href={whatsappLink(customer.phone, waText)}
                target="_blank"
                rel="noreferrer"
                className="mt-3 flex h-11 items-center justify-center gap-2 rounded-2xl bg-white font-semibold text-red"
              >
                <MessageCircle size={16} /> Avisar no WhatsApp
              </a>
            )}
          </section>
        )}
        <section className="rounded-3xl bg-gradient-to-br from-navy to-ink p-5 ring-1 ring-navy-mid">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-blue-200/70">
            Número para achar o aparelho
          </p>
          <p className="mt-1 font-display text-5xl tracking-wide">{formatOs(order.number)}</p>
          <p className="mt-2 text-sm text-blue-100/80">
            {order.status === 'delivered'
              ? `Ficou ${timeInShop(order.receivedAt, order.deliveredAt ?? Date.now())} na loja`
              : `Na loja há ${timeInShop(order.receivedAt)}`}
          </p>
          <div className="mt-4 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => navigator.clipboard.writeText(formatOs(order.number))}
              className="flex h-11 items-center justify-center gap-2 rounded-2xl bg-white/10 text-sm font-semibold"
            >
              <Copy size={16} /> Copiar OS
            </button>
            {customer?.phone ? (
              <a
                href={whatsappLink(customer.phone, waText)}
                target="_blank"
                rel="noreferrer"
                className="flex h-11 items-center justify-center gap-2 rounded-2xl bg-emerald-500/20 text-sm font-semibold text-emerald-200"
              >
                <MessageCircle size={16} /> WhatsApp
              </a>
            ) : (
              <span className="flex h-11 items-center justify-center rounded-2xl bg-white/5 text-sm text-mute">
                Sem telefone
              </span>
            )}
          </div>
        </section>

        <section className="mt-4 rounded-3xl bg-panel p-4 ring-1 ring-line">
          <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-mute">Andamento</p>
          <div className="grid grid-cols-4 gap-1">
            {STATUS_ORDER.map((status) => {
              const active = order.status === status
              const reached = STATUS_ORDER.indexOf(order.status) >= STATUS_ORDER.indexOf(status)
              return (
                <button
                  key={status}
                  type="button"
                  onClick={() => setStatus(status)}
                  className={`rounded-2xl px-1 py-3 text-center text-[11px] font-semibold leading-tight ${
                    active
                      ? 'bg-red text-white shadow-[0_8px_20px_rgba(225,6,19,0.35)]'
                      : reached
                        ? 'bg-navy-mid/50 text-blue-100'
                        : 'bg-raised text-mute'
                  }`}
                >
                  {STATUS_LABEL[status]}
                </button>
              )
            })}
          </div>
        </section>

        <section className="mt-4 rounded-3xl bg-panel p-4 ring-1 ring-line">
          {customer && (
            <Link to={`/clientes/${customer.id}`} className="block">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-mute">Cliente</p>
              <p className="mt-1 text-lg font-semibold">{customer.name}</p>
              <p className="text-sm text-mute">{formatPhone(customer.phone) || 'Sem telefone'}</p>
            </Link>
          )}
          <dl className="mt-4 grid gap-3 text-sm">
            <Row label="Aparelho" value={deviceLabel(order) || '—'} />
            <Row label="Defeito" value={order.defect || '—'} />
            <Row label="IMEI" value={order.imei || '—'} />
            <Row label="Senha / padrão" value={order.unlock || '—'} />
            <Row label="Valor" value={formatMoney(order.price) || '—'} />
            <Row label="Obs." value={order.notes || '—'} />
          </dl>
        </section>

        <section className="mt-4 rounded-3xl bg-panel p-4 ring-1 ring-line">
          <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-mute">Fotos</p>
          <PhotoStrip
            photos={photos}
            onAdd={addPhotos}
            onRemoveSaved={(photoId) => db.photos.delete(photoId)}
          />
          {photoError && (
            <p role="alert" className="mt-3 rounded-2xl bg-red px-3 py-2.5 text-sm font-semibold text-white">
              {photoError}
            </p>
          )}
        </section>

        <section className="mt-4 rounded-3xl bg-panel p-4 ring-1 ring-line">
          <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-mute">Histórico</p>
          <ol className="space-y-3 text-sm">
            <li>
              <p className="font-medium">Deixado na loja</p>
              <p className="text-mute">{formatDateTime(order.receivedAt)}</p>
            </li>
            {order.readyAt && (
              <li>
                <p className="font-medium">Serviço pronto</p>
                <p className="text-mute">{formatDateTime(order.readyAt)}</p>
              </li>
            )}
            {order.deliveredAt && (
              <li>
                <p className="font-medium">Entregue ao cliente</p>
                <p className="text-mute">{formatDateTime(order.deliveredAt)}</p>
              </li>
            )}
          </ol>
        </section>

        <button
          type="button"
          onClick={remove}
          className="mt-6 flex w-full items-center justify-center gap-2 py-3 text-sm text-mute"
        >
          <Trash2 size={16} /> Apagar esta OS
        </button>
      </div>
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <dt className="text-mute">{label}</dt>
      <dd className="max-w-[60%] text-right font-medium">{value}</dd>
    </div>
  )
}

function Screen({ title, onBack }: { title: string; onBack: () => void }) {
  return (
    <div className="px-4 pt-16">
      <button type="button" onClick={onBack} className="text-sm text-mute">
        Voltar
      </button>
      <p className="mt-4 font-display text-2xl">{title}</p>
    </div>
  )
}
