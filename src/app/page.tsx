'use client'

import { FormEvent, useEffect, useMemo, useRef, useState } from 'react'
import WorldMap from '@/components/WorldMap'
import AccountDialog from '@/components/AccountDialog'
import { countries } from '@/lib/countries'
import { createClient } from '@/lib/supabase/client'
import { isSupabaseConfigured } from '@/lib/supabase/env'

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

function formatDate(value: string) {
  if (!value) return 'DATE NOT SET'
  const date = new Date(`${value}T12:00:00`)
  return new Intl.DateTimeFormat('en', { month: 'short', year: 'numeric' }).format(date).toUpperCase()
}

function PinIcon({ small = false }: { small?: boolean }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" className={small ? 'pin-icon pin-icon-small' : 'pin-icon'}>
      <path d="M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 1 1 14 0Z" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="12" cy="10" r="2.2" stroke="currentColor" strokeWidth="1.6" />
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
  const [entries, setEntries] = useState<JournalEntry[]>([])
  const [ready, setReady] = useState(false)
  const [storageWritable, setStorageWritable] = useState(false)
  const [storageWarning, setStorageWarning] = useState(false)
  const [formOpen, setFormOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [showAll, setShowAll] = useState(false)
  const [accountOpen, setAccountOpen] = useState(false)
  const [userEmail, setUserEmail] = useState<string | null>(null)
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
    if (!formOpen) return
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setFormOpen(false)
    }
    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [formOpen])

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

    if (editingEntry) {
      if (userEmail) {
        setCloudStatus('syncing')
        const { error } = await createClient()
          .from('travel_entries')
          .update({ country_id: countryId, country_name: country.name, city, visited_on: date || null, note })
          .eq('id', editingEntry.id)
        if (error) {
          setCloudStatus('error')
          setStorageWarning(true)
          return
        }
        setCloudStatus('synced')
      }
      setEntries((current) => current.map((item) => item.id === editingEntry.id
        ? { ...item, countryId, countryName: country.name, city, date, note }
        : item))
      setFormOpen(false)
      return
    }

    const entry: JournalEntry = {
      id: window.crypto.randomUUID(),
      countryId,
      countryName: country.name,
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
    } else {
      setEntries((current) => [entry, ...current])
    }
    setFormOpen(false)
  }

  function openAdd() {
    setEditingId(null)
    setFormOpen(true)
  }

  function openEdit(id: string) {
    setEditingId(id)
    setFormOpen(true)
  }

  async function deleteEntry(entry: JournalEntry) {
    if (!window.confirm(`Remove ${entry.city} from your journal?`)) return
    if (userEmail) {
      setCloudStatus('syncing')
      const { error } = await createClient().from('travel_entries').delete().eq('id', entry.id)
      if (error) {
        setCloudStatus('error')
        setStorageWarning(true)
        return
      }
      setCloudStatus('synced')
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

  const recentEntries = showAll ? entries : entries.slice(0, 5)

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a className="brand" href="#overview" aria-label="Wayfarer home">
          <span className="brand-symbol"><AppMark /></span>
          <span className="brand-name">wayfarer</span>
        </a>
        <div className="brand-caption">A PERSONAL TRAVEL JOURNAL</div>

        <div className="nav-label">YOUR SPACE</div>
        <nav className="side-nav" aria-label="Journal navigation">
          <a className="nav-link nav-link-active" href="#overview"><span className="nav-glyph nav-glyph-home" />Overview</a>
          <a className="nav-link" href="#places"><span className="nav-glyph nav-glyph-pin"><PinIcon small /></span>My places<span className="nav-count">{entries.length}</span></a>
        </nav>

        <div className="sidebar-bottom">
          <div className="sidebar-orbit" aria-hidden="true"><span /><i /><b /></div>
          <div className="sidebar-bottom-title">Everywhere<br />starts somewhere.</div>
          <p>{userEmail ? 'Your journal syncs securely to your account.' : 'Your journal is saved in this browser for now.'}</p>
          <button className="sidebar-add" type="button" onClick={openAdd}><span>＋</span> Add a place</button>
        </div>
        <div className="sidebar-footer"><span className="status-dot" /> YOUR PERSONAL ATLAS</div>
      </aside>

      <div className="main-column" id="overview">
        <header className="topbar">
          <div className="breadcrumb"><span>YOUR ATLAS</span><i>/</i><b>OVERVIEW</b></div>
          <div className="topbar-right"><span className={storageWarning || cloudStatus === 'error' ? 'saved-pill saved-pill-warning' : 'saved-pill'} role="status"><span />{userEmail ? cloudStatus === 'syncing' ? ' Syncing your journal' : cloudStatus === 'error' ? ' Sync issue — check your connection' : ' Synced to your account' : storageWarning ? ' Saved data preserved; changes stay in this session' : ' Saved on this device'}</span>{userEmail ? <button className="account-button" type="button" onClick={signOut}>Sign out</button> : <button className="account-button" type="button" onClick={() => setAccountOpen(true)}>Sign in</button>}<button className="top-add" type="button" onClick={openAdd}><span>＋</span> Add a place</button></div>
        </header>

        <main className="dashboard">
          {importAvailable && <div className="import-notice" role="status"><span>Your browser has {localEntriesSnapshot.length} saved {localEntriesSnapshot.length === 1 ? 'place' : 'places'} that are not in this account yet.</span><button type="button" onClick={importLocalJournal}>Import browser journal</button></div>}
          <section className="welcome-row">
            <div>
              <div className="overline"><span className="overline-line" /> YOUR STORY, IN PLACES</div>
              <h1>Somewhere, <em>remembered.</em></h1>
              <p>Collect the places you’ve been and the little moments that made them yours.</p>
            </div>
            <div className="date-stamp"><span className="date-stamp-top">YOUR JOURNEY</span><span className="date-stamp-value">ONE PLACE AT A TIME</span></div>
          </section>

          <section className="stats-grid" aria-label="Travel journal totals">
            <article className="stat-card stat-card-featured"><div className="stat-label">COUNTRIES</div><div className="stat-bottom"><strong>{String(countryCount).padStart(2, '0')}</strong><span>on your map</span><span className="stat-icon stat-icon-globe">◎</span></div></article>
            <article className="stat-card"><div className="stat-label">CITIES</div><div className="stat-bottom"><strong>{String(cityCount).padStart(2, '0')}</strong><span>little dots in the world</span><span className="stat-icon"><PinIcon small /></span></div></article>
            <article className="stat-card"><div className="stat-label">MEMORIES</div><div className="stat-bottom"><strong>{String(entries.length).padStart(2, '0')}</strong><span>chapters collected</span><span className="stat-icon stat-icon-spark">✳</span></div></article>
          </section>

          <section className="content-grid">
            <article className="panel map-panel" aria-labelledby="map-heading">
              <div className="panel-heading">
                <div><div className="panel-kicker">THE BIG PICTURE</div><h2 id="map-heading">Your world, so far</h2></div>
                <div className="map-legend"><span className="legend-visited" /> Been there <span className="legend-unvisited" /> Still dreaming</div>
              </div>
              <WorldMap visitedCountryIds={visitedCountryIds} />
              <div className="map-foot"><span>EVERY PIN HAS A STORY</span><span>{countryCount} {countryCount === 1 ? 'COUNTRY' : 'COUNTRIES'} MARKED</span></div>
            </article>

            <article className="panel recent-panel" id="places" aria-labelledby="places-heading">
              <div className="panel-heading recent-heading">
                <div><div className="panel-kicker">POSTCARDS FROM YOU</div><h2 id="places-heading">Recent places</h2></div>
                {entries.length > 0 && <span className="recent-total">{String(entries.length).padStart(2, '0')}</span>}
              </div>
              {recentEntries.length > 0 ? (
                <div className="entry-list">
                  {recentEntries.map((entry, index) => (
                    <article className="entry-card" key={entry.id}>
                      <div className={`entry-marker entry-marker-${index % 3}`}><PinIcon small /></div>
                      <div className="entry-copy"><div className="entry-date">{formatDate(entry.date)}</div><h3>{entry.city}</h3><p>{entry.countryName}</p>{entry.note && <div className="entry-note">“{entry.note}”</div>}</div>
                      <div className="entry-actions"><button type="button" onClick={() => openEdit(entry.id)} aria-label={`Edit ${entry.city}`}>Edit</button><button type="button" onClick={() => deleteEntry(entry)} aria-label={`Delete ${entry.city}`}>Delete</button></div>
                    </article>
                  ))}
                  {entries.length > 5 && <button type="button" className="add-another" onClick={() => setShowAll((value) => !value)}>{showAll ? 'Show fewer' : `Show all ${entries.length}`} <span>{showAll ? '↑' : '↓'}</span></button>}
                  <button type="button" className="add-another" onClick={openAdd}>Add another memory <span>↗</span></button>
                </div>
              ) : (
                <div className="empty-places">
                  <div className="empty-pin"><PinIcon /></div>
                  <h3>Your first story<br />is waiting.</h3>
                  <p>Add a city you’ve visited. It’ll find its place on your map.</p>
                  <button className="empty-add" type="button" onClick={openAdd}>Add your first place <span>↗</span></button>
                  {!ready && <span className="loading-note">Loading your journal…</span>}
                </div>
              )}
            </article>
          </section>

          <footer className="dashboard-footer"><span>MADE TO HOLD THE PLACES THAT HOLD YOU</span><span>WAYFARER <i>·</i> A TRAVEL JOURNAL</span></footer>
        </main>
      </div>

      {accountOpen && <AccountDialog onClose={() => setAccountOpen(false)} />}

      {formOpen && <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setFormOpen(false) }}>
        <section className="entry-modal" role="dialog" aria-modal="true" aria-labelledby="modal-title">
          <div className="modal-top"><div><div className="panel-kicker">{editingEntry ? 'EDIT MEMORY' : 'A NEW MEMORY'}</div><h2 id="modal-title">{editingEntry ? 'Update this place' : 'Where have you been?'}</h2></div><button className="modal-close" type="button" aria-label="Close form" onClick={() => setFormOpen(false)}>×</button></div>
          <p className="modal-intro">Add a place to your personal atlas. You can fill in just the basics.</p>
          <form className="entry-form" onSubmit={addEntry} key={editingEntry?.id ?? 'new'}>
            <label>Country<select name="country" defaultValue={editingEntry?.countryId ?? ''} required><option value="" disabled>Choose a country</option>{countries.map((country) => <option value={country.id} key={country.id}>{country.name}</option>)}</select></label>
            <label>City<input name="city" type="text" placeholder="Where did you go?" defaultValue={editingEntry?.city} autoComplete="address-level2" required maxLength={80} /></label>
            <div className="form-row"><label>When <span className="optional">OPTIONAL</span><input name="date" type="date" defaultValue={editingEntry?.date} /></label><label>A little note <span className="optional">OPTIONAL</span><input name="note" type="text" placeholder="A moment to remember…" defaultValue={editingEntry?.note} maxLength={120} /></label></div>
            <div className="modal-actions"><button className="cancel-button" type="button" onClick={() => setFormOpen(false)}>Maybe later</button><button className="save-button" type="submit">{editingEntry ? 'Save changes' : 'Save this place'} <span>↗</span></button></div>
            <div className="privacy-note"><span>i</span> {userEmail ? 'Private to your account and synced across devices.' : 'Saved only in this browser until you sign in.'}</div>
          </form>
        </section>
      </div>}
    </div>
  )
}

export default App
