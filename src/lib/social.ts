import { defaultProfile, type Profile } from '@/lib/avatar'
import { createClient } from '@/lib/supabase/client'

export const HANDLE_PATTERN = /^[a-z0-9_-]{3,20}$/
export const MIN_HANDLE_LENGTH = 3
export const MAX_HANDLE_LENGTH = 20

const UNIQUE_VIOLATION = '23505'
const CHECK_VIOLATION = '23514'

export type ShareSettings = {
  handle: string
  linkEnabled: boolean
  showCities: boolean
  showWishlist: boolean
}

export type SharedProfile = {
  handle: string
  /** Avatar and name as others see them (an uploaded photo is never shared, so it shows as the initial). */
  profile: Profile
  isFriend: boolean
  isOwner: boolean
  countries: string[]
  /** Null when the person keeps their cities private. */
  cities: { countryId: string; city: string }[] | null
  /** Null when the person keeps their dream list private. */
  wishlist: string[] | null
}

export type Friendship = {
  id: string
  status: 'pending' | 'accepted'
  isIncoming: boolean
  handle: string
  profile: Profile
  countryCount: number | null
}

export type SaveShareResult = 'saved' | 'taken' | 'invalid'
export type FriendRequestResult = 'sent' | 'accepted' | 'already' | 'self' | 'not_found'

const REQUEST_RESULTS: FriendRequestResult[] = ['sent', 'accepted', 'already', 'self', 'not_found']

/** Lowercases and drops characters a username cannot contain. */
export function normalizeHandle(raw: string): string {
  return raw.trim().toLowerCase().replace(/^@/, '').replace(/[^a-z0-9_-]/g, '').slice(0, MAX_HANDLE_LENGTH)
}

function asStrings(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []
}

/** Builds the avatar others see from the few fields that are shared. */
function toSharedAvatar(displayName: string, avatar: unknown): Profile {
  const fallback = defaultProfile(displayName, `${displayName}@`)
  const shared = (avatar ?? {}) as Partial<Record<'kind' | 'sticker' | 'color', unknown>>
  return {
    ...fallback,
    name: displayName,
    kind: shared.kind === 'sticker' ? 'sticker' : 'initial',
    sticker: typeof shared.sticker === 'string' && shared.sticker ? shared.sticker : fallback.sticker,
    color: typeof shared.color === 'string' && shared.color ? shared.color : fallback.color,
    photoPath: '',
  }
}

function sharedAvatarOf(profile: Profile) {
  return { kind: profile.kind === 'sticker' ? 'sticker' : 'initial', sticker: profile.sticker, color: profile.color }
}

export async function loadShareSettings(): Promise<ShareSettings | null> {
  const { data, error } = await createClient()
    .from('profiles')
    .select('handle,link_enabled,show_cities,show_wishlist')
    .maybeSingle()
  if (error) throw error
  if (!data) return null
  return { handle: data.handle, linkEnabled: data.link_enabled, showCities: data.show_cities, showWishlist: data.show_wishlist }
}

export async function saveShareSettings(profile: Profile, settings: ShareSettings): Promise<SaveShareResult> {
  if (!HANDLE_PATTERN.test(settings.handle)) return 'invalid'
  const { error } = await createClient().from('profiles').upsert(
    {
      handle: settings.handle,
      display_name: profile.name,
      avatar: sharedAvatarOf(profile),
      link_enabled: settings.linkEnabled,
      show_cities: settings.showCities,
      show_wishlist: settings.showWishlist,
    },
    { onConflict: 'user_id' },
  )
  if (!error) return 'saved'
  if (error.code === UNIQUE_VIOLATION) return 'taken'
  if (error.code === CHECK_VIOLATION) return 'invalid'
  throw error
}

/** Keeps the shared name and avatar in step with the profile; does nothing before a username exists. */
export async function syncSharedIdentity(userId: string, profile: Profile): Promise<void> {
  const { error } = await createClient()
    .from('profiles')
    .update({ display_name: profile.name, avatar: sharedAvatarOf(profile) })
    .eq('user_id', userId)
  if (error) throw error
}

export async function fetchSharedProfile(handle: string): Promise<SharedProfile | null> {
  const { data, error } = await createClient().rpc('get_shared_profile', { p_handle: handle })
  if (error) throw error
  if (!data) return null
  const displayName = String(data.display_name ?? handle)
  const cities: unknown = data.cities
  return {
    handle: String(data.handle),
    profile: toSharedAvatar(displayName, data.avatar),
    isFriend: data.is_friend === true,
    isOwner: data.is_owner === true,
    countries: asStrings(data.countries),
    cities: Array.isArray(cities)
      ? cities.map((item) => ({ countryId: String(item.country_id), city: String(item.city) }))
      : null,
    wishlist: data.wishlist === null || data.wishlist === undefined ? null : asStrings(data.wishlist),
  }
}

type FriendshipRow = {
  friendship_id: string
  status: string
  is_incoming: boolean
  handle: string
  display_name: string
  avatar: unknown
  country_count: number | null
}

export async function listFriendships(): Promise<Friendship[]> {
  const { data, error } = await createClient().rpc('list_friendships')
  if (error) throw error
  return (data as FriendshipRow[]).map((row) => ({
    id: row.friendship_id,
    status: row.status === 'accepted' ? 'accepted' : 'pending',
    isIncoming: row.is_incoming,
    handle: row.handle,
    profile: toSharedAvatar(row.display_name, row.avatar),
    countryCount: row.country_count,
  }))
}

export async function sendFriendRequest(handle: string): Promise<FriendRequestResult> {
  const { data, error } = await createClient().rpc('send_friend_request', { p_handle: handle })
  if (error) throw error
  const result = REQUEST_RESULTS.find((candidate) => candidate === data)
  if (!result) throw new Error('Unexpected answer to the friend request.')
  return result
}

export async function acceptFriendRequest(friendshipId: string): Promise<void> {
  const { error } = await createClient().from('friendships').update({ status: 'accepted' }).eq('id', friendshipId)
  if (error) throw error
}

/** Declines or cancels a request, or ends a friendship. */
export async function endFriendship(friendshipId: string): Promise<void> {
  const { error } = await createClient().from('friendships').delete().eq('id', friendshipId)
  if (error) throw error
}
