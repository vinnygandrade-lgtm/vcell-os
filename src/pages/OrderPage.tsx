import { Link, useNavigate, useParams } from 'react-router-dom'
import { useEffect, useState } from 'react'
import {
  ChevronLeft,
  Copy,
  Maximize2,
  MessageCircle,
  Trash2,
  AlertTriangle,
  X,
} from 'lucide-react'
import { WhatsAppComposer } from '@/components/WhatsAppComposer'
import { PhotoStrip } from '@/components/PhotoStrip'
import { LocationPicker, StatusBadge } from '@/components/Ui'
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
  orderSummary,
  OVERDUE_DAYS,
  timeInShop,
} from '@/lib/format'
import {
  buildMessage,
  MESSAGE_LABEL,
  type MessageKind,
} from '@/lib/messages'
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
  const [composer, setComposer] = useState<{ kind: MessageKind; text: string } | null>(null)
  const [ticketOpen, setTicketOpen] = useState(false)
  const [copied, setCopied] = useState('')
  const [locEdit, setLocEdit] = useState(order.location ?? '')

  useEffect(() => {
    setLocEdit(order.location ?? '')
  }, [order.id])

  async function setStatus(status: OrderStatus) {
    const now = Date.now()
    await db.orders.update(order.id, {
      status,
      updatedAt: now,
      readyAt: status === 'ready' || status === 'delivered' ? order.readyAt ?? now : order.readyAt,
      deliveredAt: status === 'delivered' ? now : null,
    })
  }

  async function setLocation(location: string) {
    setLocEdit(location)
    await db.orders.update(order.id, { location, updatedAt: Date.now() })
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

  async function copyText(label: string, text: string) {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(label)
      window.setTimeout(() => setCopied(''), 2000)
    } catch {
      setCopied('')
    }
  }

  function stampWarn(kind: MessageKind) {
    const now = Date.now()
    if (kind === 'pickup') {
      void db.orders.update(order.id, { pickupWarnedAt: now, updatedAt: now })
    }
    if (kind === 'sale') {
      void db.orders.update(order.id, { saleWarnedAt: now, updatedAt: now })
    }
  }

  const overdue = isOverdue(order)
  const days = daysInShop(order.receivedAt)
  const customerName = customer?.name ?? 'cliente'
  const location = order.location?.trim() ?? ''

  function openMessage(kind: MessageKind) {
    setComposer({ kind, text: buildMessage(kind, customerName, order) })
  }

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
          <p className="truncate text-xs text-mute">
            {location ? `${location} · ${deviceLabel(order)}` : deviceLabel(order)}
          </p>
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
                  Passou de {OVERDUE_DAYS} dias. Avise para retirar ou mande o aviso de venda.
                </p>
                {order.pickupWarnedAt && (
                  <p className="mt-1 text-xs text-white/70">
                    Retirada avisada em {formatDateTime(order.pickupWarnedAt)}
                  </p>
                )}
                {order.saleWarnedAt && (
                  <p className="mt-1 text-xs text-white/70">
                    Venda avisada em {formatDateTime(order.saleWarnedAt)}
                  </p>
                )}
              </div>
            </div>
            {customer?.phone ? (
              <div className="mt-3 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => openMessage('pickup')}
                  className="flex h-11 items-center justify-center rounded-2xl bg-white px-2 text-center text-sm font-semibold text-red"
                >
                  Avisar retirada
                </button>
                <button
                  type="button"
                  onClick={() => openMessage('sale')}
                  className="flex h-11 items-center justify-center rounded-2xl bg-black/25 px-2 text-center text-sm font-semibold text-white ring-1 ring-white/30"
                >
                  Aviso de venda
                </button>
              </div>
            ) : (
              <p className="mt-3 text-sm text-white/80">Cadastre o WhatsApp do cliente para avisar.</p>
            )}
          </section>
        )}
        <section className="rounded-3xl bg-gradient-to-br from-navy to-ink p-5 ring-1 ring-navy-mid">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-blue-200/70">
            Número para achar o aparelho
          </p>
          <p className="mt-1 font-display text-5xl tracking-wide">{formatOs(order.number)}</p>
          {location ? (
            <p className="mt-2 text-lg font-semibold text-blue-100">Onde: {location}</p>
          ) : (
            <p className="mt-2 text-sm text-amber-200/90">Ainda não marcou onde está o celular.</p>
          )}
          <p className="mt-1 text-sm text-blue-100/80">
            {order.status === 'delivered'
              ? `Ficou ${timeInShop(order.receivedAt, order.deliveredAt ?? Date.now())} na loja`
              : `Na loja há ${timeInShop(order.receivedAt)}`}
          </p>
          <div className="mt-4 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => void copyText('OS copiada', formatOs(order.number))}
              className="flex h-11 items-center justify-center gap-2 rounded-2xl bg-white/10 text-sm font-semibold"
            >
              <Copy size={16} /> Copiar OS
            </button>
            <button
              type="button"
              onClick={() => setTicketOpen(true)}
              className="flex h-11 items-center justify-center gap-2 rounded-2xl bg-white/10 text-sm font-semibold"
            >
              <Maximize2 size={16} /> Cartão
            </button>
            {customer?.phone ? (
              <button
                type="button"
                onClick={() =>
                  openMessage(
                    overdue ? 'pickup' : order.status === 'ready' ? 'ready' : 'received',
                  )
                }
                className="col-span-2 flex h-11 items-center justify-center gap-2 rounded-2xl bg-emerald-500/20 text-sm font-semibold text-emerald-200"
              >
                <MessageCircle size={16} /> WhatsApp
              </button>
            ) : (
              <span className="col-span-2 flex h-11 items-center justify-center rounded-2xl bg-white/5 text-sm text-mute">
                Sem telefone
              </span>
            )}
            <button
              type="button"
              onClick={() => void copyText('Resumo copiado', orderSummary(order, customerName))}
              className="col-span-2 flex h-11 items-center justify-center gap-2 rounded-2xl bg-white/10 text-sm font-semibold"
            >
              <Copy size={16} /> Copiar resumo
            </button>
          </div>
          {copied && <p className="mt-2 text-center text-xs text-emerald-300">{copied}</p>}
        </section>

        {customer?.phone && (
          <section className="mt-4 rounded-3xl bg-panel p-4 ring-1 ring-line">
            <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-mute">
              Mensagens no WhatsApp
            </p>
            <div className="grid gap-2">
              {(overdue
                ? (['pickup', 'sale', 'ready'] as const)
                : order.status === 'ready'
                  ? (['ready', 'received'] as const)
                  : (['received', 'ready'] as const)
              ).map((kind) => (
                <button
                  key={kind}
                  type="button"
                  onClick={() => openMessage(kind)}
                  className={`flex h-12 items-center justify-center rounded-2xl text-sm font-semibold ${
                    kind === 'sale'
                      ? 'bg-red text-white'
                      : 'bg-raised ring-1 ring-line'
                  }`}
                >
                  {MESSAGE_LABEL[kind]}
                </button>
              ))}
            </div>
          </section>
        )}

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
          <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-mute">
            Onde está
          </p>
          <LocationPicker value={locEdit} onChange={(value) => void setLocation(value)} />
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
            {order.pickupWarnedAt && (
              <li>
                <p className="font-medium">Aviso de retirada enviado</p>
                <p className="text-mute">{formatDateTime(order.pickupWarnedAt)}</p>
              </li>
            )}
            {order.saleWarnedAt && (
              <li>
                <p className="font-medium">Aviso de venda enviado</p>
                <p className="text-mute">{formatDateTime(order.saleWarnedAt)}</p>
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
      {ticketOpen && (
        <FindTicket
          order={order}
          customerName={customerName}
          copied={copied}
          onClose={() => setTicketOpen(false)}
          onCopy={() => void copyText('Resumo copiado', orderSummary(order, customerName))}
        />
      )}
      {composer && customer?.phone && (
        <WhatsAppComposer
          title={MESSAGE_LABEL[composer.kind]}
          phone={customer.phone}
          text={composer.text}
          onChange={(text) => setComposer({ ...composer, text })}
          onClose={() => setComposer(null)}
          onSend={() => stampWarn(composer.kind)}
        />
      )}
    </div>
  )
}

