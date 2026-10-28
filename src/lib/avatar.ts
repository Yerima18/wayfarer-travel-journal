import { createClient } from '@/lib/supabase/client'

export type AvatarKind = 'initial' | 'sticker' | 'photo'
export type Profile = {
  name: string
  kind: AvatarKind
  sticker: string
  color: string
  /** Storage path of the uploaded picture; empty when none is kept. */
  photoPath: string
}

export const STICKERS = [
  '🦊', '🐼', '🐯', '🦁', '🐙', '🦉', '🐧', '🦄',
  '🐳', '🦜', '🐢', '🦋', '🌵', '🌴', '🏔️', '🌋',
  '🏝️', '🗺️', '🧭', '✈️', '🚂', '⛺', '📸', '🎒',
  '🥐', '🍜', '🌮', '🍣', '☕', '🌈', '🌍', '🔥',
]
export const AVATAR_COLORS = ['#ff6b57', '#ffb627', '#19b8a6', '#7c5cff', '#ff7ab6', '#2f9bff', '#7cc257', '#3d3a6b']
export const MAX_NAME_LENGTH = 30

const BUCKET = 'entry-photos'
const SIGNED_URL_SECONDS = 24 * 60 * 60
const AVATAR_EDGE_PX = 256
const JPEG_QUALITY = 0.85
const KINDS: AvatarKind[] = ['initial', 'sticker', 'photo']

/** Name and colour used until the person picks their own. */
export function defaultProfile(userId: string, email: string): Profile {
  const hash = Array.from(userId).reduce((total, char) => total + char.charCodeAt(0), 0)
  return {
    name: email.split('@')[0],
    kind: 'initial',
    sticker: STICKERS[hash % STICKERS.length],
    color: AVATAR_COLORS[hash % AVATAR_COLORS.length],
    photoPath: '',
  }
}

/** Reads the profile saved in the account metadata, falling back to the defaults for any bad field. */
export function readProfile(metadata: unknown, userId: string, email: string): Profile {
  const fallback = defaultProfile(userId, email)
  const saved = (metadata as { profile?: Partial<Record<keyof Profile, unknown>> } | null)?.profile
  if (!saved || typeof saved !== 'object') return fallback
  const text = (value: unknown, otherwise: string) => (typeof value === 'string' && value ? value : otherwise)
  const kind = KINDS.find((candidate) => candidate === saved.kind) ?? fallback.kind
  const photoPath = typeof saved.photoPath === 'string' ? saved.photoPath : ''
  return {
    name: text(saved.name, fallback.name).slice(0, MAX_NAME_LENGTH),
    kind: kind === 'photo' && !photoPath ? 'initial' : kind,
    sticker: text(saved.sticker, fallback.sticker),
    color: text(saved.color, fallback.color),
    photoPath,
  }
}

/** Centre-crops a picture to a small square JPEG (this also drops hidden camera metadata). */
export async function shrinkAvatar(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
  const side = Math.min(bitmap.width, bitmap.height)
  const canvas = document.createElement('canvas')
  canvas.width = AVATAR_EDGE_PX
  canvas.height = AVATAR_EDGE_PX
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Canvas is not available.')
  context.fillStyle = '#ffffff'
  context.fillRect(0, 0, AVATAR_EDGE_PX, AVATAR_EDGE_PX)
  context.drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, AVATAR_EDGE_PX, AVATAR_EDGE_PX)
  bitmap.close()
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Could not encode the image.'))), 'image/jpeg', JPEG_QUALITY)
  })
}

/** Stored in the same private bucket and folder as place photos, so the existing rules protect it. */
export async function uploadAvatar(userId: string, blob: Blob): Promise<string> {
  const path = `${userId}/avatar-${window.crypto.randomUUID()}.jpg`
  const { error } = await createClient().storage.from(BUCKET).upload(path, blob, { contentType: 'image/jpeg' })
  if (error) throw error
  return path
}

export async function removeAvatarFile(path: string): Promise<void> {
  if (!path) return
  const { error } = await createClient().storage.from(BUCKET).remove([path])
  if (error) throw error
}

export async function signedAvatarUrl(path: string): Promise<string | null> {
  if (!path) return null
  const { data, error } = await createClient().storage.from(BUCKET).createSignedUrl(path, SIGNED_URL_SECONDS)
  if (error) throw error
  return data.signedUrl
}
