const KEY = 'vcell-drive'

export const DRIVE_FOLDER_NAME = 'Vcell OS'
export const DRIVE_PHOTOS_FOLDER = 'fotos'
export const DRIVE_DATA_FILE = 'vcell-data.json'
export const DRIVE_SCOPES = [
  'https://www.googleapis.com/auth/drive.file',
  'https://www.googleapis.com/auth/userinfo.email',
].join(' ')

export interface DriveConfig {
  clientId: string
  connected: boolean
  folderId: string
  photosFolderId: string
  dataFileId: string
  email: string
  lastSyncAt: number
  lastError: string
}

const empty = (): DriveConfig => ({
  clientId: '',
  connected: false,
  folderId: '',
  photosFolderId: '',
  dataFileId: '',
  email: '',
  lastSyncAt: 0,
  lastError: '',
})

export function loadDriveConfig(): DriveConfig {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return empty()
    return { ...empty(), ...JSON.parse(raw) }
  } catch {
    return empty()
  }
}

export function saveDriveConfig(patch: Partial<DriveConfig>) {
  const next = { ...loadDriveConfig(), ...patch }
  localStorage.setItem(KEY, JSON.stringify(next))
  return next
}

export function isDriveConnected() {
  const cfg = loadDriveConfig()
  return cfg.connected && Boolean(cfg.clientId.trim())
}

export function jsOrigin() {
  return window.location.origin
}
