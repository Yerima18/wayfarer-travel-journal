import { countries } from '@/lib/countries'

export const WISHLIST_STORAGE_KEY = 'wayfarer.wishlist'

const knownIds = new Set(countries.map((country) => country.id))

function onlyKnownIds(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return Array.from(new Set(value.filter((id): id is string => typeof id === 'string' && knownIds.has(id))))
}

export function readLocalWishlist(): string[] {
  try {
    return onlyKnownIds(JSON.parse(window.localStorage.getItem(WISHLIST_STORAGE_KEY) ?? '[]'))
  } catch {
    return []
  }
}

export function writeLocalWishlist(ids: string[]): void {
  try {
    window.localStorage.setItem(WISHLIST_STORAGE_KEY, JSON.stringify(ids))
  } catch {
    // Private mode or a full disk: the wishlist just will not survive a reload.
  }
}

/** The wishlist kept in the account metadata. */
export function readAccountWishlist(metadata: unknown): string[] {
  return onlyKnownIds((metadata as { wishlist?: unknown } | null)?.wishlist)
}

export function mergeWishlists(first: string[], second: string[]): string[] {
  return Array.from(new Set([...first, ...second]))
}
