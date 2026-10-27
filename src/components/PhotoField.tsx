'use client'

import { ChangeEvent, useEffect, useRef, useState } from 'react'
import { useI18n } from '@/lib/i18n'
import type { MessageKey } from '@/lib/messages'
import { MAX_PHOTOS_PER_PLACE, shrinkImage, type PhotoDraft } from '@/lib/photos'

type PhotoFieldProps = {
  draft: PhotoDraft
  onChange: (draft: PhotoDraft) => void
}

/** Lets the visitor attach up to a few pictures to a place; they are shrunk before upload. */
export default function PhotoField({ draft, onChange }: PhotoFieldProps) {
  const { t } = useI18n()
  const [isProcessing, setIsProcessing] = useState(false)
  const [errorKey, setErrorKey] = useState<MessageKey | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const draftRef = useRef(draft)

  useEffect(() => {
    draftRef.current = draft
  }, [draft])

  // Preview URLs hold memory until released.
  useEffect(() => () => draftRef.current.added.forEach((photo) => URL.revokeObjectURL(photo.previewUrl)), [])

  const total = draft.kept.length + draft.added.length
  const slotsLeft = MAX_PHOTOS_PER_PLACE - total

  async function addFiles(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? [])
    event.target.value = ''
    if (files.length === 0) return
    setErrorKey(files.length > slotsLeft ? 'photos.tooMany' : null)

    setIsProcessing(true)
    const added = [...draft.added]
    for (const file of files.slice(0, slotsLeft)) {
      try {
        const blob = await shrinkImage(file)
        added.push({ key: window.crypto.randomUUID(), blob, previewUrl: URL.createObjectURL(blob) })
      } catch {
        setErrorKey('photos.unsupported')
      }
    }
    setIsProcessing(false)
    onChange({ ...draft, added })
  }

  function removeKept(id: string) {
    onChange({ ...draft, kept: draft.kept.filter((photo) => photo.id !== id) })
  }

  function removeAdded(key: string) {
    const removed = draft.added.find((photo) => photo.key === key)
    if (removed) URL.revokeObjectURL(removed.previewUrl)
    onChange({ ...draft, added: draft.added.filter((photo) => photo.key !== key) })
  }

  return (
    <div className="photo-field">
      <div className="photo-field-head">
        <span>{t('photos.label')} <span className="optional">{t('form.optional')}</span></span>
        <button type="button" className="photo-add" onClick={() => inputRef.current?.click()} disabled={slotsLeft <= 0 || isProcessing}>
          {isProcessing ? t('photos.processing') : t('photos.add')}
        </button>
      </div>
      <input ref={inputRef} className="photo-input" type="file" accept="image/*" multiple onChange={addFiles} tabIndex={-1} aria-hidden="true" />
      {total > 0 && (
        <ul className="photo-grid">
          {draft.kept.map((photo) => (
            <li key={photo.id}>
              {/* Signed storage URLs are not known to next/image. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={photo.url} alt="" />
              <button type="button" aria-label={t('photos.remove')} onClick={() => removeKept(photo.id)}>×</button>
            </li>
          ))}
          {draft.added.map((photo) => (
            <li key={photo.key}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={photo.previewUrl} alt="" />
              <button type="button" aria-label={t('photos.remove')} onClick={() => removeAdded(photo.key)}>×</button>
            </li>
          ))}
        </ul>
      )}
      <p className={errorKey ? 'photo-hint photo-hint-error' : 'photo-hint'} role={errorKey ? 'alert' : undefined}>
        {errorKey ? t(errorKey, { n: MAX_PHOTOS_PER_PLACE }) : t('photos.hint', { n: MAX_PHOTOS_PER_PLACE })}
      </p>
    </div>
  )
}
