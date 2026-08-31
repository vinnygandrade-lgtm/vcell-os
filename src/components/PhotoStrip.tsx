import { useRef } from 'react'
import { Camera, ImagePlus, X } from 'lucide-react'
import { useObjectUrl } from '@/hooks/useStore'
import type { Photo } from '@/lib/types'

function Thumb({ blob, onRemove }: { blob: Blob; onRemove?: () => void }) {
  const url = useObjectUrl(blob)
  if (!url) return <div className="h-24 w-24 rounded-2xl bg-raised" />
  return (
    <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-2xl">
      <img src={url} alt="" className="h-full w-full object-cover" />
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-black/70 text-white"
          aria-label="Remover foto"
        >
          <X size={14} />
        </button>
      )}
    </div>
  )
}

export function PhotoStrip({
  photos,
  pending,
  onAdd,
  onRemovePending,
  onRemoveSaved,
  onBeforePick,
}: {
  photos: Photo[]
  pending?: Blob[]
  onAdd: (files: FileList) => void
  onRemovePending?: (index: number) => void
  onRemoveSaved?: (id: string) => void
  onBeforePick?: () => void | Promise<void>
}) {
  const cameraRef = useRef<HTMLInputElement>(null)
  const galleryRef = useRef<HTMLInputElement>(null)

  async function openPicker(input: HTMLInputElement | null) {
    await onBeforePick?.()
    input?.click()
  }

  return (
    <div>
      <div className="no-scrollbar flex gap-2 overflow-x-auto pb-1">
        {photos.map((photo) => (
          <Thumb
            key={photo.id}
            blob={photo.blob}
            onRemove={onRemoveSaved ? () => onRemoveSaved(photo.id) : undefined}
          />
        ))}
        {pending?.map((blob, index) => (
          <Thumb
            key={`pending-${index}`}
            blob={blob}
            onRemove={onRemovePending ? () => onRemovePending(index) : undefined}
          />
        ))}
        <button
          type="button"
          onPointerDown={() => {
            void onBeforePick?.()
          }}
          onClick={() => openPicker(cameraRef.current)}
          className="flex h-24 w-24 shrink-0 flex-col items-center justify-center gap-1 rounded-2xl bg-red text-white shadow-[0_8px_24px_rgba(225,6,19,0.35)]"
        >
          <Camera size={22} />
          <span className="text-[11px] font-semibold">Câmera</span>
        </button>
        <button
          type="button"
          onPointerDown={() => {
            void onBeforePick?.()
          }}
          onClick={() => openPicker(galleryRef.current)}
          className="flex h-24 w-24 shrink-0 flex-col items-center justify-center gap-1 rounded-2xl bg-raised text-paper ring-1 ring-line"
        >
          <ImagePlus size={22} />
          <span className="text-[11px] font-semibold">Galeria</span>
        </button>
      </div>
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          if (e.target.files) onAdd(e.target.files)
          e.target.value = ''
        }}
      />
      <input
        ref={galleryRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => {
          if (e.target.files) onAdd(e.target.files)
          e.target.value = ''
        }}
      />
    </div>
  )
}
