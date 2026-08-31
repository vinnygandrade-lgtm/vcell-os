import type { ReactNode } from 'react'
import { LOCATIONS } from '@/lib/shop'
import { STATUS_LABEL, type OrderStatus } from '@/lib/types'
import { statusTone } from '@/lib/format'

export function StatusBadge({ status }: { status: OrderStatus }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold tracking-wide ring-1 ${statusTone(status)}`}
    >
      {STATUS_LABEL[status]}
    </span>
  )
}

export function Chip({
  label,
  active,
  onClick,
}: {
  label: string
  active?: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`shrink-0 rounded-full px-3.5 py-2 text-sm font-medium transition ${
        active
          ? 'bg-red text-white shadow-[0_0_20px_rgba(225,6,19,0.35)]'
          : 'bg-raised text-paper/80 ring-1 ring-line hover:bg-panel'
      }`}
    >
      {label}
    </button>
  )
}

export function Field({
  label,
  children,
}: {
  label: string
  children: ReactNode
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.16em] text-mute">
        {label}
      </span>
      {children}
    </label>
  )
}

export const inputClass =
  'w-full rounded-2xl border-0 bg-raised px-4 py-3.5 text-[16px] text-paper outline-none ring-1 ring-line placeholder:text-mute/70 focus:ring-2 focus:ring-red/70'

export const areaClass = `${inputClass} min-h-24 resize-none`

export function LocationPicker({
  value,
  onChange,
}: {
  value: string
  onChange: (value: string) => void
}) {
  return (
    <div>
      <div className="no-scrollbar flex gap-2 overflow-x-auto pb-1">
        {LOCATIONS.map((item) => (
          <Chip
            key={item}
            label={item}
            active={value === item}
            onClick={() => onChange(value === item ? '' : item)}
          />
        ))}
      </div>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Ou escreva: Gaveta 3, saco do fundo…"
        className={`${inputClass} mt-3`}
        autoCapitalize="sentences"
      />
    </div>
  )
}
