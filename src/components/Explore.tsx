'use client'

import { useEffect, useMemo, useState } from 'react'
import CountryPicker from '@/components/CountryPicker'
import Flag from './Flag'
import WorldMap from './WorldMap'
import { countries } from '@/lib/countries'
import { flagCode, flagEmoji } from '@/lib/flags'
import centroids from '@/lib/centroids.json'
import { useI18n } from '@/lib/i18n'
import type { MessageKey } from '@/lib/messages'
import { countryLabel, sortedCountries } from '@/lib/names'
import { countryAt, distancesFrom, loadShapes, type Shapes } from '@/lib/nearby'
import { isSchengen } from '@/lib/schengen'
import {
  STATUS_META,
  applyPermit,
  parseVisa,
  passportCountries,
  type VisaInfo,
  type VisaStatus,
} from '@/lib/visa'

const PASSPORT_KEY = 'wayfarer.passport'
const PERMIT_KEY = 'wayfarer.permit'

export type ExploreFocus = { countryId: string; nonce: number }

type ExploreProps = {
  visitedCountryIds: string[]
  onAddPlace: (countryId: string) => void
  /** A country picked from the search bar; the nonce lets the same country be picked twice. */
  focus?: ExploreFocus | null
}

type Row = { id: string; name: string; info: VisaInfo }
type RowWithDistance = Row & { km: number | null }
type Origin = { lat: number; lon: number }
type Filter = 'all' | 'easy' | VisaStatus
type Sort = 'easiest' | 'closest' | 'az'
const GPS = '__gps'
const passportIds = passportCountries.map((country) => country.id)
const permitIds = countries.filter((country) => isSchengen(flagCode(country.id))).map((country) => country.id)

function readSaved(key: string, allowed: (id: string) => boolean) {
  try {
    const saved = window.localStorage.getItem(key)
    return saved && allowed(saved) ? saved : ''
  } catch {
    return ''
  }
}

function save(key: string, value: string) {
  try {
    window.localStorage.setItem(key, value)
  } catch {
    // The choice still applies for this visit if browser storage is unavailable.
  }
}

