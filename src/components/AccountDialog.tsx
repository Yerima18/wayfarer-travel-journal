'use client'

import { FormEvent, useState } from 'react'
import styles from './AccountDialog.module.css'
import { createClient } from '@/lib/supabase/client'
import { isSupabaseConfigured } from '@/lib/supabase/env'

type AccountDialogProps = { onClose: () => void }

export default function AccountDialog({ onClose }: AccountDialogProps) {
  const configured = isSupabaseConfigured()
  const [mode, setMode] = useState<'sign-in' | 'sign-up'>('sign-in')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

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
        else setMessage('Check your email for the confirmation link. Your account will be ready after you confirm it.')
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Something went wrong. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className={styles.backdrop} onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
      <section className={styles.dialog} role="dialog" aria-modal="true" aria-labelledby="account-title">
        <button className={styles.close} type="button" aria-label="Close account dialog" onClick={onClose}>×</button>
        <div className={styles.kicker}>YOUR PERSONAL ATLAS</div>
        <h2 id="account-title">{configured ? (mode === 'sign-in' ? 'Welcome back.' : 'Make it yours.') : 'Bring your journal with you.'}</h2>
        {!configured ? (
          <>
            <p className={styles.intro}>Account sync is ready to connect. Add your Supabase project URL and publishable key, then run the included database setup.</p>
            <button className={styles.submit} type="button" onClick={onClose}>Got it</button>
          </>
        ) : (
          <>
            <p className={styles.intro}>{mode === 'sign-in' ? 'Sign in to keep your places in sync across devices.' : 'Create an account to keep every place and memory together.'}</p>
            <form className={styles.form} onSubmit={submit}>
              <label>Email<input type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required /></label>
              <label>Password<input type="password" autoComplete={mode === 'sign-in' ? 'current-password' : 'new-password'} minLength={8} value={password} onChange={(event) => setPassword(event.target.value)} required /></label>
              {error && <p className={styles.error} role="alert">{error}</p>}
              {message && <p className={styles.message} role="status">{message}</p>}
              <button className={styles.submit} type="submit" disabled={busy}>{busy ? 'One moment…' : mode === 'sign-in' ? 'Sign in' : 'Create account'} <span>↗</span></button>
            </form>
            <button className={styles.switch} type="button" onClick={() => { setMode(mode === 'sign-in' ? 'sign-up' : 'sign-in'); setError(''); setMessage('') }}>
              {mode === 'sign-in' ? 'New to Wayfarer? Create an account' : 'Already have an account? Sign in'}
            </button>
          </>
        )}
      </section>
    </div>
  )
}
