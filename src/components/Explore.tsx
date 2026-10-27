'use client'

import { useEffect, useMemo, useState } from 'react'
import Flag from './Flag'
import WorldMap from './WorldMap'
import { countries } from '@/lib/countries'
import { flagCode, flagEmoji } from '@/lib/flags'
import centroids from '@/lib/centroids.json'
import { countryAt, distancesFrom, loadShapes, type Shapes } from '@/lib/nearby'
import {
  STATUS_META,
  describeVisa,
  parseVisa,
  passportCountries,
  type VisaInfo,
  type VisaStatus,
} from '@/lib/visa'

const PASSPORT_KEY = 'wayfarer.passport'

type ExploreProps = {
  visitedCountryIds: string[]
  onAddPlace: (countryId: string) => void
}

type Row = { id: string; name: string; info: VisaInfo }
type RowWithDistance = Row & { km: number | null }
type Origin = { lat: number; lon: number }
const GPS = '__gps'
type Filter = 'all' | 'easy' | VisaStatus
type Sort = 'easiest' | 'closest' | 'az'

function formatKm(km: number) {
  return `${(km < 1000 ? Math.round(km / 10) * 10 : Math.round(km / 50) * 50).toLocaleString('en')} km`
}

function readSavedPassport() {
  try {
    const saved = window.localStorage.getItem(PASSPORT_KEY)
    return saved && passportCountries.some((country) => country.id === saved) ? saved : ''
  } catch {
    return ''
  }
}

