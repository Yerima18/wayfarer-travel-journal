'use client'

import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useEffect, useState } from 'react'

import LanguageToggle from '@/components/LanguageToggle'
import SharedProfileView from '@/components/SharedProfileView'
import ThemeToggle from '@/components/ThemeToggle'
import { useI18n } from '@/lib/i18n'
import { fetchSharedProfile, type SharedProfile } from '@/lib/social'

type LoadState = { status: 'loading' } | { status: 'missing' } | { status: 'ready'; shared: SharedProfile }

/** Public page for a username: shows whatever that person allows to anyone with the link. */
export default function SharedProfileScreen() {
  const { t } = useI18n()
  const { handle } = useParams<{ handle: string }>()
  const [state, setState] = useState<LoadState>({ status: 'loading' })

  useEffect(() => {
    let isActive = true
    fetchSharedProfile(handle)
      .then((shared) => {
        if (isActive) setState(shared ? { status: 'ready', shared } : { status: 'missing' })
      })
      .catch(() => {
        if (isActive) setState({ status: 'missing' })
      })
    return () => {
      isActive = false
    }
  }, [handle])

  return (
    <main className="public-page">
      <header className="public-bar">
        <Link href="/" className="public-brand">wayfarer</Link>
        <div className="public-tools"><LanguageToggle /><ThemeToggle /></div>
      </header>
      {state.status === 'loading' && <p className="public-note">{t('shared.loading')}</p>}
      {state.status === 'missing' && <p className="public-note">{t('shared.private')}</p>}
      {state.status === 'ready' && <SharedProfileView shared={state.shared} />}
      <footer className="public-cta">
        <span>{t('shared.ctaText')}</span>
        <Link href="/">{t('shared.cta')} ↗</Link>
      </footer>
    </main>
  )
}
