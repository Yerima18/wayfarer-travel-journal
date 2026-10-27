import { useCallback, useSyncExternalStore } from 'react'
import { messages, type Locale, type MessageKey } from './messages'

const STORAGE_KEY = 'wayfarer.lang'

const listeners = new Set<() => void>()
let current: Locale = 'en'
let initialised = false

function detect(): Locale {
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY)
    if (saved === 'fr' || saved === 'en') return saved
  } catch {
    // Fall through to the browser language.
  }
  return window.navigator.language?.toLowerCase().startsWith('fr') ? 'fr' : 'en'
}

function getSnapshot(): Locale {
  if (!initialised) {
    current = detect()
    initialised = true
  }
  return current
}

const getServerSnapshot = (): Locale => 'en'

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}

export function setLocale(locale: Locale) {
  current = locale
  initialised = true
  try {
    window.localStorage.setItem(STORAGE_KEY, locale)
  } catch {
    // The language still changes for this visit if storage is unavailable.
  }
  listeners.forEach((listener) => listener())
}

export type TParams = Record<string, string | number>

export function translate(locale: Locale, key: MessageKey, params?: TParams): string {
  const dictionary = messages[locale] as Record<string, string>
  let template = dictionary[key]
  if (params && typeof params.n === 'number') {
    const rule = new Intl.PluralRules(locale).select(params.n)
    template = dictionary[`${key}_${rule}`] ?? dictionary[`${key}_other`] ?? template
  }
  if (template === undefined) return key
  return params ? template.replace(/\{(\w+)\}/g, (match, name: string) => (name in params ? String(params[name]) : match)) : template
}

export function useI18n() {
  const locale = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
  const t = useCallback((key: MessageKey, params?: TParams) => translate(locale, key, params), [locale])
  return { locale, t, setLocale }
}
