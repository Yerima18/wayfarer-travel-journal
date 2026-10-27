'use client'

import { FormEvent, useState } from 'react'
import styles from './AccountDialog.module.css'
import { useI18n } from '@/lib/i18n'
import { createClient } from '@/lib/supabase/client'
import { isSupabaseConfigured } from '@/lib/supabase/env'

type AccountDialogProps = { onClose: () => void }

export default function AccountDialog({ onClose }: AccountDialogProps) {
  const { t } = useI18n()
  const configured = isSupabaseConfigured()
  const [mode, setMode] = useState<'sign-in' | 'sign-up'>('sign-in')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  // Supabase returns English messages; show the common ones in the visitor's language.
  function friendlyError(raw: string) {
    const text = raw.toLowerCase()
    if (text.includes('invalid login credentials')) return t('account.badLogin')
    if (text.includes('email not confirmed')) return t('account.notConfirmed')
    if (text.includes('already registered')) return t('account.exists')
    return raw || t('account.genericError')
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setMessage('')
    setBusy(true)

    try {
      const supabase = createClient()
      if (mode === 'sign-in') {
        const { error: authError } = await supabase.auth.signInWithPassword({ email, password })
        if (authError) throw authError
        onClose()
      } else {
        const { data, error: authError } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
        })
        if (authError) throw authError
        if (data.session) onClose()
        else setMessage(t('account.checkEmail'))
      }
    } catch (cause) {
      setError(cause instanceof Error ? friendlyError(cause.message) : t('account.genericError'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className={styles.backdrop} onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
      <section className={styles.dialog} role="dialog" aria-modal="true" aria-labelledby="account-title">
        <button className={styles.close} type="button" aria-label={t('account.close')} onClick={onClose}>×</button>
        <div className={styles.kicker}>{t('account.kicker')}</div>
        <h2 id="account-title">{configured ? (mode === 'sign-in' ? t('account.titleSignIn') : t('account.titleSignUp')) : t('account.titleOff')}</h2>
        {!configured ? (
          <>
            <p className={styles.intro}>{t('account.introOff')}</p>
            <button className={styles.submit} type="button" onClick={onClose}>{t('account.gotIt')}</button>
          </>
        ) : (
          <>
            <p className={styles.intro}>{mode === 'sign-in' ? t('account.introSignIn') : t('account.introSignUp')}</p>
            <form className={styles.form} onSubmit={submit}>
              <label>{t('account.email')}<input type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required /></label>
              <label>{t('account.password')}<input type="password" autoComplete={mode === 'sign-in' ? 'current-password' : 'new-password'} minLength={8} value={password} onChange={(event) => setPassword(event.target.value)} required /></label>
              {error && <p className={styles.error} role="alert">{error}</p>}
              {message && <p className={styles.message} role="status">{message}</p>}
              <button className={styles.submit} type="submit" disabled={busy}><span className={styles.submitLabel}>{busy ? t('account.busy') : mode === 'sign-in' ? t('account.signIn') : t('account.signUp')}</span> <span>↗</span></button>
            </form>
            <button className={styles.switch} type="button" onClick={() => { setMode(mode === 'sign-in' ? 'sign-up' : 'sign-in'); setError(''); setMessage('') }}>
              {mode === 'sign-in' ? t('account.switchToSignUp') : t('account.switchToSignIn')}
            </button>
          </>
        )}
      </section>
    </div>
  )
}
