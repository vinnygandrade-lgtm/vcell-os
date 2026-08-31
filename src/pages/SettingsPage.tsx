import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronLeft, Download, MapPin, Phone, Upload } from 'lucide-react'
import { BrandMark } from '@/components/Shell'
import { areaClass } from '@/components/Ui'
import { DriveSettings } from '@/components/DriveSettings'
import { exportBackup, importBackup } from '@/lib/backup'
import {
  DEFAULT_TEMPLATES,
  getTemplate,
  resetTemplate,
  saveTemplate,
  type MessageKind,
} from '@/lib/messages'
import { shop } from '@/lib/shop'

export function SettingsPage() {
  const navigate = useNavigate()
  const fileRef = useRef<HTMLInputElement>(null)
  const [message, setMessage] = useState('')
  const [saleText, setSaleText] = useState(() => getTemplate('sale'))
  const [pickupText, setPickupText] = useState(() => getTemplate('pickup'))
  const [savedKind, setSavedKind] = useState('')
  const [busy, setBusy] = useState(false)

  function saveKind(kind: MessageKind, text: string) {
    saveTemplate(kind, text)
    setSavedKind(kind)
  }

  async function restore(file: File) {
    setBusy(true)
    try {
      await importBackup(file)
      setMessage('Backup restaurado.')
    } catch {
      setMessage('Não deu para ler esse arquivo.')
    } finally {
      setBusy(false)
    }
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
        <p className="font-display text-xl tracking-wide">Ajustes</p>
      </header>
      <div className="px-4">
        <section className="overflow-hidden rounded-3xl bg-black ring-1 ring-line">
          <div className="flex justify-center bg-black px-6 py-6">
            <BrandMark />
          </div>
          <div className="bg-panel px-4 py-4">
            <p className="font-display text-lg tracking-wide">{shop.name}</p>
            <p className="mt-2 flex items-center gap-2 text-sm text-mute">
              <Phone size={14} /> {shop.phoneDisplay}
            </p>
            <p className="mt-1 flex items-start gap-2 text-sm text-mute">
              <MapPin size={14} className="mt-0.5 shrink-0" /> {shop.address}
            </p>
          </div>
        </section>

        <DriveSettings />

        <section className="mt-4 rounded-3xl bg-panel p-4 ring-1 ring-line">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-mute">No celular</p>
          <p className="mt-2 text-sm leading-relaxed text-mute">
            No Chrome do celular, abra este endereço e depois toque em{' '}
            <strong className="text-paper">Adicionar à tela inicial</strong>. O app usa a câmera e
            guarda os dados neste aparelho. Se o Drive estiver ligado, também manda uma cópia para a
            sua conta Google.
          </p>
          <p className="mt-3 break-all rounded-2xl bg-raised px-3 py-2 font-mono text-xs text-blue-200">
            {typeof window !== 'undefined' ? window.location.href.split('#')[0] : ''}
          </p>
        </section>

        <section className="mt-4 rounded-3xl bg-panel p-4 ring-1 ring-line">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-mute">
            Aviso de venda (60 dias)
          </p>
          <p className="mt-2 text-sm leading-relaxed text-mute">
            Texto padrão do WhatsApp. Use {'{nome}'}, {'{aparelho}'}, {'{os}'}, {'{dias}'}, {'{loja}'},{' '}
            {'{endereco}'}, {'{telefone}'}, {'{valor}'} e {'{local}'}.
          </p>
          <textarea
            value={saleText}
            onChange={(e) => setSaleText(e.target.value)}
            className={`${areaClass} mt-3 min-h-40`}
          />
          <div className="mt-2 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => saveKind('sale', saleText)}
              className="h-11 rounded-2xl bg-red text-sm font-semibold text-white"
            >
              Guardar venda
            </button>
            <button
              type="button"
              onClick={() => {
                resetTemplate('sale')
                setSaleText(DEFAULT_TEMPLATES.sale)
                setSavedKind('')
              }}
              className="h-11 rounded-2xl bg-raised text-sm font-semibold ring-1 ring-line"
            >
              Restaurar
            </button>
          </div>
          {savedKind === 'sale' && (
            <p className="mt-2 text-sm text-emerald-300">Aviso de venda guardado.</p>
          )}
        </section>

        <section className="mt-4 rounded-3xl bg-panel p-4 ring-1 ring-line">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-mute">
            Aviso de retirada
          </p>
          <textarea
            value={pickupText}
            onChange={(e) => setPickupText(e.target.value)}
            className={`${areaClass} mt-3 min-h-36`}
          />
          <div className="mt-2 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => saveKind('pickup', pickupText)}
              className="h-11 rounded-2xl bg-red text-sm font-semibold text-white"
            >
              Guardar retirada
            </button>
            <button
              type="button"
              onClick={() => {
                resetTemplate('pickup')
                setPickupText(DEFAULT_TEMPLATES.pickup)
                setSavedKind('')
              }}
              className="h-11 rounded-2xl bg-raised text-sm font-semibold ring-1 ring-line"
            >
              Restaurar
            </button>
          </div>
          {savedKind === 'pickup' && (
            <p className="mt-2 text-sm text-emerald-300">Aviso de retirada guardado.</p>
          )}
        </section>

        <section className="mt-4 rounded-3xl bg-panel p-4 ring-1 ring-line">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-mute">Backup</p>
          <p className="mt-2 text-sm leading-relaxed text-mute">
            Os dados ficam neste celular. Com o Drive ligado, a nuvem já é o backup. Ainda assim
            pode exportar um arquivo se quiser.
          </p>
          <div className="mt-3 grid gap-2">
            <button
              type="button"
              onClick={() => exportBackup()}
              className="flex h-12 items-center justify-center gap-2 rounded-2xl bg-raised font-semibold ring-1 ring-line"
            >
              <Download size={16} /> Exportar backup
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => fileRef.current?.click()}
              className="flex h-12 items-center justify-center gap-2 rounded-2xl bg-raised font-semibold ring-1 ring-line"
            >
              <Upload size={16} /> Restaurar backup
            </button>
          </div>
          {message && <p className="mt-2 text-sm text-emerald-300">{message}</p>}
          <input
            ref={fileRef}
            type="file"
            accept="application/json"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) restore(file)
              e.target.value = ''
            }}
          />
        </section>
      </div>
    </div>
  )
}
