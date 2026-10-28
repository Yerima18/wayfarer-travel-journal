'use client'

import { useEffect, useRef, useState } from 'react'

import Avatar from '@/components/Avatar'
import ProfileEditor from '@/components/ProfileEditor'
import { useI18n } from '@/lib/i18n'
import { useProfile } from '@/lib/use-profile'
import type { Profile } from '@/lib/avatar'

type AccountMenuProps = {
  userId: string
  email: string
  onSignOut: () => void
}

/** Avatar button in the top bar that opens the profile card (name, avatar editor, sign out). */
export default function AccountMenu({ userId, email, onSignOut }: AccountMenuProps) {
  const { t } = useI18n()
  const { profile, photoUrl, saveProfile } = useProfile(userId, email)
  const [isOpen, setIsOpen] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const container = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!isOpen) return
    const closeOnOutsideClick = (event: MouseEvent) => {
      if (!container.current?.contains(event.target as Node)) setIsOpen(false)
    }
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsOpen(false)
    }
    document.addEventListener('mousedown', closeOnOutsideClick)
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      document.removeEventListener('mousedown', closeOnOutsideClick)
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [isOpen])

  function toggle() {
    setIsOpen((open) => !open)
    setIsEditing(false)
  }

  async function save(next: Profile, newPhoto: Blob | null) {
    await saveProfile(next, newPhoto)
    setIsEditing(false)
  }

  return (
    <div className="account-menu" ref={container}>
      <button className="avatar-button" type="button" aria-haspopup="dialog" aria-expanded={isOpen} aria-label={t('account.menu')} onClick={toggle}>
        <Avatar profile={profile} photoUrl={photoUrl} />
        <span className="avatar-name">{profile.name}</span>
      </button>
      {isOpen ? (
        <div className="account-popover" role="dialog" aria-label={t('account.menu')}>
          {isEditing ? (
            <ProfileEditor profile={profile} photoUrl={photoUrl} onSave={save} onCancel={() => setIsEditing(false)} />
          ) : (
            <>
              <div className="account-card">
                <Avatar profile={profile} photoUrl={photoUrl} isLarge />
                <div>
                  <strong>{profile.name}</strong>
                  <small>{email}</small>
                </div>
              </div>
              <button className="account-item" type="button" onClick={() => setIsEditing(true)}>{t('account.edit')}</button>
              <button className="account-item" type="button" onClick={onSignOut}>{t('action.signOut')}</button>
            </>
          )}
        </div>
      ) : null}
    </div>
  )
}
