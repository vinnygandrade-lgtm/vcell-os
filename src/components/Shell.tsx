import type { ReactNode } from 'react'
import { shop } from '@/lib/shop'

export function PhoneFrame({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-dvh bg-[#05060a]">
      <div className="relative mx-auto min-h-dvh w-full max-w-[430px] overflow-x-hidden bg-ink text-paper shadow-[0_0_80px_rgba(225,6,19,0.12)]">
        <div className="pointer-events-none absolute inset-x-0 top-0 z-20 h-24 bg-gradient-to-b from-red/20 to-transparent" />
        {children}
      </div>
    </div>
  )
}

export function BrandMark({ compact = false }: { compact?: boolean }) {
  return (
    <img
      src="/logo.png"
      alt={shop.name}
      className={compact ? 'h-9 w-auto max-w-[210px] object-contain' : 'h-11 w-auto max-w-[240px] object-contain'}
    />
  )
}
