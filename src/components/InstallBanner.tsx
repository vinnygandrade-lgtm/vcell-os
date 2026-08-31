import { useEffect, useState } from 'react'
import { Plus } from 'lucide-react'

export function InstallBanner() {
  const [event, setEvent] = useState<BeforeInstallPromptEvent | null>(null)
  const [hidden, setHidden] = useState(false)

  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault()
      setEvent(e as BeforeInstallPromptEvent)
    }
    window.addEventListener('beforeinstallprompt', onPrompt)
    return () => window.removeEventListener('beforeinstallprompt', onPrompt)
  }, [])

  if (!event || hidden) return null

  return (
    <button
      type="button"
      onClick={async () => {
        await event.prompt()
        setHidden(true)
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
