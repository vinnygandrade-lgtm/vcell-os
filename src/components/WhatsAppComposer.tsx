import { MessageCircle, X } from 'lucide-react'
import { areaClass } from '@/components/Ui'
import { whatsappLink } from '@/lib/format'

export function WhatsAppComposer({
  title,
  phone,
  text,
  onChange,
  onClose,
  onSend,
}: {
  title: string
  phone: string
  text: string
  onChange: (value: string) => void
  onClose: () => void
  onSend?: () => void
}) {
  return (
    <div className="fixed inset-x-0 top-0 z-50 mx-auto flex min-h-dvh w-full max-w-[430px] flex-col bg-ink px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-[max(0.75rem,env(safe-area-inset-top))]">
      <div className="flex items-center gap-2 py-2">
        <button
          type="button"
          onClick={onClose}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-raised"
          aria-label="Fechar"
        >
          <X size={18} />
        </button>
        <p className="font-display text-xl tracking-wide">{title}</p>
      </div>
      <p className="mb-2 text-xs text-mute">Pode editar o texto antes de enviar.</p>
      <textarea
        value={text}
        onChange={(e) => onChange(e.target.value)}
        className={`${areaClass} min-h-0 flex-1`}
      />
      <a
        href={whatsappLink(phone, text)}
        target="_blank"
        rel="noreferrer"
        onClick={() => onSend?.()}
        className="mt-3 flex h-14 items-center justify-center gap-2 rounded-2xl bg-emerald-500 font-semibold text-white"
      >
        <MessageCircle size={18} /> Enviar no WhatsApp
      </a>
    </div>
  )
}
