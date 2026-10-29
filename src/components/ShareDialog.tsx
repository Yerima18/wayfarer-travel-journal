'use client'

import { useEffect, useState, type FormEvent } from 'react'

import styles from './AccountDialog.module.css'
import { useI18n } from '@/lib/i18n'
import { defaultProfile, readProfile, type Profile } from '@/lib/avatar'
import type { MessageKey } from '@/lib/messages'
import { createClient } from '@/lib/supabase/client'
import {
  MAX_HANDLE_LENGTH,
  loadShareSettings,
  normalizeHandle,
  saveShareSettings,
  type ShareSettings,
} from '@/lib/social'

type ShareDialogProps = {
  userId: string
  email: string
  onClose: () => void
  onSaved: () => void
}

const COPIED_MESSAGE_MS = 2000
const DEFAULT_SETTINGS: ShareSettings = { handle: '', linkEnabled: false, showCities: false, showWishlist: true }

type Notice = { key: MessageKey; isError: boolean }

/** Pick a username and choose what friends and link visitors can see. */
export default function ShareDialog({ userId, email, onClose, onSaved }: ShareDialogProps) {
  const { t } = useI18n()
  const [profile, setProfile] = useState<Profile>(() => defaultProfile(userId, email))
  const [settings, setSettings] = useState<ShareSettings>(DEFAULT_SETTINGS)
  const [isLoaded, setIsLoaded] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [hasCopied, setHasCopied] = useState(false)
  const [notice, setNotice] = useState<Notice | null>(null)
  const [savedHandle, setSavedHandle] = useState('')

  useEffect(() => {
    let isActive = true
    Promise.all([loadShareSettings(), createClient().auth.getUser()])
      .then(([loaded, { data }]) => {
        if (!isActive) return
        const current = readProfile(data.user?.user_metadata, userId, email)
        setProfile(current)
        if (loaded) {
          setSettings(loaded)
          setSavedHandle(loaded.handle)
        } else {
          setSettings({ ...DEFAULT_SETTINGS, handle: normalizeHandle(current.name) })
        }
        setIsLoaded(true)
      })
      .catch(() => {
        if (!isActive) return
        setNotice({ key: 'friends.loadError', isError: true })
        setIsLoaded(true)
      })
    return () => {
      isActive = false
    }
  }, [userId, email])

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', closeOnEscape)
    return () => document.removeEventListener('keydown', closeOnEscape)
  }, [onClose])

  async function submit(event: FormEvent) {
    event.preventDefault()
    setIsSaving(true)
    setNotice(null)
    try {
      const result = await saveShareSettings(profile, settings)
      if (result === 'saved') {
        setSavedHandle(settings.handle)
        setNotice({ key: 'share.saved', isError: false })
        onSaved()
      } else {
        setNotice({ key: result === 'taken' ? 'share.taken' : 'share.invalid', isError: true })
      }
    } catch {
      setNotice({ key: 'share.error', isError: true })
    } finally {
      setIsSaving(false)
    }
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/u/${savedHandle}`)
      setHasCopied(true)
      window.setTimeout(() => setHasCopied(false), COPIED_MESSAGE_MS)
    } catch {
      setNotice({ key: 'share.error', isError: true })
    }
  }

  const toggle = (field: 'linkEnabled' | 'showCities' | 'showWishlist', label: MessageKey) => (
    <label className="share-toggle">
      <input type="checkbox" checked={settings[field]} onChange={(event) => setSettings({ ...settings, [field]: event.target.checked })} />
      <span>{t(label)}</span>
    </label>
  )

  return (
    <div className={styles.backdrop} onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
      <section className={styles.dialog} role="dialog" aria-modal="true" aria-labelledby="share-title">
        <button className={styles.close} type="button" aria-label={t('account.close')} onClick={onClose}>×</button>
        <div className={styles.kicker}>{t('share.kicker')}</div>
        <h2 id="share-title">{t('share.title')}</h2>
        <p className={styles.intro}>{t('share.intro')}</p>
        <form className="share-form" onSubmit={submit}>
          <div className={styles.form}>
            <label>
              {t('share.handle')}
              <input value={settings.handle} maxLength={MAX_HANDLE_LENGTH} disabled={!isLoaded} autoCapitalize="none" autoComplete="off" spellCheck={false} onChange={(event) => setSettings({ ...settings, handle: normalizeHandle(event.target.value) })} required />
            </label>
          </div>
          <p className="share-hint">{t('share.handleHint')}</p>
          <div className="share-options">
            {toggle('linkEnabled', 'share.linkEnabled')}
            {toggle('showWishlist', 'share.showWishlist')}
            {toggle('showCities', 'share.showCities')}
          </div>
          {notice && <p className={notice.isError ? styles.error : styles.message} role={notice.isError ? 'alert' : 'status'}>{t(notice.key)}</p>}
          <button className={styles.submit} type="submit" disabled={isSaving || !isLoaded}>
            <span className={styles.submitLabel}>{isSaving ? t('share.saving') : t('share.save')}</span> <span>↗</span>
          </button>
        </form>
        {savedHandle && settings.linkEnabled && (
          <div className="share-link">
            <span>{`/u/${savedHandle}`}</span>
            <button type="button" onClick={copyLink}>{hasCopied ? t('share.copied') : t('share.copy')}</button>
          </div>
        )}
      </section>
    </div>
  )
}
