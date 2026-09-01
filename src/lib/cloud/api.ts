import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { CLOUD_BUCKET, CLOUD_PHOTOS_DIR, loadCloudConfig } from './config'

let client: SupabaseClient | null = null
let clientKey = ''

export function explainCloudError(err: unknown) {
  const text = err instanceof Error ? err.message : String(err ?? '')
  if (/Bucket not found|not found/i.test(text)) {
    return 'Falta criar o espaço vcell. Cole o texto SQL de Ajustes e aperte Run.'
  }
  if (/row-level security|RLS|policy|permission|not allowed|401|403/i.test(text)) {
    return 'O Supabase bloqueou. Cole o texto SQL de Ajustes, aperte Run, e tente de novo.'
  }
  if (/Failed to fetch|NetworkError|offline|Load failed/i.test(text)) {
    return 'Sem internet. O celular guardou; a nuvem atualiza quando a rede voltar.'
  }
  if (/Invalid API key|JWT|anon/i.test(text)) {
    return 'A URL ou a chave estão erradas. Copia de novo em Settings → API no Supabase.'
  }
  return text || 'Não deu para falar com a nuvem.'
}

export function getCloudClient() {
  const { url, anonKey } = loadCloudConfig()
  const key = `${url}|${anonKey}`
  if (!url || !anonKey) throw new Error('Cole a URL e a chave do Supabase em Ajustes.')
  if (!client || clientKey !== key) {
    client = createClient(url.replace(/\/$/, ''), anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
    clientKey = key
  }
  return client
}

function throwIf(error: { message?: string } | null) {
  if (error?.message) throw new Error(error.message)
}

export async function downloadData() {
  const { data, error } = await getCloudClient().storage.from(CLOUD_BUCKET).download('data.json')
  if (error) {
    if (/not found|Object not found/i.test(error.message)) return null
    throwIf(error)
  }
  return data
}

export async function uploadData(json: string) {
  const { error } = await getCloudClient()
    .storage.from(CLOUD_BUCKET)
    .upload('data.json', new Blob([json], { type: 'application/json' }), {
      upsert: true,
      contentType: 'application/json',
    })
  throwIf(error)
}

export async function listPhotoNames() {
  const { data, error } = await getCloudClient().storage.from(CLOUD_BUCKET).list(CLOUD_PHOTOS_DIR, {
    limit: 1000,
  })
  throwIf(error)
  return (data ?? []).map((row) => row.name).filter((name) => name.endsWith('.jpg'))
}

export async function uploadPhoto(id: string, blob: Blob) {
  const { error } = await getCloudClient()
    .storage.from(CLOUD_BUCKET)
    .upload(`${CLOUD_PHOTOS_DIR}/${id}.jpg`, blob, {
      upsert: true,
      contentType: blob.type || 'image/jpeg',
    })
  throwIf(error)
}

export async function downloadPhoto(id: string) {
  const { data, error } = await getCloudClient()
    .storage.from(CLOUD_BUCKET)
    .download(`${CLOUD_PHOTOS_DIR}/${id}.jpg`)
  throwIf(error)
  return data
}

export async function removePhoto(id: string) {
  const { error } = await getCloudClient().storage.from(CLOUD_BUCKET).remove([`${CLOUD_PHOTOS_DIR}/${id}.jpg`])
  if (error && !/not found/i.test(error.message)) throwIf(error)
}

export async function pingCloud() {
  const { error } = await getCloudClient().storage.from(CLOUD_BUCKET).list('', { limit: 1 })
  throwIf(error)
}
