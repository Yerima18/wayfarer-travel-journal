import type { Profile } from '@/lib/avatar'
import type { Photo } from '@/lib/photos'
import { toSharedAvatar } from '@/lib/social'
import { createClient } from '@/lib/supabase/client'

const BUCKET = 'entry-photos'
/** Short, so that a link kept after access is revoked stops working soon. */
const FRIEND_PHOTO_URL_SECONDS = 10 * 60

export type PhotoAccess = {
  id: string
  status: 'pending' | 'approved'
  /** True when the other person is asking to see my photos. */
  isIncoming: boolean
  handle: string
  profile: Profile
}

export type FriendPlacePhotos = { entryId: string; countryId: string; city: string; photos: Photo[] }
export type PhotoRequestResult = 'sent' | 'already' | 'not_friends' | 'not_found'

const REQUEST_RESULTS: PhotoRequestResult[] = ['sent', 'already', 'not_friends', 'not_found']

type AccessRow = {
  access_id: string
  status: string
  is_incoming: boolean
  handle: string
  display_name: string
  avatar: unknown
}

type PhotoRow = { entry_id: string; country_id: string; city: string; path: string }

export async function listPhotoAccess(): Promise<PhotoAccess[]> {
  const { data, error } = await createClient().rpc('list_photo_access')
  if (error) throw error
  return (data as AccessRow[]).map((row) => ({
    id: row.access_id,
    status: row.status === 'approved' ? 'approved' : 'pending',
    isIncoming: row.is_incoming,
    handle: row.handle,
    profile: toSharedAvatar(row.display_name, row.avatar),
  }))
}

export async function requestPhotoAccess(handle: string): Promise<PhotoRequestResult> {
  const { data, error } = await createClient().rpc('request_photo_access', { p_handle: handle })
  if (error) throw error
  const result = REQUEST_RESULTS.find((candidate) => candidate === data)
  if (!result) throw new Error('Unexpected answer to the photo request.')
  return result
}

export async function approvePhotoAccess(accessId: string): Promise<void> {
  const { error } = await createClient().from('photo_access').update({ status: 'approved' }).eq('id', accessId)
  if (error) throw error
}

/** Declines or cancels a request, or revokes access that was allowed. */
export async function endPhotoAccess(accessId: string): Promise<void> {
  const { error } = await createClient().from('photo_access').delete().eq('id', accessId)
  if (error) throw error
}

/** The photos of a friend's places, grouped by place; empty unless that friend allowed it. */
export async function fetchFriendPhotos(handle: string): Promise<FriendPlacePhotos[]> {
  const supabase = createClient()
  const { data, error } = await supabase.rpc('get_friend_photos', { p_handle: handle })
  if (error) throw error
  const rows = data as PhotoRow[]
  if (rows.length === 0) return []

  const signed = await supabase.storage.from(BUCKET).createSignedUrls(rows.map((row) => row.path), FRIEND_PHOTO_URL_SECONDS)
  if (signed.error) throw signed.error
  const urls = new Map(signed.data.map((item) => [item.path, item.signedUrl]))

  const places = new Map<string, FriendPlacePhotos>()
  rows.forEach((row) => {
    const url = urls.get(row.path)
    if (!url) return
    const place = places.get(row.entry_id) ?? { entryId: row.entry_id, countryId: row.country_id, city: row.city, photos: [] }
    place.photos.push({ id: row.path, path: row.path, url })
    places.set(row.entry_id, place)
  })
  return Array.from(places.values())
}
