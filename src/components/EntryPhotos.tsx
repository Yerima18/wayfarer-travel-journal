'use client'

import { useI18n } from '@/lib/i18n'
import type { Photo } from '@/lib/photos'

const VISIBLE_THUMBNAILS = 3

type EntryPhotosProps = {
  photos: Photo[]
  city: string
  onOpen: (index: number) => void
}

/** A small strip of thumbnails on a place card; any of them opens the gallery. */
export default function EntryPhotos({ photos, city, onOpen }: EntryPhotosProps) {
  const { t } = useI18n()
  if (photos.length === 0) return null
  const extra = photos.length - VISIBLE_THUMBNAILS

  return (
    <div className="entry-photos">
      {photos.slice(0, VISIBLE_THUMBNAILS).map((photo, index) => (
        <button key={photo.id} type="button" className="entry-photo" onClick={() => onOpen(index)} aria-label={t('photos.open', { n: index + 1, total: photos.length, city })}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={photo.url} alt="" loading="lazy" decoding="async" />
          {index === VISIBLE_THUMBNAILS - 1 && extra > 0 && <span className="entry-photo-more">{`+${extra}`}</span>}
        </button>
      ))}
    </div>
  )
}
