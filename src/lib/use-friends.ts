import { useCallback, useEffect, useState } from 'react'

import { listFriendships, loadShareSettings, type Friendship, type ShareSettings } from '@/lib/social'

type Snapshot = { friendships: Friendship[]; share: ShareSettings | null }

async function fetchSnapshot(): Promise<Snapshot> {
  const [friendships, share] = await Promise.all([listFriendships(), loadShareSettings()])
  return { friendships, share }
}

/** Friend requests and friends of the signed-in person, refreshed when the window regains focus. */
export function useFriends(userId: string | null) {
  const [snapshot, setSnapshot] = useState<Snapshot>({ friendships: [], share: null })
  const [hasError, setHasError] = useState(false)

  const refresh = useCallback(async () => {
    if (!userId) return
    try {
      setSnapshot(await fetchSnapshot())
      setHasError(false)
    } catch {
      setHasError(true)
    }
  }, [userId])

  useEffect(() => {
    const refreshOnFocus = () => {
      void refresh()
    }
    refreshOnFocus()
    window.addEventListener('focus', refreshOnFocus)
    return () => window.removeEventListener('focus', refreshOnFocus)
  }, [refresh])

  const { friendships, share } = userId ? snapshot : { friendships: [], share: null }
  const incomingCount = friendships.filter((item) => item.status === 'pending' && item.isIncoming).length
  return { friendships, share, hasError, incomingCount, refresh }
}
