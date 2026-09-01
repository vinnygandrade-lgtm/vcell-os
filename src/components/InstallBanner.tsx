import { useEffect, useState } from 'react'
import { Plus, Share } from 'lucide-react'

function isIos() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent)
}

function isStandalone() {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    Boolean((navigator as Navigator & { standalone?: boolean }).standalone)
  )
}

export function InstallBanner() {
  const [event, setEvent] = useState<BeforeInstallPromptEvent | null>(null)
  const [iosTip, setIosTip] = useState(false)
  const [hidden, setHidden] = useState(() => {
    try {
      return localStorage.getItem('vcell-hide-install') === '1'
    } catch {
      return false
    }
  })

  useEffect(() => {
    if (isStandalone()) return
    if (isIos()) {
      setIosTip(true)
      return
    }
    const onPrompt = (e: Event) => {
      e.preventDefault()
      setEvent(e as BeforeInstallPromptEvent)
    }
    window.addEventListener('beforeinstallprompt', onPrompt)
    return () => window.removeEventListener('beforeinstallprompt', onPrompt)
  }, [])

  function dismiss() {
    setHidden(true)
    try {
      localStorage.setItem('vcell-hide-install', '1')
    } catch {
      // ignore
    }
  }

  if (hidden || isStandalone()) return null

  if (iosTip) {
    return (
      <div className="rounded-2xl bg-navy px-4 py-3 text-sm ring-1 ring-navy-mid">
        <p className="flex items-start gap-2 font-medium">
          <Share size={16} className="mt-0.5 shrink-0" />
          Coloca na tela inicial pelo Safari
        </p>
        <p className="mt-1 text-xs leading-relaxed text-blue-200/80">
          Toque em Compartilhar (quadrado com a seta) → Adicionar à Tela de Início. Depois abre
          sempre pelo ícone, senão o cadastro pode ficar em outro lugar.
        </p>
        <button type="button" onClick={dismiss} className="mt-2 text-xs font-semibold text-mute">
          Já coloquei
        </button>
      </div>
    )
  }

  if (!event) return null

  return (
    <button
      type="button"
      onClick={async () => {
        await event.prompt()
        dismiss()
      }}
      className="flex w-full items-center justify-between rounded-2xl bg-navy px-4 py-3 text-left text-sm ring-1 ring-navy-mid"
    >
      <span>
        Instalar o app na tela inicial
        <span className="mt-0.5 block text-xs text-blue-200/80">Abre mais rápido, como um aplicativo</span>
      </span>
      <Plus size={18} />
    </button>
  )
}

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
}
