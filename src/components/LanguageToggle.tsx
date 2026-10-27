'use client'

import { useI18n } from '@/lib/i18n'

// Shows the language you would switch to.
export default function LanguageToggle() {
  const { locale, t, setLocale } = useI18n()
  const next = locale === 'fr' ? 'en' : 'fr'

  return (
    <button className="theme-toggle lang-toggle" type="button" onClick={() => setLocale(next)} aria-label={t('lang.aria')} title={next === 'fr' ? 'Français' : 'English'} lang={next}>
      {next.toUpperCase()}
    </button>
  )
}
