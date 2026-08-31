import { getAccessToken, invalidateToken } from './auth'
import {
  DRIVE_DATA_FILE,
  DRIVE_FOLDER_NAME,
  DRIVE_PHOTOS_FOLDER,
  loadDriveConfig,
  saveDriveConfig,
} from './config'

const DRIVE = 'https://www.googleapis.com/drive/v3'
const UPLOAD = 'https://www.googleapis.com/upload/drive/v3'

export function explainDriveError(err: unknown) {
  const text = err instanceof Error ? err.message : String(err ?? '')
  if (/Abra Ajustes|recusou|ID do cliente|carregar o Google/i.test(text)) return text
  if (/Failed to fetch|NetworkError|offline|Load failed/i.test(text)) {
    return 'Sem internet. O celular guardou; o Drive atualiza quando a rede voltar.'
  }
  if (/401|UNAUTHENTICATED|invalid authentication/i.test(text)) {
    return 'A sessão do Google expirou. Abra Ajustes e conecte o Drive de novo.'
  }
  if (/403|ACCESS_TOKEN_SCOPE|insufficient/i.test(text)) {
    return 'O Google não deixou gravar no Drive. Conecte de novo e aceite o acesso.'
  }
  if (/404|notFound/i.test(text)) {
    return 'Não achei a pasta no Drive. Conecte de novo para o app criar outra.'
  }
  return text || 'Não deu para falar com o Drive.'
}

async function driveFetch(url: string, init: RequestInit = {}, interactive = false) {
  const token = await getAccessToken(interactive)
  const res = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(init.headers ?? {}),
    },
  })
  if (res.status === 401) {
    invalidateToken()
    const retryToken = await getAccessToken(false)
    const retry = await fetch(url, {
      ...init,
      headers: {
        Authorization: `Bearer ${retryToken}`,
        ...(init.headers ?? {}),
      },
    })
    return retry
  }
  return res
}

async function readJson<T>(res: Response): Promise<T> {
  const text = await res.text()
  if (!res.ok) {
    throw new Error(text.slice(0, 240) || `Drive HTTP ${res.status}`)
  }
  return text ? (JSON.parse(text) as T) : ({} as T)
}

interface DriveFile {
  id: string
  name?: string
  mimeType?: string
  appProperties?: Record<string, string>
}

async function listFiles(q: string) {
  const files: DriveFile[] = []
  let pageToken = ''
  do {
    const params = new URLSearchParams({
      q,
      spaces: 'drive',
      pageSize: '100',
      fields: 'nextPageToken,files(id,name,mimeType,appProperties)',
    })
    if (pageToken) params.set('pageToken', pageToken)
    const res = await driveFetch(`${DRIVE}/files?${params}`)
    const data = await readJson<{ files?: DriveFile[]; nextPageToken?: string }>(res)
    files.push(...(data.files ?? []))
    pageToken = data.nextPageToken ?? ''
  } while (pageToken)
  return files
}

async function createFolder(name: string, parentId?: string, appProperties?: Record<string, string>) {
  const res = await driveFetch(`${DRIVE}/files?fields=id,name`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name,
      mimeType: 'application/vnd.google-apps.folder',
      parents: parentId ? [parentId] : undefined,
      appProperties,
    }),
  })
  return readJson<DriveFile>(res)
}

export async function multipartUpload(
  metadata: Record<string, unknown>,
  file: Blob,
  fields = 'id,name',
) {
  const boundary = 'vcell_boundary'
  const meta = JSON.stringify(metadata)
  const preamble = `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${meta}\r\n--${boundary}\r\nContent-Type: ${file.type || 'image/jpeg'}\r\n\r\n`
  const ending = `\r\n--${boundary}--`
  const body = new Blob([preamble, file, ending])
  const res = await driveFetch(`${UPLOAD}/files?uploadType=multipart&fields=${fields}`, {
    method: 'POST',
    headers: { 'Content-Type': `multipart/related; boundary=${boundary}` },
    body,
  })
  return readJson<DriveFile>(res)
}

export async function uploadMedia(fileId: string, body: Blob | string, contentType: string) {
  const res = await driveFetch(`${UPLOAD}/files/${fileId}?uploadType=media`, {
    method: 'PATCH',
    headers: { 'Content-Type': contentType },
    body,
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(text.slice(0, 240) || `Drive HTTP ${res.status}`)
  }
}

export async function downloadFile(fileId: string) {
  const res = await driveFetch(`${DRIVE}/files/${fileId}?alt=media`)
  if (!res.ok) {
    const text = await res.text()
    throw new Error(text.slice(0, 240) || `Drive HTTP ${res.status}`)
  }
  return res.blob()
}

export async function trashFile(fileId: string) {
  const res = await driveFetch(`${DRIVE}/files/${fileId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ trashed: true }),
  })
  if (!res.ok && res.status !== 404) {
    const text = await res.text()
    throw new Error(text.slice(0, 240) || `Drive HTTP ${res.status}`)
  }
}

export async function ensureDriveFolders(interactive = false) {
  void interactive
  let { folderId, photosFolderId, dataFileId } = loadDriveConfig()

  if (!folderId) {
    const existing = await listFiles(
      `name = '${DRIVE_FOLDER_NAME}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false and appProperties has { key='vcell' and value='root' }`,
    )
    folderId = existing[0]?.id ?? (await createFolder(DRIVE_FOLDER_NAME, undefined, { vcell: 'root' })).id
    saveDriveConfig({ folderId })
  }

  if (!photosFolderId) {
    const existing = await listFiles(
      `name = '${DRIVE_PHOTOS_FOLDER}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false and '${folderId}' in parents`,
    )
    photosFolderId =
      existing[0]?.id ?? (await createFolder(DRIVE_PHOTOS_FOLDER, folderId, { vcell: 'photos' })).id
    saveDriveConfig({ photosFolderId })
  }

  if (!dataFileId) {
    const existing = await listFiles(
      `name = '${DRIVE_DATA_FILE}' and trashed = false and '${folderId}' in parents`,
    )
    if (existing[0]) {
      dataFileId = existing[0].id
    } else {
      const created = await multipartUpload(
        {
          name: DRIVE_DATA_FILE,
          parents: [folderId],
          appProperties: { vcell: 'data' },
        },
        new Blob(['{}'], { type: 'application/json' }),
      )
      dataFileId = created.id
    }
    saveDriveConfig({ dataFileId })
  }

  return { folderId, photosFolderId, dataFileId }
}

export async function listPhotoFiles(photosFolderId: string) {
  return listFiles(`'${photosFolderId}' in parents and trashed = false`)
}

export async function firstConnect(interactive: boolean) {
  await getAccessToken(interactive)
  return ensureDriveFolders(interactive)
}