export default function Explore({ visitedCountryIds, onAddPlace }: ExploreProps) {
  const [passportId, setPassportId] = useState(readSavedPassport)
  const [fetched, setFetched] = useState<{ id: string; data: Record<string, string> | null } | null>(null)
  const [filter, setFilter] = useState<Filter>('easy')
  const [sort, setSort] = useState<Sort>('easiest')
  const [query, setQuery] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [shapes, setShapes] = useState<Shapes | null>(null)
  const [locationId, setLocationId] = useState('') // '' = passport country, GPS = device location, otherwise a country id
  const [gps, setGps] = useState<Origin | null>(null)
  const [gpsStatus, setGpsStatus] = useState<'idle' | 'locating' | 'error'>('idle')
  const [maxKm, setMaxKm] = useState(0)

  useEffect(() => {
    let active = true
    loadShapes().then((loadedShapes) => { if (active) setShapes(loadedShapes) }).catch(() => {})
    return () => { active = false }
  }, [])

  useEffect(() => {
    const code = passportId ? flagCode(passportId) : null
    if (!code) return
    let active = true
    fetch(`/visa/${code}.json`)
      .then((response) => (response.ok ? (response.json() as Promise<Record<string, string>>) : null))
      .catch(() => null)
      .then((data) => { if (active) setFetched({ id: passportId, data }) })
    return () => { active = false }
  }, [passportId])

  function choosePassport(id: string) {
    setPassportId(id)
    setSelectedId(null)
    setLocationId((current) => (current === GPS ? current : ''))
    try {
      window.localStorage.setItem(PASSPORT_KEY, id)
    } catch {
      // The choice still applies for this visit if browser storage is unavailable.
    }
  }

  const visited = useMemo(() => new Set(visitedCountryIds), [visitedCountryIds])
  const loaded = fetched && fetched.id === passportId ? fetched : null
  const data = loaded?.data ?? null
  const loading = Boolean(passportId) && !loaded
  const failed = Boolean(passportId) && Boolean(loaded) && !data

  const rows = useMemo<Row[]>(() => {
    if (!data) return []
    return countries.map((country) => {
      const code = flagCode(country.id)
      const info = country.id === passportId ? { status: 'self' as const } : parseVisa(code ? data[code.toUpperCase()] : undefined)
      return { id: country.id, name: country.name, info }
    })
  }, [data, passportId])

  const counts = useMemo(() => {
    const total: Record<string, number> = { free: 0, arrival: 0, evisa: 0, required: 0, banned: 0, unknown: 0 }
    rows.forEach((row) => { if (row.info.status !== 'self') total[row.info.status] += 1 })
    return total
  }, [rows])

  const fills = useMemo(() => {
    const colours: Record<string, string> = {}
    rows.forEach((row) => {
      const colour = STATUS_META[row.info.status].color
      if (colour) colours[row.id] = colour
    })
    return colours
  }, [rows])

  const origin = useMemo<Origin | null>(() => {
    if (locationId === GPS && gps) return gps
    const centre = (centroids as Record<string, number[]>)[locationId && locationId !== GPS ? locationId : passportId]
    return centre ? { lat: centre[1], lon: centre[0] } : null
  }, [locationId, gps, passportId])

  const distances = useMemo(() => (shapes && origin ? distancesFrom(origin.lat, origin.lon, shapes) : null), [shapes, origin])
  const hereId = locationId === GPS ? (distances ? countryAt(distances) : null) : locationId || passportId

  function kmTo(id: string): number | null {
    if (id === hereId) return 0
    const km = distances?.get(id)
    return km === undefined || !Number.isFinite(km) ? null : km
  }

  const listed = useMemo<RowWithDistance[]>(() => {
    const text = query.trim().toLowerCase()
    const withDistance = rows.map((row) => ({ ...row, km: row.id === hereId ? 0 : distances?.get(row.id) ?? null }))
    const matches = withDistance.filter((row) => {
      if (row.info.status === 'self') return false
      if (text && !row.name.toLowerCase().includes(text)) return false
      if (maxKm > 0 && (row.km === null || row.km > maxKm)) return false
      if (filter === 'all') return true
      if (filter === 'easy') return row.info.status === 'free' || row.info.status === 'arrival'
      return row.info.status === filter
    })
    const far = Number.POSITIVE_INFINITY
    return matches.sort((a, b) => {
      if (sort === 'az') return a.name.localeCompare(b.name)
      if (sort === 'closest') return (a.km ?? far) - (b.km ?? far)
      return STATUS_META[a.info.status].rank - STATUS_META[b.info.status].rank
        || (b.info.days ?? 0) - (a.info.days ?? 0)
        || (a.km ?? far) - (b.km ?? far)
    })
  }, [rows, filter, sort, query, maxKm, distances, hereId])

  function locateMe() {
    if (!('geolocation' in navigator)) {
      setGpsStatus('error')
      return
    }
    setGpsStatus('locating')
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setGps({ lat: position.coords.latitude, lon: position.coords.longitude })
        setLocationId(GPS)
        setSort('closest')
        setGpsStatus('idle')
      },
      () => setGpsStatus('error'),
      { timeout: 10000, maximumAge: 600000 },
    )
  }

  function chooseLocation(id: string) {
    setLocationId(id)
    if (id) setSort('closest')
  }

  const hereName = hereId ? countries.find((country) => country.id === hereId)?.name : undefined
  const locationNote = gpsStatus === 'locating'
    ? 'Finding you…'
    : gpsStatus === 'error'
      ? 'Couldn’t get your location. Allow location access in your browser, or pick the country you’re in.'
      : locationId === GPS
        ? hereName ? `You’re in ${hereName}.` : 'You’re outside every country on the map, so distances are from your exact spot.'
        : 'Distances are straight-line to each country’s nearest border. Use your location for exact numbers.'

  const selected = selectedId ? rows.find((row) => row.id === selectedId) : undefined
  const passport = passportCountries.find((country) => country.id === passportId)

  const filters: { key: Filter; label: string; count: number }[] = [
    { key: 'easy', label: 'Easy to enter', count: counts.free + counts.arrival },
    { key: 'free', label: 'Visa-free', count: counts.free },
    { key: 'arrival', label: 'On arrival', count: counts.arrival },
    { key: 'evisa', label: 'e-Visa', count: counts.evisa },
    { key: 'required', label: 'Visa required', count: counts.required },
    { key: 'all', label: 'Everything', count: rows.length - 1 },
  ]

  return (
    <section className="explore" aria-labelledby="explore-heading">
      <div className="places-head">
        <div>
          <div className="overline"><span className="overline-line" /> PASSPORT CHECKER</div>
          <h1 id="explore-heading">Where can you <em>go?</em> 🧭</h1>
          <p>Pick your passport and see which countries are easy to enter.</p>
        </div>
        <label className="passport-picker">
          <span>My passport</span>
          <select value={passportId} onChange={(event) => choosePassport(event.target.value)}>
            <option value="">Choose a country</option>
            {passportCountries.map((country) => <option value={country.id} key={country.id}>{flagEmoji(country.id) ? `${flagEmoji(country.id)} ` : ''}{country.name}</option>)}
          </select>
        </label>
      </div>

      {!passportId && (
        <div className="panel places-empty">
          <div className="empty-pin"><span aria-hidden="true">🛂</span></div>
          <h3>Which passport do you hold?</h3>
          <p>Choose it above and the map will light up with every country you can visit easily. We remember your choice on this device.</p>
        </div>
      )}

      {loading && <div className="panel places-empty"><p>Loading visa rules…</p></div>}
      {failed && <div className="panel places-empty"><h3>Couldn’t load the rules</h3><p>Check your connection and pick your passport again.</p></div>}

      {data && passport && (
        <>
          <div className="near-me panel">
            <div className="near-me-head"><span aria-hidden="true">📍</span><h2>Near me</h2></div>
            <div className="near-me-controls">
              <label>I’m in
                <select value={locationId} onChange={(event) => chooseLocation(event.target.value)}>
                  <option value="">My passport’s country ({passport.name})</option>
                  {gps && <option value={GPS}>📍 My current location</option>}
                  {countries.map((country) => <option value={country.id} key={country.id}>{flagEmoji(country.id) ? `${flagEmoji(country.id)} ` : ''}{country.name}</option>)}
                </select>
              </label>
              <button type="button" className="gps-button" onClick={locateMe} disabled={gpsStatus === 'locating'}>{gpsStatus === 'locating' ? 'Finding you…' : '📍 Use my location'}</button>
              <label>Within
                <select value={maxKm} onChange={(event) => setMaxKm(Number(event.target.value))}>
                  <option value={0}>Any distance</option>
                  <option value={500}>500 km</option>
                  <option value={1500}>1,500 km</option>
                  <option value={3000}>3,000 km</option>
                </select>
              </label>
            </div>
            <p className="near-me-note" role="status"><span className="near-me-main">{locationNote}</span><span>Your location stays in this browser and is never saved or sent anywhere.</span></p>
          </div>

          <div className="explore-summary" role="group" aria-label="Filter countries by entry rule">
            {filters.map((item) => (
              <button type="button" key={item.key} className={filter === item.key ? 'summary-chip summary-chip-on' : 'summary-chip'} onClick={() => setFilter(item.key)}>
                <strong>{item.count}</strong><span>{item.label}</span>
              </button>
            ))}
          </div>

          <div className="content-grid">
            <article className="panel map-panel" aria-labelledby="explore-map-heading">
              <div className="panel-heading">
                <div><div className="panel-kicker">{`WITH A ${passport.name.toUpperCase()} PASSPORT`}</div><h2 id="explore-map-heading">Your open doors</h2></div>
              </div>
              <WorldMap
                visitedCountryIds={visitedCountryIds}
                fills={fills}
                selectedId={selectedId}
                pin={locationId === GPS ? gps : null}
                onSelectCountry={setSelectedId}
                describe={(id) => STATUS_META[rows.find((row) => row.id === id)?.info.status ?? 'unknown'].label}
              />
              <ul className="visa-legend">
                {(['free', 'arrival', 'evisa', 'required', 'banned'] as const).map((status) => (
                  <li key={status}><span style={{ background: STATUS_META[status].color }} />{STATUS_META[status].label}</li>
                ))}
              </ul>
            </article>

            <article className="panel recent-panel explore-list" aria-labelledby="explore-list-heading">
              <div className="panel-heading recent-heading">
                <div><div className="panel-kicker">{`${listed.length} ${listed.length === 1 ? 'COUNTRY' : 'COUNTRIES'}`}</div><h2 id="explore-list-heading">Where to next</h2></div>
              </div>
              <div className="explore-tools">
                <input type="search" placeholder="Search" value={query} onChange={(event) => setQuery(event.target.value)} aria-label="Search a country" />
                <select value={sort} onChange={(event) => setSort(event.target.value as Sort)} aria-label="Sort countries">
                  <option value="easiest">Easiest first</option>
                  <option value="closest">{locationId === GPS ? 'Closest to me' : `Closest to ${hereName ?? passport.name}`}</option>
                  <option value="az">A to Z</option>
                </select>
              </div>

              {selected && (
                <div className="visa-detail" role="region" aria-label={`Entry rules for ${selected.name}`}>
                  <div className="visa-detail-head">
                    <Flag countryId={selected.id} className="flag flag-large" />
                    <h3>{selected.name}</h3>
                    <button type="button" className="visa-detail-close" onClick={() => setSelectedId(null)} aria-label="Close details">×</button>
                  </div>
                  <div className="visa-status"><span style={{ background: STATUS_META[selected.info.status].color || '#cbbf9c' }} />{STATUS_META[selected.info.status].label}</div>
                  <p>{describeVisa(selected.info)}</p>
                  {kmTo(selected.id) !== null && <p className="visa-distance">{kmTo(selected.id) === 0 ? 'You’re here right now.' : `About ${formatKm(kmTo(selected.id) ?? 0)} from you, in a straight line.`}</p>}
                  {visited.has(selected.id) && <p className="visa-visited">📍 You’ve been here.</p>}
                  {selected.info.status !== 'self' && <button type="button" className="empty-add" onClick={() => onAddPlace(selected.id)}>Add to my journal <span>↗</span></button>}
                </div>
              )}

              <ul className="visa-list">
                {listed.map((row) => (
                  <li key={row.id}>
                    <button type="button" className={row.id === selectedId ? 'visa-row visa-row-on' : 'visa-row'} onClick={() => setSelectedId(row.id)}>
                      <Flag countryId={row.id} className="flag flag-small" />
                      <span className="visa-row-name">{visited.has(row.id) ? `${row.name} 📍` : row.name}</span>
                      <span className="visa-row-meta">
                        <span className="visa-row-status"><i style={{ background: STATUS_META[row.info.status].color || '#cbbf9c' }} />{row.info.status === 'free' && row.info.days ? `${row.info.days} days` : STATUS_META[row.info.status].label}</span>
                        {row.km !== null && <span className="visa-row-dist">{row.km === 0 ? 'You’re here' : formatKm(row.km)}</span>}
                      </span>
                    </button>
                  </li>
                ))}
                {listed.length === 0 && <li className="visa-empty">Nothing matches. Try another filter.</li>}
              </ul>
            </article>
          </div>

          <p className="visa-disclaimer">
            Visa data comes from the open Passport Index dataset and was last updated in January 2025. Rules change often and some stays depend on how you travel,
            so always confirm with the official government or embassy website before you book. Distances are straight lines to the nearest border, not travel routes or times,
            and if you live somewhere on a residence permit you may have easier entry than your passport shows.
          </p>
        </>
      )}
    </section>
  )
}
