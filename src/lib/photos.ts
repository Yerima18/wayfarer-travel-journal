import { createClient } from '@/lib/supabase/client'

export type Photo = { id: string; path: string; url: string }
export type PendingPhoto = { key: string; blob: Blob; previewUrl: string }
export type PhotoDraft = { kept: Photo[]; added: PendingPhoto[] }

export const MAX_PHOTOS_PER_PLACE = 5

const BUCKET = 'entry-photos'
const SIGNED_URL_SECONDS = 24 * 60 * 60
const MAX_EDGE_PX = 1600
const JPEG_QUALITY = 0.82

/**
 * Re-encodes a picture as a smaller JPEG. Drawing it on a canvas also drops the hidden
 * metadata (including GPS position) that phone cameras embed.
 */
export async function shrinkImage(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
  const scale = Math.min(1, MAX_EDGE_PX / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * scale)
  canvas.height = Math.round(bitmap.height * scale)
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Canvas is not available.')
  context.fillStyle = '#ffffff'
  context.fillRect(0, 0, canvas.width, canvas.height)
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close()
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Could not encode the image.'))), 'image/jpeg', JPEG_QUALITY)
  })
}

async function signedUrls(paths: string[]): Promise<Map<string, string>> {
  const { data, error } = await createClient().storage.from(BUCKET).createSignedUrls(paths, SIGNED_URL_SECONDS)
  if (error) throw error
  const urls = new Map<string, string>()
  data.forEach((item) => {
    if (item.path && item.signedUrl) urls.set(item.path, item.signedUrl)
  })
  return urls
}

/** Every photo of the signed-in user, grouped by the place it belongs to. */
export async function loadPhotos(): Promise<Record<string, Photo[]>> {
  const { data, error } = await createClient().from('entry_photos').select('id,entry_id,path').order('created_at')
  if (error) throw error
  if (data.length === 0) return {}

  const urls = await signedUrls(data.map((row) => row.path))
  const byEntry: Record<string, Photo[]> = {}
  data.forEach((row) => {
    const url = urls.get(row.path)
    if (!url) return
    byEntry[row.entry_id] = [...(byEntry[row.entry_id] ?? []), { id: row.id, path: row.path, url }]
  })
  return byEntry
}

/** Uploads each picture; a picture that fails is skipped and counted so the rest still save. */
export async function uploadPhotos(userId: string, entryId: string, blobs: Blob[]): Promise<{ photos: Photo[]; failedCount: number }> {
  const supabase = createClient()
  const photos: Photo[] = []
  let failedCount = 0

  for (const blob of blobs) {
    const path = `${userId}/${entryId}/${window.crypto.randomUUID()}.jpg`
    const upload = await supabase.storage.from(BUCKET).upload(path, blob, { contentType: 'image/jpeg' })
    if (upload.error) {
      failedCount += 1
      continue
    }
    const { data, error } = await supabase.from('entry_photos').insert({ entry_id: entryId, path }).select('id').single()
    if (error || !data) {
      await supabase.storage.from(BUCKET).remove([path])
      failedCount += 1
      continue
    }
    const url = (await signedUrls([path])).get(path)
    if (url) photos.push({ id: data.id, path, url })
  }
  return { photos, failedCount }
}

/** Deletes the database rows and the stored files. */
export async function removePhotos(photos: Photo[]): Promise<void> {
  if (photos.length === 0) return
  const supabase = createClient()
  const rows = await supabase.from('entry_photos').delete().in('id', photos.map((photo) => photo.id))
  if (rows.error) throw rows.error
  const files = await supabase.storage.from(BUCKET).remove(photos.map((photo) => photo.path))
  if (files.error) throw files.error
}
