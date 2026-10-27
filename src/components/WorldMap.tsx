'use client'

import { useState } from 'react'
import { countries } from '@/lib/countries'
import Flag from './Flag'
import { useI18n } from '@/lib/i18n'
import { countryLabel } from '@/lib/names'
import { ComposableMap, Geographies, Geography, Graticule, Marker, Sphere } from 'react-simple-maps'

type WorldMapProps = {
  visitedCountryIds: string[]
  onSelectCountry?: (countryId: string) => void
  /** Colours by country id; countries listed here are painted instead of using visited/unvisited colours. */
  fills?: Record<string, string>
  /** Text shown after the country name in the hover bubble. Defaults to the "add a place" hint. */
  describe?: (countryId: string) => string
  selectedId?: string | null
  /** Where the user is, drawn as a pin. */
  pin?: { lat: number; lon: number } | null
}

const selectableIds = new Set(countries.map((country) => country.id))
const VISITED_COLORS = ['#ff6b57', '#ffb627', '#19b8a6', '#7c5cff', '#ff7ab6', '#2f9bff']

function colorFor(id: string) {
  const sum = Array.from(id).reduce((total, char) => total + char.charCodeAt(0), 0)
  return VISITED_COLORS[sum % VISITED_COLORS.length]
}

export default function WorldMap({ visitedCountryIds, onSelectCountry, fills, describe, selectedId, pin }: WorldMapProps) {
  const { locale, t } = useI18n()
  const visited = new Set(visitedCountryIds)
  const [hovered, setHovered] = useState<{ id: string; name: string; visited: boolean; canAdd: boolean } | null>(null)

  return (
    <div className="map-frame">
      <div className={hovered ? 'map-tip map-tip-on' : 'map-tip'} aria-hidden="true">
        {hovered?.canAdd ? <Flag countryId={hovered.id} className="flag flag-small" /> : null}
        <span>{hovered ? `${hovered.visited ? '📍 ' : ''}${hovered.name}${hovered.canAdd ? ` · ${describe ? describe(hovered.id) : t('map.clickToAdd')}` : ''}` : t('map.point')}</span>
      </div>
      <ComposableMap
        aria-label={t('map.aria')}
        className="world-map"
        projection="geoEqualEarth"
        projectionConfig={{ scale: 155, center: [0, 4] }}
        width={800}
        height={390}
      >
        <Sphere className="map-sphere" fill="#d9f0ff" stroke="#b6dcf5" strokeWidth={1} />
        <Graticule className="map-graticule" stroke="#c4e4f8" strokeWidth={0.45} step={[20, 20]} />
        <Geographies geography="/countries-110m.json">
          {({ geographies }) => geographies.map((geography) => {
            const id = String(geography.id)
            const isVisited = visited.has(id)
            const canAdd = selectableIds.has(id)
            const painted = fills?.[id]
            const hover = { id, name: canAdd ? countryLabel(id, locale) : String(geography.properties?.name ?? ''), visited: isVisited, canAdd }
            return (
              <Geography
                key={geography.rsmKey}
                geography={geography}
                className={['map-geography', isVisited && !fills ? 'map-geography-visited' : '', painted ? 'map-geography-filled' : '', selectedId === id ? 'map-geography-selected' : ''].filter(Boolean).join(' ')}
                fill={painted ?? (isVisited && !fills ? colorFor(id) : '#fdf3dc')}
                stroke={(isVisited && !fills) || painted ? '#ffffff' : '#ecdcb8'}
                strokeWidth={0.65}
                onClick={canAdd ? () => onSelectCountry?.(id) : undefined}
                onMouseEnter={() => setHovered(hover)}
                onMouseLeave={() => setHovered(null)}
                onFocus={() => setHovered(hover)}
                onBlur={() => setHovered(null)}
              />
            )
          })}
        </Geographies>
        {pin && (
          <Marker coordinates={[pin.lon, pin.lat]}>
            <circle className="map-pin-ring" r={11} />
            <circle className="map-pin" r={5} />
          </Marker>
        )}
      </ComposableMap>
    </div>
  )
}
