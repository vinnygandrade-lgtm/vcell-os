const KEY = 'vcell-cloud'
export const CLOUD_BUCKET = 'vcell'
export const CLOUD_DATA_FILE = 'data.json'
export const CLOUD_PHOTOS_DIR = 'fotos'

export interface CloudConfig {
  url: string
  anonKey: string
  connected: boolean
  lastSyncAt: number
  lastError: string
}

const empty = (): CloudConfig => ({
  url: '',
  anonKey: '',
  connected: false,
  lastSyncAt: 0,
  lastError: '',
})

export function loadCloudConfig(): CloudConfig {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return empty()
    return { ...empty(), ...JSON.parse(raw) }
  } catch {
    return empty()
  }
}

export function saveCloudConfig(patch: Partial<CloudConfig>) {
  const next = { ...loadCloudConfig(), ...patch }
  localStorage.setItem(KEY, JSON.stringify(next))
  return next
}

export function isCloudConnected() {
  const cfg = loadCloudConfig()
  return cfg.connected && Boolean(cfg.url.trim()) && Boolean(cfg.anonKey.trim())
}

export const SETUP_SQL = `insert into storage.buckets (id, name, public)
values ('vcell', 'vcell', false)
on conflict (id) do nothing;

drop policy if exists "vcell select" on storage.objects;
drop policy if exists "vcell insert" on storage.objects;
drop policy if exists "vcell update" on storage.objects;
drop policy if exists "vcell delete" on storage.objects;

create policy "vcell select" on storage.objects for select using (bucket_id = 'vcell');
create policy "vcell insert" on storage.objects for insert with check (bucket_id = 'vcell');
create policy "vcell update" on storage.objects for update using (bucket_id = 'vcell');
create policy "vcell delete" on storage.objects for delete using (bucket_id = 'vcell');`
