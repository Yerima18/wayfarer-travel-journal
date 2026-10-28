'use client'

import { CSSProperties, FormEvent, useEffect, useMemo, useRef, useState } from 'react'
import WorldMap from '@/components/WorldMap'
import AccountDialog from '@/components/AccountDialog'
import CountUp from '@/components/CountUp'
import EntryPhotos from '@/components/EntryPhotos'
import PhotoField from '@/components/PhotoField'
import PhotoGallery from '@/components/PhotoGallery'
import CountryPicker from '@/components/CountryPicker'
import Explore, { type ExploreFocus } from '@/components/Explore'
import Flag from '@/components/Flag'
import WorldProgress, { worldPercentOf } from '@/components/WorldProgress'
import SearchBox, { type SearchPick } from '@/components/SearchBox'
import AccountMenu from '@/components/AccountMenu'
import LanguageToggle from '@/components/LanguageToggle'
import ThemeToggle from '@/components/ThemeToggle'
import { countries } from '@/lib/countries'
import { citySuggestions } from '@/lib/cities'
import { useI18n } from '@/lib/i18n'
import type { MessageKey } from '@/lib/messages'
import { cityLabel, countryLabel } from '@/lib/names'
import { createClient } from '@/lib/supabase/client'
import { isSupabaseConfigured } from '@/lib/supabase/env'
import type { PhotoDraft } from '@/lib/photos'
import { usePhotos } from '@/lib/use-photos'

type JournalEntry = {
  id: string
  countryId: string
  countryName: string
  city: string
  date: string
  note: string
  createdAt: string
}

const STORAGE_KEY = 'wayfarer.travel-journal.v1'
const EMPTY_DRAFT: PhotoDraft = { kept: [], added: [] }

function isJournalEntry(value: unknown): value is JournalEntry {
  if (!value || typeof value !== 'object') return false
  const entry = value as Record<string, unknown>
  return typeof entry.id === 'string'
    && typeof entry.countryId === 'string'
    && typeof entry.countryName === 'string'
    && typeof entry.city === 'string'
    && typeof entry.date === 'string'
    && typeof entry.note === 'string'
    && typeof entry.createdAt === 'string'
}

function formatDate(value: string, locale: string, emptyLabel: string) {
  if (!value) return emptyLabel
  const date = new Date(`${value}T12:00:00`)
  return new Intl.DateTimeFormat(locale, { month: 'short', year: 'numeric' }).format(date).toUpperCase()
}

/** Staggers the entrance of the nth element on a screen. */
function revealStyle(order: number): CSSProperties {
  return { '--i': Math.min(order, 8) } as CSSProperties
}

function PinIcon({ small = false }: { small?: boolean }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" className={small ? 'pin-icon pin-icon-small' : 'pin-icon'}>
      <path d="M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 1 1 14 0Z" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="12" cy="10" r="2.2" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  )
}

function CompassIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" width="16" height="16">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.6" />
      <path d="m15.5 8.5-2 5-5 2 2-5 5-2Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
    </svg>
  )
}

function AppMark() {
  return (
    <svg aria-hidden="true" viewBox="0 0 32 32" fill="none">
      <path d="M6 23.5 13.5 8l4.2 9 3-5 5.3 11.5H6Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <circle cx="22.5" cy="8" r="2" fill="currentColor" />
    </svg>
  )
}

