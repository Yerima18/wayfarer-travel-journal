'use client'

import { PointerEvent, useEffect, useRef, useState } from 'react'
import { useI18n } from '@/lib/i18n'
import type { Photo } from '@/lib/photos'

const SWIPE_DISTANCE_PX = 50

type PhotoGalleryProps = {
  photos: Photo[]
  startIndex: number
  title: string
  onClose: () => void
}

/** Full-screen viewer: arrows, keyboard and swipe to move, Escape to close. */
export default function PhotoGallery({ photos, startIndex, title, onClose }: PhotoGalleryProps) {
  const { t } = useI18n()
  const [index, setIndex] = useState(Math.min(startIndex, photos.length - 1))
  const swipeStartX = useRef<number | null>(null)
  const closeRef = useRef<HTMLButtonElement>(null)

  const count = photos.length
  const goTo = (step: number) => setIndex((current) => (current + step + count) % count)

  useEffect(() => {
    closeRef.current?.focus()
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
      else if (event.key === 'ArrowLeft') setIndex((current) => (current - 1 + count) % count)
      else if (event.key === 'ArrowRight') setIndex((current) => (current + 1) % count)
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [count, onClose])

  function endSwipe(event: PointerEvent<HTMLDivElement>) {
    if (swipeStartX.current === null) return
    const distance = event.clientX - swipeStartX.current
    swipeStartX.current = null
    if (Math.abs(distance) > SWIPE_DISTANCE_PX && count > 1) goTo(distance < 0 ? 1 : -1)
  }

  return (
    <div className="gallery-backdrop" role="dialog" aria-modal="true" aria-label={title} onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
      <button ref={closeRef} type="button" className="gallery-close" aria-label={t('gallery.close')} onClick={onClose}>×</button>
      <div className="gallery-stage" onPointerDown={(event) => { swipeStartX.current = event.clientX }} onPointerUp={endSwipe} onPointerCancel={() => { swipeStartX.current = null }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img key={photos[index].id} className="gallery-image" src={photos[index].url} alt={`${title} ${index + 1}/${count}`} draggable={false} />
      </div>
      {count > 1 && (
        <>
          <button type="button" className="gallery-nav gallery-prev" aria-label={t('gallery.prev')} onClick={() => goTo(-1)}>‹</button>
          <button type="button" className="gallery-nav gallery-next" aria-label={t('gallery.next')} onClick={() => goTo(1)}>›</button>
        </>
      )}
      <div className="gallery-caption">{`${title} · ${index + 1} / ${count}`}</div>
    </div>
  )
}
