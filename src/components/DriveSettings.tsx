import { useState } from 'react'
import { Cloud, Copy, ExternalLink, RefreshCw } from 'lucide-react'
import { Field, inputClass } from '@/components/Ui'
import { useDriveStatus } from '@/hooks/useDrive'
import {
  connectDrive,
  disconnectDrive,
  DRIVE_FOLDER_NAME,
  explainDriveError,
  getDriveUiStatus,
  jsOrigin,
  loadDriveConfig,
  saveDriveConfig,
  syncNow,
} from '@/lib/drive'
import { formatAgo } from '@/lib/format'

const LIVE_ORIGIN = 'https://vinnygandrade-lgtm.github.io'
const LOCAL_ORIGIN = 'http://localhost:5173'

export function DriveSettings() {
  const drive = useDriveStatus()
  const [clientId, setClientId] = useState(() => loadDriveConfig().clientId)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [copied, setCopied] = useState('')
  const origin = jsOrigin()
  const cfg = loadDriveConfig()

  async function copy(label: string, value: string) {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(label)
      window.setTimeout(() => setCopied(''), 2000)
    } catch {
      setCopied('')
    }
  }

  async function connect() {
    setBusy(true)
    setMessage('')
    saveDriveConfig({ clientId: clientId.trim() })
    try {
      await connectDrive(clientId)
      const status = getDriveUiStatus()
      setMessage(
        status.lastError || 'Drive ligado. As OS e as fotos vão para a pasta Vcell OS.',
      )
    } catch (err) {
      setMessage(explainDriveError(err))
    } finally {
      setBusy(false)
    }
  }

  async function sync() {
    setBusy(true)
    setMessage('')
    try {
      await syncNow()
      setMessage('Sincronizado com o Drive.')
    } catch (err) {
      setMessage(explainDriveError(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="mt-4 rounded-3xl bg-panel p-4 ring-1 ring-line">
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-mute">Google Drive</p>
      <p className="mt-2 text-sm leading-relaxed text-mute">
        Cópia das OS e das fotos na sua conta de 5 TB. O celular continua funcionando sem internet;
        quando a rede volta, o app manda o que faltava. Use o site da Vcell no GitHub, não o Wi-Fi
        da loja — o Google só aceita o endereço seguro.
      </p>

      {drive.connected ? (
        <div className="mt-3 rounded-2xl bg-raised px-3 py-3 ring-1 ring-line">
          <p className="flex items-center gap-2 text-sm font-semibold text-emerald-300">
            <Cloud size={16} /> Drive ligado
          </p>
          {drive.email && <p className="mt-1 truncate text-xs text-mute">{drive.email}</p>}
          <p className="mt-1 text-xs text-mute">
            {drive.syncing
              ? 'Enviando agora…'
              : drive.lastSyncAt
                ? `Última cópia ${formatAgo(drive.lastSyncAt)}`
                : 'Ainda não enviou'}
          </p>
          {drive.lastError && <p className="mt-2 text-sm text-red-hot">{drive.lastError}</p>}
        </div>
      ) : (
        <p className="mt-3 text-sm text-amber-200">Ainda não está ligado. Faz uma vez no computador, é mais fácil.</p>
      )}

      <div className="mt-3">
        <Field label="ID do cliente Google">
          <input
            value={clientId}
            onChange={(e) => setClientId(e.target.value.trim())}
            placeholder="….apps.googleusercontent.com"
            className={`${inputClass} font-mono text-sm`}
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
          />
        </Field>
      </div>

      <div className="mt-3 grid gap-2">
        {drive.connected ? (
          <>
            <button
              type="button"
              disabled={busy}
              onClick={() => void sync()}
              className="flex h-12 items-center justify-center gap-2 rounded-2xl bg-red font-semibold text-white disabled:opacity-60"
            >
              <RefreshCw size={16} /> {busy ? 'Sincronizando…' : 'Sincronizar agora'}
            </button>
            {cfg.folderId && (
              <a
                href={`https://drive.google.com/drive/folders/${cfg.folderId}`}
                target="_blank"
                rel="noreferrer"
                className="flex h-12 items-center justify-center gap-2 rounded-2xl bg-raised font-semibold ring-1 ring-line"
              >
                <ExternalLink size={16} /> Abrir pasta {DRIVE_FOLDER_NAME}
              </a>
            )}
            <button
              type="button"
              disabled={busy}
              onClick={() => disconnectDrive()}
              className="h-12 rounded-2xl text-sm text-mute"
            >
              Desconectar
            </button>
          </>
        ) : (
          <button
            type="button"
            disabled={busy || !clientId}
            onClick={() => void connect()}
            className="flex h-12 items-center justify-center gap-2 rounded-2xl bg-red font-semibold text-white disabled:opacity-60"
          >
            <Cloud size={16} /> {busy ? 'Abrindo o Google…' : 'Conectar Drive'}
          </button>
        )}
      </div>
      {message && (
        <p className={`mt-2 text-sm ${/ligado|Sincronizado/i.test(message) ? 'text-emerald-300' : 'text-red-hot'}`}>
          {message}
        </p>
      )}

      {!drive.connected && (
        <ol className="mt-4 list-decimal space-y-2 pl-5 text-sm leading-relaxed text-mute">
          <li>
            No computador, abra{' '}
            <a
              className="text-blue-200 underline"
              href="https://console.cloud.google.com/"
              target="_blank"
              rel="noreferrer"
            >
              console.cloud.google.com
            </a>{' '}
            com o Gmail da loja.
          </li>
          <li>Crie um projeto, nome Vcell.</li>
          <li>
            Ative a{' '}
            <a
              className="text-blue-200 underline"
              href="https://console.cloud.google.com/apis/library/drive.googleapis.com"
              target="_blank"
              rel="noreferrer"
            >
              Google Drive API
            </a>
            .
          </li>
          <li>
            Tela de consentimento OAuth: tipo <strong className="text-paper">Externo</strong>. Em
            públicos de teste, coloque o mesmo Gmail.
          </li>
          <li>
            Credenciais → criar ID do cliente OAuth →{' '}
            <strong className="text-paper">Aplicativo da Web</strong>. Se pedir URI de
            redirecionamento, cola o endereço do site.
          </li>
          <li>
            Em origens JavaScript autorizadas, adicione estes dois e salve:
            <button
              type="button"
              onClick={() => void copy('site', LIVE_ORIGIN)}
              className="mt-2 flex w-full items-center justify-between gap-2 rounded-2xl bg-raised px-3 py-2 text-left font-mono text-xs text-blue-200 ring-1 ring-line"
            >
              {LIVE_ORIGIN}
              <Copy size={14} />
            </button>
            <button
              type="button"
              onClick={() => void copy('local', LOCAL_ORIGIN)}
              className="mt-2 flex w-full items-center justify-between gap-2 rounded-2xl bg-raised px-3 py-2 text-left font-mono text-xs text-blue-200 ring-1 ring-line"
            >
              {LOCAL_ORIGIN}
              <Copy size={14} />
            </button>
            {origin !== LIVE_ORIGIN && origin !== LOCAL_ORIGIN && (
              <button
                type="button"
                onClick={() => void copy('esta', origin)}
                className="mt-2 flex w-full items-center justify-between gap-2 rounded-2xl bg-raised px-3 py-2 text-left font-mono text-xs text-blue-200 ring-1 ring-line"
              >
                {origin}
                <Copy size={14} />
              </button>
            )}
            {copied && <p className="mt-1 text-xs text-emerald-300">Copiou {copied}.</p>}
          </li>
          <li>Copia o ID do cliente (termina com .apps.googleusercontent.com), cola em cima e toca Conectar Drive.</li>
        </ol>
      )}
    </section>
  )
}
