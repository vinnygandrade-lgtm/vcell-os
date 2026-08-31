export async function compressImage(file: Blob, max = 1400, quality = 0.72) {
  try {
    const bitmap = await createImageBitmap(file)
    return drawToJpeg(bitmap, bitmap.width, bitmap.height, max, quality)
  } catch {
    const url = URL.createObjectURL(file)
    try {
      const image = await new Promise<HTMLImageElement>((resolve, reject) => {
        const img = new Image()
        img.onload = () => resolve(img)
        img.onerror = () => reject(new Error('Não deu para abrir essa foto'))
        img.src = url
      })
      return drawToJpeg(image, image.naturalWidth, image.naturalHeight, max, quality)
    } finally {
      URL.revokeObjectURL(url)
    }
  }
}

async function drawToJpeg(
  source: CanvasImageSource,
  sourceWidth: number,
  sourceHeight: number,
  max: number,
  quality: number,
) {
  const scale = Math.min(1, max / Math.max(sourceWidth, sourceHeight))
  const width = Math.max(1, Math.round(sourceWidth * scale))
  const height = Math.max(1, Math.round(sourceHeight * scale))
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas indisponível')
  ctx.drawImage(source, 0, 0, width, height)
  if (source instanceof ImageBitmap) source.close()
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (result) => (result ? resolve(result) : reject(new Error('Falha ao compactar foto'))),
      'image/jpeg',
      quality,
    )
  })
  return blob
}

export function blobToUrl(blob: Blob) {
  return URL.createObjectURL(blob)
}
