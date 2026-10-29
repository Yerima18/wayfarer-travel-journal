'use client'

import { useEffect, useState } from 'react'

import EntryPhotos from '@/components/EntryPhotos'
import Flag from '@/components/Flag'
import PhotoGallery from '@/components/PhotoGallery'
import { useI18n } from '@/lib/i18n'
import { cityLabel, countryLabel } from '@/lib/names'
import { fetchFriendPhotos, type FriendPlacePhotos, type PhotoAccess } from '@/lib/photo-access'

type FriendPhotosProps = {
  handle: string
  name: string
  /** My request to see this friend's photos, if I made one. */
  access: PhotoAccess | undefined
  isBusy: boolean
  onAsk: () => void
  onCancel: (accessId: string) => void
}

type LoadState = { status: 'loading' } | { status: 'error' } | { status: 'ready'; places: FriendPlacePhotos[] }

/** A friend's photos: locked until they allow it, then shown by place. */
export default function FriendPhotos({ handle, name, access, isBusy, onAsk, onCancel }: FriendPhotosProps) {
  const { locale, t } = useI18n()
  const [state, setState] = useState<LoadState>({ status: 'loading' })
  const [openGallery, setOpenGallery] = useState<{ placeIndex: number; photoIndex: number } | null>(null)
  const isApproved = access?.status === 'approved'

  useEffect(() => {
    if (!isApproved) return
    let isActive = true
    fetchFriendPhotos(handle)
      .then((places) => {
        if (isActive) setState({ status: 'ready', places })
      })
      .catch(() => {
        if (isActive) setState({ status: 'error' })
      })
    return () => {
      isActive = false
    }
  }, [handle, isApproved])

  const openPlace = openGallery && state.status === 'ready' ? state.places[openGallery.placeIndex] : undefined

  return (
    <section className="panel shared-section friend-photos reveal" aria-labelledby="friend-photos-title">
      <h3 id="friend-photos-title">{t('friends.photosTitle')}</h3>
      {!access && (
        <div className="friend-photos-locked">
          <p>{t('friends.photosLocked', { name })}</p>
          <button type="button" className="friends-setup" disabled={isBusy} onClick={onAsk}>{t('friends.photosAsk')}</button>
        </div>
      )}
      {access?.status === 'pending' && (
        <div className="friend-photos-locked">
          <p>{t('friends.photosWaiting', { name })}</p>
          <button type="button" className="friends-quiet" disabled={isBusy} onClick={() => onCancel(access.id)}>{t('friends.cancel')}</button>
        </div>
      )}
      {isApproved && state.status === 'loading' && <p className="wishlist-empty">{t('friends.photosLoading')}</p>}
      {isApproved && state.status === 'error' && <p className="wishlist-empty">{t('friends.error')}</p>}
      {isApproved && state.status === 'ready' && state.places.length === 0 && <p className="wishlist-empty">{t('friends.photosNone', { name })}</p>}
      {isApproved && state.status === 'ready' && state.places.length > 0 && (
        <ul className="friend-photo-places">
          {state.places.map((place, placeIndex) => (
            <li key={place.entryId}>
              <p className="friend-photo-place">
                <Flag countryId={place.countryId} className="flag flag-small" />
                <span>{`${cityLabel(place.city, locale)}, ${countryLabel(place.countryId, locale)}`}</span>
              </p>
              <EntryPhotos photos={place.photos} city={place.city} onOpen={(photoIndex) => setOpenGallery({ placeIndex, photoIndex })} />
            </li>
          ))}
        </ul>
      )}
      {openGallery && openPlace && <PhotoGallery photos={openPlace.photos} startIndex={openGallery.photoIndex} title={openPlace.city} onClose={() => setOpenGallery(null)} />}
    </section>
  )
}