function App() {
  const { locale, t } = useI18n()
  const [entries, setEntries] = useState<JournalEntry[]>([])
  const [ready, setReady] = useState(false)
  const [storageWritable, setStorageWritable] = useState(false)
  const [storageWarning, setStorageWarning] = useState(false)
  const [formOpen, setFormOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [view, setView] = useState<'overview' | 'places' | 'explore'>('overview')
  const [formCountry, setFormCountry] = useState('')
  const [formCity, setFormCity] = useState('')
  const [showAll, setShowAll] = useState(false)
  const [accountOpen, setAccountOpen] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [exploreFocus, setExploreFocus] = useState<ExploreFocus | null>(null)
  const [userEmail, setUserEmail] = useState<string | null>(null)
  const [userId, setUserId] = useState<string | null>(null)
  const [photoDraft, setPhotoDraft] = useState<PhotoDraft>(EMPTY_DRAFT)
  const [isSaving, setIsSaving] = useState(false)
  const [gallery, setGallery] = useState<{ entryId: string; index: number } | null>(null)
  const { photosByEntry, noticeKey, dismissNotice, savePhotos, discardPhotos } = usePhotos(userId)
  const [cloudStatus, setCloudStatus] = useState<'local' | 'syncing' | 'synced' | 'error'>('local')
  const [localEntriesSnapshot, setLocalEntriesSnapshot] = useState<JournalEntry[]>([])
  const localEntriesRef = useRef<JournalEntry[]>([])
  const [importAvailable, setImportAvailable] = useState(false)

  useEffect(() => {
    const loadSavedJournal = () => {
      let canWrite = true
      let hasWarning = false
      try {
        const saved = window.localStorage.getItem(STORAGE_KEY)
        if (saved !== null) {
          const parsed: unknown = JSON.parse(saved)
          if (Array.isArray(parsed) && parsed.every(isJournalEntry)) {
            setEntries(parsed)
            setLocalEntriesSnapshot(parsed)
            localEntriesRef.current = parsed
          } else {
            canWrite = false
            hasWarning = true
          }
        }
      } catch {
        // Preserve unreadable saved data instead of replacing it with an empty journal.
        canWrite = false
        hasWarning = true
      } finally {
        setStorageWritable(canWrite)
        setStorageWarning(hasWarning)
        setReady(true)
      }
    }

    const timeoutId = window.setTimeout(loadSavedJournal, 0)
    return () => window.clearTimeout(timeoutId)
  }, [])

  useEffect(() => {
    if (!ready || !storageWritable || (isSupabaseConfigured() && userEmail)) return
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(entries))
    } catch {
      // Keep the journal usable in this session if browser storage is unavailable.
      window.setTimeout(() => {
        setStorageWarning(true)
        setStorageWritable(false)
      }, 0)
    }
  }, [entries, ready, storageWritable, userEmail])

  useEffect(() => {
    if (!isSupabaseConfigured()) return

    const supabase = createClient()
    let active = true

    async function loadEntries(userId: string) {
      setCloudStatus('syncing')
      setStorageWritable(false)
      const { data, error } = await supabase
        .from('travel_entries')
        .select('id,country_id,country_name,city,visited_on,note,created_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })

      if (!active) return
      if (error) {
        setCloudStatus('error')
        setStorageWarning(true)
        setImportAvailable(false)
        return
      }

      const cloudEntries: JournalEntry[] = (data ?? []).map((row) => ({
        id: row.id,
        countryId: row.country_id,
        countryName: row.country_name,
        city: row.city,
        date: row.visited_on ?? '',
        note: row.note ?? '',
        createdAt: row.created_at,
      }))
      setEntries(cloudEntries)
      setImportAvailable(cloudEntries.length === 0 && localEntriesRef.current.length > 0)
      setCloudStatus('synced')
      setStorageWarning(false)
      setReady(true)
    }

    function handleSession(email: string | null, userId: string | null) {
      if (!active) return
      setUserEmail(email)
      setUserId(userId)
      if (userId) {
        void loadEntries(userId)
        return
      }

      setCloudStatus('local')
      setImportAvailable(false)
      try {
        const saved = window.localStorage.getItem(STORAGE_KEY)
        const parsed: unknown = saved ? JSON.parse(saved) : []
        if (Array.isArray(parsed) && parsed.every(isJournalEntry)) {
          setEntries(parsed)
          setLocalEntriesSnapshot(parsed)
          localEntriesRef.current = parsed
          setStorageWritable(true)
          setStorageWarning(false)
        }
      } catch {
        setStorageWarning(true)
        setStorageWritable(false)
      }
      setReady(true)
    }

    supabase.auth.getUser().then(({ data, error }) => {
      if (!active) return
      // No session just means nobody is signed in; only other errors are real failures.
      if (error && error.name !== 'AuthSessionMissingError') {
        setCloudStatus('error')
        return
      }
      handleSession(data.user?.email ?? null, data.user?.id ?? null)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      handleSession(session?.user.email ?? null, session?.user.id ?? null)
    })

    return () => {
      active = false
      subscription.unsubscribe()
    }
  }, [])

  useEffect(() => {
    if (!menuOpen) return
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenuOpen(false)
    }
    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [menuOpen])

  useEffect(() => {
    if (!formOpen) return
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setFormOpen(false)
    }
    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [formOpen])

  useEffect(() => {
    document.documentElement.lang = locale
    document.title = t('app.title')
  }, [locale, t])

  const countryCount = useMemo(() => new Set(entries.map((entry) => entry.countryId)).size, [entries])
  const cityCount = useMemo(() => new Set(entries.map((entry) => `${entry.countryId}:${entry.city.trim().toLowerCase()}`)).size, [entries])
  const visitedCountryIds = useMemo(() => Array.from(new Set(entries.map((entry) => entry.countryId))), [entries])

  const editingEntry = formOpen && editingId ? entries.find((item) => item.id === editingId) : undefined

  async function addEntry(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const formData = new FormData(event.currentTarget)
    const countryId = String(formData.get('country') || '')
    const city = String(formData.get('city') || '').trim()
    const date = String(formData.get('date') || '')
    const note = String(formData.get('note') || '').trim()
    const country = countries.find((item) => item.id === countryId)
    if (!country || !city) return
    setIsSaving(true)
    try {
      await saveEntry({ countryId, countryName: country.name, city, date, note })
    } finally {
      setIsSaving(false)
    }
  }

  async function saveEntry({ countryId, countryName, city, date, note }: Pick<JournalEntry, 'countryId' | 'countryName' | 'city' | 'date' | 'note'>) {
    if (editingEntry) {
      if (userEmail) {
        setCloudStatus('syncing')
        const { error } = await createClient()
          .from('travel_entries')
          .update({ country_id: countryId, country_name: countryName, city, visited_on: date || null, note })
          .eq('id', editingEntry.id)
        if (error) {
          setCloudStatus('error')
          setStorageWarning(true)
          return
        }
        setCloudStatus('synced')
        await savePhotos(editingEntry.id, photoDraft)
      }
      setEntries((current) => current.map((item) => item.id === editingEntry.id
        ? { ...item, countryId, countryName, city, date, note }
        : item))
      setFormOpen(false)
      return
    }

    const entry: JournalEntry = {
      id: window.crypto.randomUUID(),
      countryId,
      countryName,
      city,
      date,
      note,
      createdAt: new Date().toISOString(),
    }

    if (userEmail) {
      setCloudStatus('syncing')
      const { data, error } = await createClient()
        .from('travel_entries')
        .insert({
          country_id: entry.countryId,
          country_name: entry.countryName,
          city: entry.city,
          visited_on: entry.date || null,
          note: entry.note,
        })
        .select('id,country_id,country_name,city,visited_on,note,created_at')
        .single()

      if (error || !data) {
        setCloudStatus('error')
        setStorageWarning(true)
        return
      }

      const savedEntry: JournalEntry = {
        id: data.id,
        countryId: data.country_id,
        countryName: data.country_name,
        city: data.city,
        date: data.visited_on ?? '',
        note: data.note ?? '',
        createdAt: data.created_at,
      }
      setEntries((current) => [savedEntry, ...current])
      setCloudStatus('synced')
      await savePhotos(savedEntry.id, photoDraft)
    } else {
      setEntries((current) => [entry, ...current])
    }
    setFormOpen(false)
  }

  function openAdd(countryId = '', city = '') {
    setEditingId(null)
    setPhotoDraft(EMPTY_DRAFT)
    setFormCountry(countryId)
    setFormCity(city)
    setFormOpen(true)
  }

  function handleSearchPick(pick: SearchPick) {
    if (view === 'explore') {
      setExploreFocus((current) => ({ countryId: pick.countryId, nonce: (current?.nonce ?? 0) + 1 }))
      return
    }
    openAdd(pick.countryId, pick.city ? cityLabel(pick.city, locale) : '')
  }

  function openEdit(id: string) {
    const entry = entries.find((item) => item.id === id)
    if (!entry) return
    setEditingId(id)
    setPhotoDraft({ kept: photosByEntry[id] ?? [], added: [] })
    setFormCountry(entry.countryId)
    setFormCity(entry.city)
    setFormOpen(true)
  }

  async function deleteEntry(entry: JournalEntry) {
    if (!window.confirm(t('confirm.remove', { city: entry.city }))) return
    if (userEmail) {
      setCloudStatus('syncing')
      const { error } = await createClient().from('travel_entries').delete().eq('id', entry.id)
      if (error) {
        setCloudStatus('error')
        setStorageWarning(true)
        return
      }
      setCloudStatus('synced')
      await discardPhotos(entry.id)
    }
    setEntries((current) => current.filter((item) => item.id !== entry.id))
  }

  async function importLocalJournal() {
    if (!userEmail || localEntriesSnapshot.length === 0) return
    setCloudStatus('syncing')
    const rows = localEntriesSnapshot.map((entry) => ({
      id: entry.id,
      country_id: entry.countryId,
      country_name: entry.countryName,
      city: entry.city,
      visited_on: entry.date || null,
      note: entry.note,
      created_at: entry.createdAt,
    }))
    const { data, error } = await createClient()
      .from('travel_entries')
      .insert(rows)
      .select('id,country_id,country_name,city,visited_on,note,created_at')
      .order('created_at', { ascending: false })

    if (error || !data) {
      setCloudStatus('error')
      setStorageWarning(true)
      return
    }

    setEntries(data.map((row) => ({
      id: row.id,
      countryId: row.country_id,
      countryName: row.country_name,
      city: row.city,
      date: row.visited_on ?? '',
      note: row.note ?? '',
      createdAt: row.created_at,
    })))
    setImportAvailable(false)
    setCloudStatus('synced')
  }

  async function signOut() {
    const { error } = await createClient().auth.signOut()
    if (error) setCloudStatus('error')
  }

  const suggestions = useMemo(() => {
    const query = formCity.trim().toLowerCase()
    const all = citySuggestions(formCountry).map((city) => cityLabel(city, locale))
    const matches = query ? all.filter((city) => city.toLowerCase().includes(query)) : all
    return matches.slice(0, 8)
  }, [formCountry, formCity, locale])
  const placeGroups = useMemo(() => {
    const groups = new Map<string, { id: string; name: string; entries: JournalEntry[] }>()
    entries.forEach((entry) => {
      const group = groups.get(entry.countryId) ?? { id: entry.countryId, name: entry.countryName, entries: [] }
      group.entries.push(entry)
      groups.set(entry.countryId, group)
    })
    return Array.from(groups.values())
  }, [entries])
  const worldPercent = new Intl.NumberFormat(locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(worldPercentOf(countryCount))
  const explorerTitle = t(`home.rank${countryCount === 0 ? 0 : countryCount < 5 ? 1 : countryCount < 15 ? 2 : 3}` as MessageKey)
  const recentEntries = showAll ? entries : entries.slice(0, 5)

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <button className="brand" type="button" onClick={() => setView('overview')} aria-label={t('brand.aria')}>
          <span className="brand-symbol"><AppMark /></span>
          <span className="brand-name">wayfarer</span>
        </button>
        <button className={menuOpen ? 'menu-button menu-button-open' : 'menu-button'} type="button" aria-label={t('nav.menu')} aria-expanded={menuOpen} aria-controls="side-nav" onClick={() => setMenuOpen((open) => !open)}><span /><span /><span /></button>
        <div className="brand-caption">{t('brand.caption')}</div>

        <div className="nav-label">{t('nav.label')}</div>
        <div className={menuOpen ? 'menu-scrim menu-scrim-on' : 'menu-scrim'} onClick={() => setMenuOpen(false)} aria-hidden="true" />
        <nav className={menuOpen ? 'side-nav side-nav-open' : 'side-nav'} id="side-nav" aria-label={t('nav.aria')} onClick={() => setMenuOpen(false)}>
          <button className={view === 'overview' ? 'nav-link nav-link-active' : 'nav-link'} type="button" aria-current={view === 'overview' ? 'page' : undefined} onClick={() => setView('overview')}><span className="nav-glyph nav-glyph-home" />{t('nav.overview')}</button>
          <button className={view === 'places' ? 'nav-link nav-link-active' : 'nav-link'} type="button" aria-current={view === 'places' ? 'page' : undefined} onClick={() => setView('places')}><span className="nav-glyph nav-glyph-pin"><PinIcon small /></span>{t('nav.places')}<span className="nav-count">{entries.length}</span></button>
          <button className={view === 'explore' ? 'nav-link nav-link-active' : 'nav-link'} type="button" aria-current={view === 'explore' ? 'page' : undefined} onClick={() => setView('explore')}><span className="nav-glyph"><CompassIcon /></span>{t('nav.explore')}</button>
        </nav>

        <div className="sidebar-bottom">
          <div className="sidebar-orbit" aria-hidden="true"><span /><i /><b /></div>
          <div className="sidebar-bottom-title">{t('side.title1')}<br />{t('side.title2')}</div>
          <p>{userEmail ? t('side.synced') : t('side.local')}</p>
          <button className="sidebar-add" type="button" onClick={() => openAdd()}><span>＋</span> {t('action.addPlace')}</button>
        </div>
        <div className="sidebar-footer"><span className="status-dot" /> {t('side.footer')}</div>
      </aside>

      <div className="main-column" id="overview">
        <header className="topbar">
          <div className="breadcrumb"><span>{t('crumb.root')}</span><i>/</i><b>{view === 'overview' ? t('crumb.overview') : view === 'places' ? t('crumb.places') : t('crumb.explore')}</b></div>
          <SearchBox onPick={handleSearchPick} />
          <div className="topbar-right"><span className={storageWarning || cloudStatus === 'error' ? 'saved-pill saved-pill-warning' : 'saved-pill'} role="status"><span />{` ${userEmail ? cloudStatus === 'syncing' ? t('status.syncing') : cloudStatus === 'error' ? t('status.error') : t('status.synced') : storageWarning ? t('status.warning') : t('status.local')}`}</span><LanguageToggle /><ThemeToggle />{userEmail && userId ? <AccountMenu key={userId} userId={userId} email={userEmail} onSignOut={signOut} /> : userEmail ? null : <button className="account-button" type="button" onClick={() => setAccountOpen(true)}>{t('action.signIn')}</button>}<button className="top-add" type="button" onClick={() => openAdd()}><span>＋</span> {t('action.addPlace')}</button></div>
        </header>

        <main className="dashboard">
          {noticeKey && <div className="import-notice" role="status"><span>{t(noticeKey)}</span><button type="button" onClick={dismissNotice}>{t('notice.dismiss')}</button></div>}
          {importAvailable && <div className="import-notice" role="status"><span>{t('import.notice', { n: localEntriesSnapshot.length })}</span><button type="button" onClick={importLocalJournal}>{t('import.button')}</button></div>}
          {view === 'explore' ? (
            <Explore visitedCountryIds={visitedCountryIds} onAddPlace={openAdd} focus={exploreFocus} />
          ) : view === 'places' ? (
          <section className="places-view reveal" aria-labelledby="places-page-heading">
            <div className="places-head">
              <div>
                <div className="overline"><span className="overline-line" /> {t('places.overline')}</div>
                <h1 id="places-page-heading">{t('places.title')}</h1>
                <p>{entries.length === 0 ? t('places.emptyLine') : t('places.summary', { memories: t('count.memories', { n: entries.length }), countries: t('count.countries', { n: countryCount }) })}</p>
              </div>
              <button className="top-add" type="button" onClick={() => openAdd()}><span>＋</span> {t('action.addPlace')}</button>
            </div>
            {entries.length === 0 ? (
              <div className="panel places-empty">
                <div className="empty-pin"><PinIcon /></div>
                <h3>{t('places.emptyTitle')}</h3>
                <p>{t('places.emptyText')}</p>
                <button className="empty-add" type="button" onClick={() => openAdd()}>{t('action.addFirst')} <span>↗</span></button>
              </div>
            ) : (
              <div className="country-grid">
                {placeGroups.map((group, groupIndex) => (
                  <article className="panel country-card reveal" style={revealStyle(groupIndex)} key={group.id}>
                    <div className="country-card-head">
                      <Flag countryId={group.id} className="flag flag-large" />
                      <h2>{countryLabel(group.id, locale, group.name)}</h2>
                      <span className="country-count">{group.entries.length}</span>
                      <button className="country-add" type="button" onClick={() => openAdd(group.id)} aria-label={t('aria.addInCountry', { name: countryLabel(group.id, locale, group.name) })}>{t('action.addShort')}</button>
                    </div>
                    {group.entries.map((entry) => (
                      <div className="entry-card" key={entry.id}>
                        <div className="entry-copy"><div className="entry-date">{formatDate(entry.date, locale, t('date.none'))}</div><h3>{entry.city}</h3>{entry.note && <div className="entry-note">“{entry.note}”</div>}<EntryPhotos photos={photosByEntry[entry.id] ?? []} city={entry.city} onOpen={(index) => setGallery({ entryId: entry.id, index })} /></div>
                        <div className="entry-actions"><button type="button" onClick={() => openEdit(entry.id)} aria-label={t('aria.edit', { city: entry.city })}>{t('action.edit')}</button><button type="button" onClick={() => deleteEntry(entry)} aria-label={t('aria.delete', { city: entry.city })}>{t('action.delete')}</button></div>
                      </div>
                    ))}
                  </article>
                ))}
              </div>
            )}
          </section>
          ) : (
          <>
          <section className="welcome-row reveal">
            <div>
              <div className="overline"><span className="overline-line" /> {t('home.overline')}</div>
              <h1>{t('home.h1a')} <em>{t('home.h1b')}</em> ✈️</h1>
              <p>{t('home.intro')}</p>
            </div>
            <div className="date-stamp"><span className="date-stamp-top">{t('home.stampTop')}</span><span className="date-stamp-value">{`${worldPercent}% · ${explorerTitle}`}</span></div>
          </section>

          <section className="stats-grid" aria-label={t('stats.aria')}>
            <article className="stat-card stat-card-featured reveal" style={revealStyle(1)}><div className="stat-label">{t('stats.countries')}</div><div className="stat-bottom"><strong><CountUp value={countryCount} pad={2} /></strong><span>{t('stats.countriesNote')}</span><span className="stat-icon" aria-hidden="true">🌍</span></div></article>
            <article className="stat-card reveal" style={revealStyle(2)}><div className="stat-label">{t('stats.cities')}</div><div className="stat-bottom"><strong><CountUp value={cityCount} pad={2} /></strong><span>{t('stats.citiesNote')}</span><span className="stat-icon" aria-hidden="true">📍</span></div></article>
            <article className="stat-card reveal" style={revealStyle(3)}><div className="stat-label">{t('stats.memories')}</div><div className="stat-bottom"><strong><CountUp value={entries.length} pad={2} /></strong><span>{t('stats.memoriesNote')}</span><span className="stat-icon" aria-hidden="true">✨</span></div></article>
          </section>

          <WorldProgress countryCount={countryCount} rankTitle={explorerTitle} />

          <section className="content-grid">
            <article className="panel map-panel reveal" style={revealStyle(4)} aria-labelledby="map-heading">
              <div className="panel-heading">
                <div><div className="panel-kicker">{t('map.kicker')}</div><h2 id="map-heading">{t('map.title')}</h2></div>
                <div className="map-legend"><span className="legend-visited" /> {t('map.been')} <span className="legend-unvisited" /> {t('map.dreaming')}</div>
              </div>
              <WorldMap visitedCountryIds={visitedCountryIds} onSelectCountry={openAdd} />
              <div className="map-foot"><span>{t('map.foot')}</span><span>{t('map.marked', { n: countryCount })}</span></div>
            </article>

            <article className="panel recent-panel reveal" style={revealStyle(5)} id="places" aria-labelledby="places-heading">
              <div className="panel-heading recent-heading">
                <div><div className="panel-kicker">{t('recent.kicker')}</div><h2 id="places-heading">{t('recent.title')}</h2></div>
                {entries.length > 0 && <span className="recent-total">{String(entries.length).padStart(2, '0')}</span>}
              </div>
              {recentEntries.length > 0 ? (
                <div className="entry-list">
                  {recentEntries.map((entry, index) => (
                    <article className="entry-card reveal" style={revealStyle(index)} key={entry.id}>
                      <div className={`entry-marker entry-marker-${index % 3}`}><PinIcon small /></div>
                      <div className="entry-copy"><div className="entry-date">{formatDate(entry.date, locale, t('date.none'))}</div><h3>{entry.city}</h3><p className="entry-country"><Flag countryId={entry.countryId} className="flag flag-small" />{countryLabel(entry.countryId, locale, entry.countryName)}</p>{entry.note && <div className="entry-note">“{entry.note}”</div>}<EntryPhotos photos={photosByEntry[entry.id] ?? []} city={entry.city} onOpen={(index) => setGallery({ entryId: entry.id, index })} /></div>
                      <div className="entry-actions"><button type="button" onClick={() => openEdit(entry.id)} aria-label={t('aria.edit', { city: entry.city })}>{t('action.edit')}</button><button type="button" onClick={() => deleteEntry(entry)} aria-label={t('aria.delete', { city: entry.city })}>{t('action.delete')}</button></div>
                    </article>
                  ))}
                  {entries.length > 5 && <button type="button" className="add-another" onClick={() => setShowAll((value) => !value)}>{showAll ? t('action.showFewer') : t('action.showAll', { n: entries.length })} <span>{showAll ? '↑' : '↓'}</span></button>}
                  <button type="button" className="add-another" onClick={() => openAdd()}>{t('action.addAnother')} <span>↗</span></button>
                </div>
              ) : (
                <div className="empty-places">
                  <div className="empty-pin"><PinIcon /></div>
                  <h3>{t('empty.title1')}<br />{t('empty.title2')}</h3>
                  <p>{t('empty.text')}</p>
                  <button className="empty-add" type="button" onClick={() => openAdd()}>{t('action.addFirst')} <span>↗</span></button>
                  {!ready && <span className="loading-note">{t('empty.loading')}</span>}
                </div>
              )}
            </article>
          </section>

          </>
          )}

          <footer className="dashboard-footer"><span>{t('footer.left')}</span><span>{t('footer.right')}</span></footer>
        </main>
      </div>

      {gallery && (photosByEntry[gallery.entryId]?.length ?? 0) > 0 && <PhotoGallery photos={photosByEntry[gallery.entryId]} startIndex={gallery.index} title={entries.find((item) => item.id === gallery.entryId)?.city ?? ''} onClose={() => setGallery(null)} />}

      {accountOpen && <AccountDialog onClose={() => setAccountOpen(false)} />}

      {formOpen && <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setFormOpen(false) }}>
        <section className="entry-modal" role="dialog" aria-modal="true" aria-labelledby="modal-title">
          <div className="modal-top"><div><div className="panel-kicker">{editingEntry ? t('form.kickerEdit') : t('form.kickerNew')}</div><h2 id="modal-title">{editingEntry ? t('form.titleEdit') : t('form.titleNew')}</h2></div><button className="modal-close" type="button" aria-label={t('form.close')} onClick={() => setFormOpen(false)}>×</button></div>
          <p className="modal-intro">{t('form.intro')}</p>
          <form className="entry-form" onSubmit={addEntry} key={editingEntry?.id ?? 'new'}>
            <label>{t('form.country')}<CountryPicker value={formCountry} onChange={setFormCountry} priorityIds={visitedCountryIds} name="country" isRequired /></label>
            <div className="city-field"><label>{t('form.city')}<input name="city" type="text" placeholder={t('form.cityPlaceholder')} value={formCity} onChange={(event) => setFormCity(event.target.value)} autoComplete="off" required maxLength={80} /></label>{suggestions.length > 0 && <div className="city-chips" aria-label={t('form.suggested')}><span>{formCity ? t('form.suggestions') : t('form.popular')}</span>{suggestions.map((city) => <button type="button" key={city} className={city === formCity ? 'chip chip-on' : 'chip'} onClick={() => setFormCity(city)}>{city}</button>)}</div>}</div>
            <div className="form-row"><label>{t('form.when')} <span className="optional">{t('form.optional')}</span><input name="date" type="date" defaultValue={editingEntry?.date} /></label><label>{t('form.note')} <span className="optional">{t('form.optional')}</span><input name="note" type="text" placeholder={t('form.notePlaceholder')} defaultValue={editingEntry?.note} maxLength={120} /></label></div>
            {userEmail ? <PhotoField key={editingEntry?.id ?? 'new'} draft={photoDraft} onChange={setPhotoDraft} /> : <p className="photo-hint">{t('photos.signIn')}</p>}
            <div className="modal-actions"><button className="cancel-button" type="button" onClick={() => setFormOpen(false)}>{t('form.cancel')}</button><button className="save-button" type="submit" disabled={isSaving}>{editingEntry ? t('form.saveEdit') : t('form.saveNew')} <span>↗</span></button></div>
            <div className="privacy-note"><span>i</span> {userEmail ? t('form.privacyCloud') : t('form.privacyLocal')}</div>
          </form>
        </section>
      </div>}
    </div>
  )
}

export default App
