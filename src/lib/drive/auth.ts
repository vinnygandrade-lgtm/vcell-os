import { DRIVE_SCOPES, loadDriveConfig } from './config'

let token = ''
let tokenAt = 0
let client: GoogleTokenClient | undefined
let clientIdUsed = ''

function tokenFresh() {
  return Boolean(token) && Date.now() - tokenAt < 50 * 60 * 1000
}

export function loadGis(): Promise<void> {
  if (window.google?.accounts?.oauth2) return Promise.resolve()
  return new Promise((resolve, reject) => {
    const existing = document.querySelector('script[data-vcell-gis]')
    if (existing) {
      existing.addEventListener('load', () => resolve())
      existing.addEventListener('error', () => reject(new Error('Não deu para carregar o Google.')))
      return
    }
    const script = document.createElement('script')
    script.src = 'https://accounts.google.com/gsi/client'
    script.async = true
    script.dataset.vcellGis = '1'
    script.onload = () => resolve()
    script.onerror = () => reject(new Error('Não deu para carregar o Google. Confira a internet.'))
    document.head.appendChild(script)
  })
}

function ensureClient(clientId: string) {
  const oauth = window.google?.accounts?.oauth2
  if (!oauth) throw new Error('O Google ainda não carregou. Tente de novo.')
  if (client && clientIdUsed === clientId) return client
  client = oauth.initTokenClient({
    client_id: clientId,
    scope: DRIVE_SCOPES,
    callback: () => {},
  })
  clientIdUsed = clientId
  return client
}

function requestToken(clientId: string, prompt: '' | 'consent'): Promise<string> {
  const tokenClient = ensureClient(clientId)
  return new Promise((resolve, reject) => {
    tokenClient.callback = (response) => {
      if (response.error || !response.access_token) {
        reject(
          new Error(
            response.error === 'access_denied'
              ? 'Você recusou o acesso ao Drive.'
              : response.error_description || 'Não deu para entrar no Google.',
          ),
        )
        return
      }
      token = response.access_token
      tokenAt = Date.now()
      resolve(token)
    }
    tokenClient.requestAccessToken({ prompt })
  })
}

export async function getAccessToken(interactive: boolean) {
  if (tokenFresh()) return token
  const clientId = loadDriveConfig().clientId.trim()
  if (!clientId) throw new Error('Falta o ID do cliente Google em Ajustes.')
  await loadGis()
  try {
    return await requestToken(clientId, interactive ? 'consent' : '')
  } catch (err) {
    if (!interactive) {
      throw new Error('Abra Ajustes e toque em Conectar Drive de novo.')
    }
    throw err
  }
}

export function currentToken() {
  return tokenFresh() ? token : ''
}

export function clearToken() {
  const oauth = window.google?.accounts?.oauth2
  if (token && oauth) {
    try {
      oauth.revoke(token)
    } catch {
      // ignore
    }
  }
  token = ''
  tokenAt = 0
}

export function invalidateToken() {
  token = ''
  tokenAt = 0
}

export async function fetchUserEmail(accessToken: string) {
  const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!res.ok) return ''
  const data = (await res.json()) as { email?: string }
  return data.email ?? ''
}
