import { useCallback, useEffect, useState } from 'react'

import { listPhotoAccess, type PhotoAccess } from '@/lib/photo-access'
import { listFriendships, loadShareSettings, type Friendship, type ShareSettings } from '@/lib/social'

type Snapshot = { friendships: Friendship[]; share: ShareSettings | null; photoAccess: PhotoAccess[] }

async function fetchSnapshot(): Promise<Snapshot> {
  const [friendships, share, photoAccess] = await Promise.all([
    listFriendships(),
    loadShareSettings(),
    // Photo access is an optional add-on; the rest of the friends tab works without its tables.
    listPhotoAccess().catch(() => []),
  ])
  return { friendships, share, photoAccess }
}

/** Friend requests and friends of the signed-in person, refreshed when the window regains focus. */
export function useFriends(userId: string | null) {
  const [snapshot, setSnapshot] = useState<Snapshot>({ friendships: [], share: null, photoAccess: [] })
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

  const { friendships, share, photoAccess } = userId ? snapshot : { friendships: [], share: null, photoAccess: [] }
  const incomingCount =
    friendships.filter((item) => item.status === 'pending' && item.isIncoming).length +
    photoAccess.filter((item) => item.status === 'pending' && item.isIncoming).length
  return { friendships, share, photoAccess, hasError, incomingCount, refresh }
}