function FindTicket({
  order,
  customerName,
  copied,
  onClose,
  onCopy,
}: {
  order: Order
  customerName: string
  copied: string
  onClose: () => void
  onCopy: () => void
}) {
  const location = order.location?.trim()
  return (
    <div className="fixed inset-x-0 top-0 z-50 mx-auto flex min-h-dvh w-full max-w-[430px] flex-col bg-ink px-5 pb-[max(1rem,env(safe-area-inset-bottom))] pt-[max(0.75rem,env(safe-area-inset-top))]">
      <div className="flex items-center justify-between py-2">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-mute">Cartão de busca</p>
        <button
          type="button"
          onClick={onClose}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-raised"
          aria-label="Fechar"
        >
          <X size={18} />
        </button>
      </div>
      <div className="flex flex-1 flex-col items-center justify-center text-center">
        <p className="font-display text-7xl leading-none tracking-wide text-red">{formatOs(order.number)}</p>
        <p className="mt-6 font-display text-4xl leading-tight tracking-wide">
          {location || 'Local não marcado'}
        </p>
        <p className="mt-4 text-xl font-semibold">{deviceLabel(order) || 'Aparelho'}</p>
        <p className="mt-1 text-lg text-mute">{customerName}</p>
        {order.unlock?.trim() ? (
          <p className="mt-6 rounded-2xl bg-raised px-4 py-3 font-mono text-lg ring-1 ring-line">
            Senha: {order.unlock}
          </p>
        ) : null}
      </div>
      <button
        type="button"
        onClick={onCopy}
        className="flex h-14 items-center justify-center gap-2 rounded-2xl bg-raised font-semibold ring-1 ring-line"
      >
        <Copy size={16} /> {copied || 'Copiar resumo'}
      </button>
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
