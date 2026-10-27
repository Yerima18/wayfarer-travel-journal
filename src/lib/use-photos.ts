import { useCallback, useEffect, useState } from 'react'
import { loadPhotos, removePhotos, uploadPhotos, type Photo, type PhotoDraft } from '@/lib/photos'
import type { MessageKey } from '@/lib/messages'

const NO_PHOTOS: Record<string, Photo[]> = {}

type Loaded = { owner: string; byEntry: Record<string, Photo[]> }

/** The signed-in user's photos, keyed by place, plus the actions that change them. */
export function usePhotos(userId: string | null) {
  const [loaded, setLoaded] = useState<Loaded | null>(null)
  const [noticeKey, setNoticeKey] = useState<MessageKey | null>(null)

  useEffect(() => {
    if (!userId) return
    let isActive = true
    loadPhotos()
      .then((byEntry) => { if (isActive) setLoaded({ owner: userId, byEntry }) })
      .catch(() => { if (isActive) setNoticeKey('photos.loadFailed') })
    return () => { isActive = false }
  }, [userId])

  const photosByEntry = loaded && loaded.owner === userId ? loaded.byEntry : NO_PHOTOS

  const setEntryPhotos = useCallback((entryId: string, photos: Photo[]) => {
    if (!userId) return
    setLoaded((current) => ({ owner: userId, byEntry: { ...(current?.owner === userId ? current.byEntry : NO_PHOTOS), [entryId]: photos } }))
  }, [userId])

  /** Applies a form's photo choices to a place: removes dropped photos, uploads new ones. */
  const savePhotos = useCallback(async (entryId: string, draft: PhotoDraft) => {
    if (!userId) return
    const existing = photosByEntry[entryId] ?? []
    const keptIds = new Set(draft.kept.map((photo) => photo.id))
    const dropped = existing.filter((photo) => !keptIds.has(photo.id))
    let kept = draft.kept
    try {
      await removePhotos(dropped)
    } catch {
      kept = existing
      setNoticeKey('photos.saveFailed')
    }
    const { photos, failedCount } = await uploadPhotos(userId, entryId, draft.added.map((photo) => photo.blob))
    if (failedCount > 0) setNoticeKey('photos.saveFailed')
    setEntryPhotos(entryId, [...kept, ...photos])
  }, [userId, photosByEntry, setEntryPhotos])

  /** Removes the stored files of a place that was just deleted. */
  const discardPhotos = useCallback(async (entryId: string) => {
    const existing = photosByEntry[entryId] ?? []
    if (existing.length === 0) return
    try {
      await removePhotos(existing)
    } catch {
      setNoticeKey('photos.removeFailed')
    }
    setEntryPhotos(entryId, [])
  }, [photosByEntry, setEntryPhotos])

  return { photosByEntry, noticeKey, dismissNotice: () => setNoticeKey(null), savePhotos, discardPhotos }
}