export default function Explore({ visitedCountryIds, onAddPlace, focus }: ExploreProps) {
  const { locale, t } = useI18n()
  const [passportId, setPassportId] = useState(() => readSaved(PASSPORT_KEY, (id) => passportCountries.some((country) => country.id === id)))
  const [permitId, setPermitId] = useState(() => readSaved(PERMIT_KEY, (id) => isSchengen(flagCode(id))))
  const [fetched, setFetched] = useState<{ id: string; data: Record<string, string> | null } | null>(null)
  const [filter, setFilter] = useState<Filter>('easy')
  const [sort, setSort] = useState<Sort>('easiest')
  const [query, setQuery] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [handledFocus, setHandledFocus] = useState<number | null>(null)
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

  if (focus && focus.nonce !== handledFocus) {
    setHandledFocus(focus.nonce)
    setSelectedId(focus.countryId)
    setFilter('all')
    setQuery('')
  }

  function choosePassport(id: string) {
    setPassportId(id)
    setLocationId((current) => (current === GPS ? current : ''))
    save(PASSPORT_KEY, id)
  }

  function choosePermit(id: string) {
    setPermitId(id)
    save(PERMIT_KEY, id)
  }

  const label = (id: string) => countryLabel(id, locale)
  const flagged = (id: string) => `${flagEmoji(id) ? `${flagEmoji(id)} ` : ''}${label(id)}`
  const formatKm = (km: number) => `${(km < 1000 ? Math.round(km / 10) * 10 : Math.round(km / 50) * 50).toLocaleString(locale)} km`
  const statusLabel = (info: VisaInfo) => info.resident ? t('status.resident') : info.permit ? t('status.permit') : t(`status.${info.status}` as MessageKey)
  const describe = (info: VisaInfo) => {
    if (info.resident) return t('visa.resident')
    if (info.permit) return t('visa.permit')
    if (info.status === 'free') return info.days ? t('visa.freeDays', { n: info.days }) : t('visa.free')
    return t(`visa.${info.status}` as MessageKey)
  }
  const rowStatus = (info: VisaInfo) => {
    if (info.resident) return t('status.resident')
    if (info.permit) return `${t('status.permitShort')}${info.days ? ` · ${t('days', { n: info.days })}` : ''}`
    if (info.status === 'free' && info.days) return t('days', { n: info.days })
    return statusLabel(info)
  }

  const allCountries = useMemo(() => sortedCountries(locale), [locale])

  const visited = useMemo(() => new Set(visitedCountryIds), [visitedCountryIds])
  const loaded = fetched && fetched.id === passportId ? fetched : null
  const data = loaded?.data ?? null
  const loading = Boolean(passportId) && !loaded
  const failed = Boolean(passportId) && Boolean(loaded) && !data

  const rows = useMemo<Row[]>(() => {
    if (!data) return []
    const permitCode = permitId ? flagCode(permitId) : null
    return countries.map((country) => {
      const code = flagCode(country.id)
      const base = country.id === passportId ? { status: 'self' as const } : parseVisa(code ? data[code.toUpperCase()] : undefined)
      return { id: country.id, name: countryLabel(country.id, locale), info: applyPermit(base, code, permitCode) }
    })
  }, [data, passportId, permitId, locale])

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
      if (sort === 'az') return a.name.localeCompare(b.name, locale)
      if (sort === 'closest') return (a.km ?? far) - (b.km ?? far)
      return STATUS_META[a.info.status].rank - STATUS_META[b.info.status].rank
        || (b.info.days ?? 0) - (a.info.days ?? 0)
        || (a.km ?? far) - (b.km ?? far)
    })
  }, [rows, filter, sort, query, maxKm, distances, hereId, locale])

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

  const hereName = hereId ? label(hereId) : undefined
  const locationNote = gpsStatus === 'locating'
    ? t('near.finding')
    : gpsStatus === 'error'
      ? t('near.noteError')
      : locationId === GPS
        ? hereName ? t('near.noteIn', { name: hereName }) : t('near.noteOutside')
        : t('near.noteDefault')

  const selected = selectedId ? rows.find((row) => row.id === selectedId) : undefined
  const passport = passportCountries.find((country) => country.id === passportId)
  const passportName = passport ? label(passport.id) : ''

  const filters: { key: Filter; label: string; count: number }[] = [
    { key: 'easy', label: t('filter.easy'), count: counts.free + counts.arrival },
    { key: 'free', label: t('filter.free'), count: counts.free },
    { key: 'arrival', label: t('filter.arrival'), count: counts.arrival },
    { key: 'evisa', label: t('filter.evisa'), count: counts.evisa },
    { key: 'required', label: t('filter.required'), count: counts.required },
    { key: 'all', label: t('filter.all'), count: rows.length - 1 },
  ]

  return (
    <section className="explore" aria-labelledby="explore-heading">
      <div className="places-head">
        <div>
          <div className="overline"><span className="overline-line" /> {t('explore.overline')}</div>
          <h1 id="explore-heading">{t('explore.h1a')} <em>{t('explore.h1b')}</em> 🧭</h1>
          <p>{t('explore.intro')}</p>
        </div>
        <label className="passport-picker">
          <span>{t('explore.passport')}</span>
          <CountryPicker value={passportId} onChange={choosePassport} candidateIds={passportIds} placeholder={t('explore.choose')} ariaLabel={t('explore.passport')} />
        </label>
      </div>

      {!passportId && (
        <div className="panel places-empty">
          <div className="empty-pin"><span aria-hidden="true">🛂</span></div>
          <h3>{t('explore.emptyTitle')}</h3>
          <p>{t('explore.emptyText')}</p>
        </div>
      )}

      {loading && <div className="panel places-empty"><p>{t('explore.loading')}</p></div>}
      {failed && <div className="panel places-empty"><h3>{t('explore.failedTitle')}</h3><p>{t('explore.failedText')}</p></div>}

      {data && passport && (
        <>
          <div className="near-me panel">
            <div className="near-me-head"><span aria-hidden="true">🪪</span><h2>{t('permit.title')}</h2></div>
            <div className="permit-row">
              <label>{t('permit.label')}
                <CountryPicker value={permitId} onChange={choosePermit} candidateIds={permitIds} emptyLabel={t('permit.none')} placeholder={t('permit.none')} ariaLabel={t('permit.label')} />
              </label>
            </div>
            <p className="near-me-note"><span className="near-me-main">{t('permit.hint')}</span></p>
          </div>

          <div className="near-me panel">
            <div className="near-me-head"><span aria-hidden="true">📍</span><h2>{t('near.title')}</h2></div>
            <div className="near-me-controls">
              <label>{t('near.imIn')}
                <select value={locationId} onChange={(event) => chooseLocation(event.target.value)}>
                  <option value="">{t('near.passportCountry', { name: passportName })}</option>
                  {gps && <option value={GPS}>{t('near.currentLocation')}</option>}
                  {allCountries.map((country) => <option value={country.id} key={country.id}>{flagged(country.id)}</option>)}
                </select>
              </label>
              <button type="button" className="gps-button" onClick={locateMe} disabled={gpsStatus === 'locating'}>{gpsStatus === 'locating' ? t('near.finding') : t('near.useLocation')}</button>
              <label>{t('near.within')}
                <select value={maxKm} onChange={(event) => setMaxKm(Number(event.target.value))}>
                  <option value={0}>{t('near.any')}</option>
                  <option value={500}>{`500 km`}</option>
                  <option value={1500}>{`${(1500).toLocaleString(locale)} km`}</option>
                  <option value={3000}>{`${(3000).toLocaleString(locale)} km`}</option>
                </select>
              </label>
            </div>
            <p className="near-me-note" role="status"><span className="near-me-main">{locationNote}</span><span>{t('near.privacy')}</span></p>
          </div>

          <div className="explore-summary" role="group" aria-label={t('explore.filterAria')}>
            {filters.map((item) => (
              <button type="button" key={item.key} className={filter === item.key ? 'summary-chip summary-chip-on' : 'summary-chip'} onClick={() => setFilter(item.key)}>
                <strong>{item.count}</strong><span>{item.label}</span>
              </button>
            ))}
          </div>

          <div className="content-grid">
            <article className="panel map-panel" aria-labelledby="explore-map-heading">
              <div className="panel-heading">
                <div><div className="panel-kicker">{t('explore.mapKicker', { name: passportName.toUpperCase() })}</div><h2 id="explore-map-heading">{t('explore.mapTitle')}</h2></div>
              </div>
              <WorldMap
                visitedCountryIds={visitedCountryIds}
                fills={fills}
                selectedId={selectedId}
                pin={locationId === GPS ? gps : null}
                onSelectCountry={setSelectedId}
                describe={(id) => {
                  const row = rows.find((item) => item.id === id)
                  return row ? statusLabel(row.info) : t('status.unknown')
                }}
              />
              <ul className="visa-legend">
                {(['free', 'arrival', 'evisa', 'required', 'banned'] as const).map((status) => (
                  <li key={status}><span style={{ background: STATUS_META[status].color }} />{t(`status.${status}` as MessageKey)}</li>
                ))}
              </ul>
            </article>

            <article className="panel recent-panel explore-list" aria-labelledby="explore-list-heading">
              <div className="panel-heading recent-heading">
                <div><div className="panel-kicker">{t('explore.count', { n: listed.length })}</div><h2 id="explore-list-heading">{t('explore.listTitle')}</h2></div>
              </div>
              <div className="explore-tools">
                <input type="search" placeholder={t('explore.search')} value={query} onChange={(event) => setQuery(event.target.value)} aria-label={t('explore.searchAria')} />
                <select value={sort} onChange={(event) => setSort(event.target.value as Sort)} aria-label={t('explore.sortAria')}>
                  <option value="easiest">{t('explore.sortEasiest')}</option>
                  <option value="closest">{locationId === GPS ? t('explore.sortClosestMe') : t('explore.sortClosestPlace', { name: hereName ?? passportName })}</option>
                  <option value="az">{t('explore.sortAz')}</option>
                </select>
              </div>

              {selected && (
                <div className="visa-detail" role="region" aria-label={t('explore.detailAria', { name: selected.name })}>
                  <div className="visa-detail-head">
                    <Flag countryId={selected.id} className="flag flag-large" />
                    <h3>{selected.name}</h3>
                    <button type="button" className="visa-detail-close" onClick={() => setSelectedId(null)} aria-label={t('explore.closeDetail')}>×</button>
                  </div>
                  <div className="visa-status"><span style={{ background: STATUS_META[selected.info.status].color || '#cbbf9c' }} />{statusLabel(selected.info)}</div>
                  <p>{describe(selected.info)}</p>
                  {kmTo(selected.id) !== null && <p className="visa-distance">{kmTo(selected.id) === 0 ? t('near.hereNow') : t('near.about', { km: formatKm(kmTo(selected.id) ?? 0) })}</p>}
                  {visited.has(selected.id) && <p className="visa-visited">{t('explore.visited')}</p>}
                  {selected.info.status !== 'self' && <button type="button" className="empty-add" onClick={() => onAddPlace(selected.id)}>{t('explore.addToJournal')} <span>↗</span></button>}
                </div>
              )}

              <ul className="visa-list">
                {listed.map((row) => (
                  <li key={row.id}>
                    <button type="button" className={row.id === selectedId ? 'visa-row visa-row-on' : 'visa-row'} onClick={() => setSelectedId(row.id)}>
                      <Flag countryId={row.id} className="flag flag-small" />
                      <span className="visa-row-name">{visited.has(row.id) ? `${row.name} 📍` : row.name}</span>
                      <span className="visa-row-meta">
                        <span className="visa-row-status"><i style={{ background: STATUS_META[row.info.status].color || '#cbbf9c' }} />{rowStatus(row.info)}</span>
                        {row.km !== null && <span className="visa-row-dist">{row.km === 0 ? t('near.here') : formatKm(row.km)}</span>}
                      </span>
                    </button>
                  </li>
                ))}
                {listed.length === 0 && <li className="visa-empty">{t('explore.nothing')}</li>}
              </ul>
            </article>
          </div>

          <p className="visa-disclaimer">{t('explore.disclaimer')}</p>
        </>
      )}
    </section>
  )
}
