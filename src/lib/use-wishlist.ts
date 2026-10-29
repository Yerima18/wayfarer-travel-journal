import { useEffect, useState } from 'react'

import { createClient } from '@/lib/supabase/client'
import { mergeWishlists, readAccountWishlist, readLocalWishlist, writeLocalWishlist } from '@/lib/wishlist'

/**
 * Countries the person wants to visit. Signed out they live in the browser; signed in they live in
 * the account (and anything saved in the browser before signing in is merged in).
 */
export function useWishlist(userId: string | null) {
  const [ids, setIds] = useState<string[]>([])

  useEffect(() => {
    let isActive = true
    async function load() {
      const local = readLocalWishlist()
      if (!userId) {
        setIds(local)
        return
      }
      const { data } = await createClient().auth.getUser()
      if (!isActive || !data.user) return
      const account = readAccountWishlist(data.user.user_metadata)
      const merged = mergeWishlists(account, local)
      setIds(merged)
      if (merged.length === account.length) return
      const { error } = await createClient().auth.updateUser({ data: { wishlist: merged } })
      if (!error) writeLocalWishlist([])
    }
    void load()
    return () => {
      isActive = false
    }
  }, [userId])

  async function persist(next: string[], previous: string[]) {
    if (!userId) {
      writeLocalWishlist(next)
      return
    }
    const { error } = await createClient().auth.updateUser({ data: { wishlist: next } })
    if (error) setIds(previous)
  }

  function toggle(countryId: string) {
    const previous = ids
    const next = previous.includes(countryId) ? previous.filter((id) => id !== countryId) : [...previous, countryId]
    setIds(next)
    void persist(next, previous)
  }

  return { wishlistIds: ids, toggleWishlist: toggle }
}
