import { useState } from 'react'
import { Cloud, Copy, RefreshCw } from 'lucide-react'
import { Field, inputClass, areaClass } from '@/components/Ui'
import { useCloudStatus } from '@/hooks/useCloud'
import {
  connectCloud,
  disconnectCloud,
  explainCloudError,
  getCloudUiStatus,
  loadCloudConfig,
  SETUP_SQL,
  syncNow,
} from '@/lib/cloud'
import { formatAgo } from '@/lib/format'

export function CloudSettings() {
  const cloud = useCloudStatus()
  const saved = loadCloudConfig()
  const [url, setUrl] = useState(saved.url)
  const [anonKey, setAnonKey] = useState(saved.anonKey)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [copied, setCopied] = useState(false)

  async function connect() {
    setBusy(true)
    setMessage('')
    try {
      await connectCloud(url, anonKey)
      const status = getCloudUiStatus()
      setMessage(status.lastError || 'Nuvem ligada. OS e fotos vão copiar sozinhas.')
    } catch (err) {
      setMessage(explainCloudError(err))
    } finally {
      setBusy(false)
    }
  }

  async function sync() {
    setBusy(true)
    setMessage('')
    try {
      await syncNow()
      setMessage(getCloudUiStatus().lastError || 'Sincronizado.')
    } catch (err) {
      setMessage(explainCloudError(err))
    } finally {
      setBusy(false)
    }
  }

  async function copySql() {
    try {
      await navigator.clipboard.writeText(SETUP_SQL)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      setCopied(false)
    }
  }

  return (
    <section className="mt-4 rounded-3xl bg-panel p-4 ring-1 ring-line">
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-mute">Nuvem</p>
      <p className="mt-2 text-sm leading-relaxed text-mute">
        Cópia das OS e das fotos na internet. Depois o celular da loja e o computador mostram a
        mesma coisa. Sem internet a loja continua funcionando.
      </p>

      {cloud.connected ? (
        <div className="mt-3 rounded-2xl bg-raised px-3 py-3 ring-1 ring-line">
          <p className="flex items-center gap-2 text-sm font-semibold text-emerald-300">
            <Cloud size={16} /> Nuvem ligada
          </p>
          <p className="mt-1 text-xs text-mute">
            {cloud.syncing
              ? 'Enviando agora…'
              : cloud.lastSyncAt
                ? `Última cópia ${formatAgo(cloud.lastSyncAt)}`
                : 'Ainda não enviou'}
          </p>
          {cloud.lastError && <p className="mt-2 text-sm text-red-hot">{cloud.lastError}</p>}
        </div>
      ) : (
        <p className="mt-3 text-sm text-amber-200">Ainda não está ligada. São 4 passos no computador.</p>
      )}

      <div className="mt-3 grid gap-3">
        <Field label="Project URL">
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value.trim())}
            placeholder="https://xxxx.supabase.co"
            className={`${inputClass} font-mono text-sm`}
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
          />
        </Field>
        <Field label="anon public">
          <textarea
            value={anonKey}
            onChange={(e) => setAnonKey(e.target.value.trim())}
            placeholder="eyJ..."
            className={`${areaClass} min-h-24 font-mono text-xs`}
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
          />
        </Field>
      </div>

      <div className="mt-3 grid gap-2">
        {cloud.connected ? (
          <>
            <button
              type="button"
              disabled={busy}
              onClick={() => void sync()}
              className="flex h-12 items-center justify-center gap-2 rounded-2xl bg-red font-semibold text-white disabled:opacity-60"
            >
              <RefreshCw size={16} /> {busy ? 'Sincronizando…' : 'Sincronizar agora'}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => disconnectCloud()}
              className="h-12 rounded-2xl text-sm text-mute"
            >
              Desconectar
            </button>
          </>
        ) : (
          <button
            type="button"
            disabled={busy || !url || !anonKey}
            onClick={() => void connect()}
            className="flex h-12 items-center justify-center gap-2 rounded-2xl bg-red font-semibold text-white disabled:opacity-60"
          >
            <Cloud size={16} /> {busy ? 'Ligando…' : 'Ligar nuvem'}
          </button>
        )}
      </div>
      {message && (
        <p className={`mt-2 text-sm ${/ligada|Sincronizado/i.test(message) ? 'text-emerald-300' : 'text-red-hot'}`}>
          {message}
        </p>
      )}

      {!cloud.connected && (
        <ol className="mt-4 list-decimal space-y-2 pl-5 text-sm leading-relaxed text-mute">
          <li>
            No computador, abre{' '}
            <a className="text-blue-200 underline" href="https://supabase.com" target="_blank" rel="noreferrer">
              supabase.com
            </a>{' '}
            e cria conta com o Gmail da loja.
          </li>
          <li>
            New project → nome <strong className="text-paper">vcell</strong> → inventa uma senha → região{' '}
            <strong className="text-paper">South America (São Paulo)</strong>.
          </li>
          <li>
            Quando ficar Ready: Project Settings → API. Copia <strong className="text-paper">Project URL</strong> e{' '}
            <strong className="text-paper">anon public</strong>, cola em cima.
          </li>
          <li>
            SQL Editor → New query → cola o texto abaixo → <strong className="text-paper">Run</strong>. Depois toca
            Ligar nuvem.
          </li>
        </ol>
      )}

      {!cloud.connected && (
        <div className="mt-3">
          <button
            type="button"
            onClick={() => void copySql()}
            className="mb-2 flex h-11 w-full items-center justify-center gap-2 rounded-2xl bg-raised text-sm font-semibold ring-1 ring-line"
          >
            <Copy size={16} /> {copied ? 'SQL copiado' : 'Copiar SQL'}
          </button>
          <pre className="max-h-40 overflow-auto whitespace-pre-wrap rounded-2xl bg-raised px-3 py-2 font-mono text-[10px] leading-relaxed text-blue-200 ring-1 ring-line">
            {SETUP_SQL}
          </pre>
        </div>
      )}
    </section>
  )
}
