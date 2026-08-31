import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Check, ChevronLeft } from 'lucide-react'
import { Chip, Field, inputClass, areaClass } from '@/components/Ui'
import { PhotoStrip } from '@/components/PhotoStrip'
import { useCustomers } from '@/hooks/useStore'
import { db, explainSaveError, uid } from '@/lib/db'
import {
  clearReceiveDraft,
  loadDraftPhotos,
  loadDraftText,
  saveDraftPhotos,
  saveDraftText,
} from '@/lib/draft'
import { compressImage } from '@/lib/photos'
import { BRANDS, COLORS, DEFECTS } from '@/lib/shop'
import { formatOs, formatPhone, onlyDigits } from '@/lib/format'
import type { Customer } from '@/lib/types'

type ErrorField = 'name' | 'device' | ''

export function NewOrderPage() {
  const navigate = useNavigate()
  const customers = useCustomers()
  const [seed] = useState(loadDraftText)
  const [phone, setPhone] = useState(seed?.phone ?? '')
  const [name, setName] = useState(seed?.name ?? '')
  const [customerId, setCustomerId] = useState<string | undefined>(seed?.customerId)
  const [brand, setBrand] = useState(seed?.brand ?? '')
  const [model, setModel] = useState(seed?.model ?? '')
  const [color, setColor] = useState(seed?.color ?? '')
  const [defect, setDefect] = useState(seed?.defect ?? '')
  const [imei, setImei] = useState(seed?.imei ?? '')
  const [unlock, setUnlock] = useState(seed?.unlock ?? '')
  const [notes, setNotes] = useState(seed?.notes ?? '')
  const [price, setPrice] = useState(seed?.price ?? '')
  const [more, setMore] = useState(seed?.more ?? false)
  const [photos, setPhotos] = useState<Blob[]>([])
  const [photosReady, setPhotosReady] = useState(false)
  const [saving, setSaving] = useState(false)
  const [savedNumber, setSavedNumber] = useState<number>()
  const [savedId, setSavedId] = useState<string>()
  const [error, setError] = useState('')
  const [errorField, setErrorField] = useState<ErrorField>('')
  const [photosFailed, setPhotosFailed] = useState(false)
  const nameRef = useRef<HTMLInputElement>(null)
  const deviceRef = useRef<HTMLDivElement>(null)
  const photosRef = useRef(photos)
  photosRef.current = photos

  useEffect(() => {
    let alive = true
    void loadDraftPhotos().then((stored) => {
      if (!alive) return
      if (stored.length) setPhotos(stored)
      setPhotosReady(true)
    })
    return () => {
      alive = false
    }
  }, [])

  function currentTextDraft() {
    return {
      phone,
      name,
      customerId,
      brand,
      model,
      color,
      defect,
      imei,
      unlock,
      notes,
      price,
      more,
    }
  }

  useEffect(() => {
    saveDraftText(currentTextDraft())
  }, [phone, name, customerId, brand, model, color, defect, imei, unlock, notes, price, more])

  useEffect(() => {
    if (!photosReady) return
    void saveDraftPhotos(photos)
  }, [photos, photosReady])

  useEffect(() => {
    function persist() {
      saveDraftText(currentTextDraft())
      void saveDraftPhotos(photosRef.current)
    }
    const onHide = () => persist()
    window.addEventListener('pagehide', onHide)
    document.addEventListener('visibilitychange', onHide)
    return () => {
      window.removeEventListener('pagehide', onHide)
      document.removeEventListener('visibilitychange', onHide)
    }
  }, [phone, name, customerId, brand, model, color, defect, imei, unlock, notes, price, more])

  async function persistDraft() {
    saveDraftText(currentTextDraft())
    await saveDraftPhotos(photosRef.current)
  }

  const digits = onlyDigits(phone)
  const suggestions = useMemo(() => {
    if (digits.length < 3 && name.trim().length < 2) return []
    const n = name.trim().toLowerCase()
    return customers
      .filter((customer) => {
        const phoneHit = digits.length >= 3 && customer.phone.includes(digits)
        const nameHit = n.length >= 2 && customer.name.toLowerCase().includes(n)
        return phoneHit || nameHit
      })
      .slice(0, 4)
  }, [customers, digits, name])

  function pickCustomer(customer: Customer) {
    setCustomerId(customer.id)
    setName(customer.name)
    setPhone(formatPhone(customer.phone))
  }

  async function addPhotos(files: FileList) {
    try {
      const next: Blob[] = []
      for (const file of Array.from(files)) {
        next.push(await compressImage(file))
      }
      const merged = [...photosRef.current, ...next]
      photosRef.current = merged
      setPhotos(merged)
      setError('')
      await saveDraftPhotos(merged)
    } catch (err) {
      setError(
        explainSaveError(err).includes('espaço')
          ? explainSaveError(err)
          : 'Não deu para ler essa foto. Tente de novo pela câmera ou pela galeria.',
      )
    }
  }

  function showError(message: string, field: ErrorField = '') {
    setError(message)
    setErrorField(field)
    if (field === 'name') {
      nameRef.current?.focus()
      nameRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
    if (field === 'device') {
      deviceRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }

  async function save() {
    setError('')
    setErrorField('')
    if (!name.trim()) {
      showError('Falta o nome de quem deixou o celular.', 'name')
      return
    }
    if (!model.trim() && !brand) {
      showError('Falta a marca ou o modelo do celular.', 'device')
      return
    }
    setSaving(true)
    try {
      const now = Date.now()
      let cid = customerId
      const phoneDigits = onlyDigits(phone)
      const number = await db.transaction('rw', db.customers, db.orders, db.meta, async () => {
        let customerKey = cid
        if (!customerKey) {
          const existing = phoneDigits
            ? await db.customers.where('phone').equals(phoneDigits).first()
            : undefined
          if (existing) {
            customerKey = existing.id
            await db.customers.update(existing.id, { name: name.trim(), updatedAt: now })
          } else {
            customerKey = uid()
            await db.customers.add({
              id: customerKey,
              name: name.trim(),
              phone: phoneDigits,
              createdAt: now,
              updatedAt: now,
            })
          }
        } else {
          await db.customers.update(customerKey, {
            name: name.trim(),
            phone: phoneDigits,
            updatedAt: now,
          })
        }
        const row = await db.meta.get('orderSeq')
        const next = (row?.value ?? 0) + 1
        await db.meta.put({ key: 'orderSeq', value: next })
        const orderId = uid()
        const parsedPrice = price.trim()
          ? Number(price.replace(/\./g, '').replace(',', '.'))
          : null
        await db.orders.add({
          id: orderId,
          number: next,
          customerId: customerKey,
          brand,
          model: model.trim(),
          color,
          imei: onlyDigits(imei),
          unlock: unlock.trim(),
          defect: defect.trim(),
          notes: notes.trim(),
          price: parsedPrice !== null && Number.isFinite(parsedPrice) ? parsedPrice : null,
          status: 'received',
          receivedAt: now,
          readyAt: null,
          deliveredAt: null,
          createdAt: now,
          updatedAt: now,
        })
        return { next, orderId }
      })

      if (photos.length) {
        try {
          await db.photos.bulkAdd(
            photos.map((blob) => ({
              id: uid(),
              orderId: number.orderId,
              blob,
              createdAt: Date.now(),
            })),
          )
        } catch {
          setPhotosFailed(true)
        }
      }
      setSavedNumber(number.next)
      setSavedId(number.orderId)
      await clearReceiveDraft()
    } catch (err) {
      showError(explainSaveError(err))
    } finally {
      setSaving(false)
    }
  }

  if (savedNumber && savedId) {
    return (
      <div className="flex min-h-dvh flex-col px-5 pb-8 pt-[max(1.5rem,env(safe-area-inset-top))]">
        <div className="flex flex-1 flex-col items-center justify-center text-center">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red text-white shadow-[0_0_40px_rgba(225,6,19,0.45)]">
            <Check size={32} />
          </div>
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-mute">Cole no aparelho</p>
          <p className="mt-2 font-display text-7xl tracking-wide text-red">{formatOs(savedNumber)}</p>
          <p className="mt-3 max-w-xs text-sm text-mute">
            Escreva este número na etiqueta ou na capa. Depois é só buscar por ele.
          </p>
          {photosFailed && (
            <p className="mt-3 rounded-2xl bg-amber-500/15 px-3 py-2 text-sm text-amber-200">
              A OS foi salva, mas as fotos não couberam neste celular. Abra a ordem e tire as fotos de novo.
            </p>
          )}
        </div>
        <div className="grid gap-2">
          <button
            type="button"
            onClick={() => navigator.clipboard.writeText(formatOs(savedNumber))}
            className="h-12 rounded-2xl bg-raised font-semibold ring-1 ring-line"
          >
            Copiar número
          </button>
          <Link
            to={`/os/${savedId}`}
            className="flex h-12 items-center justify-center rounded-2xl bg-red font-semibold text-white"
          >
            Ver ordem
          </Link>
          <button
            type="button"
            onClick={() => navigate('/')}
            className="h-12 text-sm text-mute"
          >
            Voltar para a loja
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-dvh flex-col pb-[calc(8rem+env(safe-area-inset-bottom))]">
      <header className="sticky top-0 z-30 flex items-center gap-2 bg-ink/90 px-2 py-3 backdrop-blur pt-[max(0.75rem,env(safe-area-inset-top))]">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="flex h-10 w-10 items-center justify-center rounded-full text-paper"
          aria-label="Voltar"
        >
          <ChevronLeft />
        </button>
        <div>
          <p className="font-display text-xl leading-none tracking-wide">Receber aparelho</p>
          <p className="text-xs text-mute">Cliente, celular e foto — em um minuto</p>
        </div>
      </header>

      <div className="flex flex-col gap-5 px-4">
        <section className="rounded-3xl bg-panel p-4 ring-1 ring-line">
          <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-mute">
            Cliente
          </p>
          <Field label="WhatsApp do cliente">
            <input
              value={phone}
              onChange={(e) => {
                setPhone(formatPhone(e.target.value))
                setCustomerId(undefined)
              }}
              inputMode="tel"
              placeholder="WhatsApp com DDD"
              className={inputClass}
              autoComplete="tel"
            />
          </Field>
          <p className="mt-1.5 text-xs text-mute">Número para ligar ou mandar mensagem. Não é o modelo do celular.</p>
          <div className="mt-3">
            <Field label="Nome do cliente">
              <input
                value={name}
                onChange={(e) => {
                  setName(e.target.value)
                  setCustomerId(undefined)
                }}
                placeholder="Quem deixou o aparelho"
                className={`${inputClass} ${errorField === 'name' ? 'ring-2 ring-red' : ''}`}
                autoCapitalize="words"
                ref={nameRef}
              />
            </Field>
          </div>
          {suggestions.length > 0 && !customerId && (
            <div className="mt-3 grid gap-2">
              {suggestions.map((customer) => (
                <button
                  key={customer.id}
                  type="button"
                  onClick={() => pickCustomer(customer)}
                  className="rounded-2xl bg-raised px-3 py-3 text-left ring-1 ring-line"
                >
                  <p className="font-semibold">{customer.name}</p>
                  <p className="text-xs text-mute">{formatPhone(customer.phone)}</p>
                </button>
              ))}
            </div>
          )}
          {customerId && (
            <p className="mt-2 text-xs font-medium text-emerald-300">Cliente já cadastrado</p>
          )}
        </section>

        <div
          ref={deviceRef}
          className={`rounded-3xl bg-panel p-4 ring-1 ${errorField === 'device' ? 'ring-2 ring-red' : 'ring-line'}`}
        >
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-mute">Aparelho</p>
          <div className="no-scrollbar flex gap-2 overflow-x-auto pb-1">
            {BRANDS.map((item) => (
              <Chip key={item} label={item} active={brand === item} onClick={() => setBrand(item)} />
            ))}
          </div>
          <input
            value={model}
            onChange={(e) => setModel(e.target.value)}
            placeholder="Modelo do celular — ex: A15, iPhone 11"
            className={`${inputClass} mt-3 ${errorField === 'device' ? 'ring-2 ring-red' : ''}`}
          />
          <div className="no-scrollbar mt-3 flex gap-2 overflow-x-auto">
            {COLORS.map((item) => (
              <Chip key={item} label={item} active={color === item} onClick={() => setColor(item)} />
            ))}
          </div>
        </div>

        <section className="rounded-3xl bg-panel p-4 ring-1 ring-line">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-mute">Fotos do celular</p>
          <PhotoStrip
            photos={[]}
            pending={photos}
            onAdd={addPhotos}
            onBeforePick={persistDraft}
            onRemovePending={(i) => setPhotos((c) => c.filter((_, idx) => idx !== i))}
          />
          <p className="mt-2 text-xs leading-relaxed text-mute">
            Tira foto da tela, da traseira e do IMEI. Depois não tem briga.
          </p>
        </section>

        <section className="rounded-3xl bg-panel p-4 ring-1 ring-line">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-mute">O que tem</p>
          <div className="no-scrollbar flex gap-2 overflow-x-auto pb-1">
            {DEFECTS.map((item) => (
              <Chip
                key={item}
                label={item}
                active={defect === item}
                onClick={() => setDefect(defect === item ? '' : item)}
              />
            ))}
          </div>
          <textarea
            value={defect}
            onChange={(e) => setDefect(e.target.value)}
            placeholder="Detalhe do defeito, se quiser"
            className={`${areaClass} mt-3`}
          />
        </section>

        <button
          type="button"
          onClick={() => setMore((v) => !v)}
          className="text-left text-sm font-medium text-mute"
        >
          {more ? 'Menos detalhes' : 'IMEI, senha e valor'}
        </button>
        {more && (
          <section className="grid gap-3 rounded-3xl bg-panel p-4 ring-1 ring-line">
            <Field label="IMEI">
              <input value={imei} onChange={(e) => setImei(onlyDigits(e.target.value).slice(0, 15))} inputMode="numeric" className={inputClass} />
            </Field>
            <Field label="Senha ou padrão">
              <input value={unlock} onChange={(e) => setUnlock(e.target.value)} className={inputClass} />
            </Field>
            <Field label="Valor combinado">
              <input value={price} onChange={(e) => setPrice(e.target.value)} inputMode="decimal" placeholder="R$ 0,00" className={inputClass} />
            </Field>
            <Field label="Observação">
              <textarea value={notes} onChange={(e) => setNotes(e.target.value)} className={areaClass} />
            </Field>
          </section>
        )}

        {error && (
          <p className="rounded-2xl bg-red/15 px-3 py-2 text-sm font-medium text-red-hot ring-1 ring-red/30">
            {error}
          </p>
        )}
      </div>

      <div className="fixed inset-x-0 bottom-0 z-40 mx-auto w-full max-w-[430px] bg-gradient-to-t from-ink via-ink to-transparent px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-4">
        {error && (
          <p
            role="alert"
            className="mb-2 rounded-2xl bg-red px-3 py-2.5 text-sm font-semibold text-white shadow-[0_8px_20px_rgba(225,6,19,0.35)]"
          >
            {error}
          </p>
        )}
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="flex h-14 w-full items-center justify-center rounded-2xl bg-red text-base font-semibold text-white disabled:opacity-60"
        >
          {saving ? 'Salvando…' : 'Salvar e gerar OS'}
        </button>
      </div>
    </div>
  )
}
