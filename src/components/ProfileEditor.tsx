'use client'

import { useRef, useState, type ChangeEvent, type FormEvent } from 'react'

import Avatar from '@/components/Avatar'
import { AVATAR_COLORS, MAX_NAME_LENGTH, STICKERS, shrinkAvatar, type Profile } from '@/lib/avatar'
import { useI18n } from '@/lib/i18n'

type ProfileEditorProps = {
  profile: Profile
  photoUrl: string | null
  onSave: (profile: Profile, newPhoto: Blob | null) => Promise<void>
  onCancel: () => void
}

type NewPhoto = { blob: Blob; previewUrl: string }

export default function ProfileEditor({ profile, photoUrl, onSave, onCancel }: ProfileEditorProps) {
  const { t } = useI18n()
  const [draft, setDraft] = useState(profile)
  const [newPhoto, setNewPhoto] = useState<NewPhoto | null>(null)
  const [errorKey, setErrorKey] = useState<'account.saveError' | 'account.photoError' | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const fileInput = useRef<HTMLInputElement>(null)
  const hasPhoto = Boolean(newPhoto || (profile.photoPath && photoUrl))

  async function choosePhoto(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    try {
      const blob = await shrinkAvatar(file)
      if (newPhoto) URL.revokeObjectURL(newPhoto.previewUrl)
      setNewPhoto({ blob, previewUrl: URL.createObjectURL(blob) })
      setDraft((current) => ({ ...current, kind: 'photo' }))
      setErrorKey(null)
    } catch {
      setErrorKey('account.photoError')
    }
  }

  async function submit(event: FormEvent) {
    event.preventDefault()
    setIsSaving(true)
    setErrorKey(null)
    try {
      await onSave(draft, draft.kind === 'photo' ? newPhoto?.blob ?? null : null)
    } catch {
      setErrorKey('account.saveError')
      setIsSaving(false)
    }
  }

  return (
    <form className="profile-editor" onSubmit={submit}>
      <div className="profile-editor-head">
        <Avatar profile={draft} photoUrl={newPhoto?.previewUrl ?? photoUrl} isLarge />
        <label>
          <span>{t('account.name')}</span>
          <input value={draft.name} maxLength={MAX_NAME_LENGTH} onChange={(event) => setDraft({ ...draft, name: event.target.value })} />
        </label>
      </div>

      <p className="profile-label">{t('account.look')}</p>
      <div className="profile-tabs" role="group" aria-label={t('account.look')}>
        <button type="button" aria-pressed={draft.kind === 'initial'} onClick={() => setDraft({ ...draft, kind: 'initial' })}>{t('account.initial')}</button>
        <button type="button" aria-pressed={draft.kind === 'sticker'} onClick={() => setDraft({ ...draft, kind: 'sticker' })}>{t('account.sticker')}</button>
        <button type="button" aria-pressed={draft.kind === 'photo'} disabled={!hasPhoto} onClick={() => setDraft({ ...draft, kind: 'photo' })}>{t('account.photo')}</button>
      </div>

      <div className="sticker-grid">
        {STICKERS.map((sticker) => (
          <button key={sticker} type="button" aria-label={sticker} aria-pressed={draft.kind === 'sticker' && draft.sticker === sticker} onClick={() => setDraft({ ...draft, kind: 'sticker', sticker })}>
            {sticker}
          </button>
        ))}
      </div>

      <div className="color-row">
        {AVATAR_COLORS.map((color) => (
          <button key={color} type="button" aria-label={color} aria-pressed={draft.color === color} style={{ background: color }} onClick={() => setDraft({ ...draft, color })} />
        ))}
      </div>

      <input ref={fileInput} type="file" accept="image/*" hidden onChange={choosePhoto} />
      <button className="profile-upload" type="button" onClick={() => fileInput.current?.click()}>{t('account.upload')}</button>

      {errorKey ? <p className="profile-error" role="alert">{t(errorKey)}</p> : null}
      <div className="profile-actions">
        <button type="button" className="profile-cancel" onClick={onCancel}>{t('account.cancel')}</button>
        <button type="submit" className="profile-save" disabled={isSaving}>{isSaving ? t('account.saving') : t('account.save')}</button>
      </div>
    </form>
  )
}
