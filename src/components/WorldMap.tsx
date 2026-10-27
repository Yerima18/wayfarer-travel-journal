'use client'

import { useState } from 'react'
import { countries } from '@/lib/countries'
import Flag from './Flag'
import { ComposableMap, Geographies, Geography, Graticule, Sphere } from 'react-simple-maps'

type WorldMapProps = {
  visitedCountryIds: string[]
  onSelectCountry?: (countryId: string) => void
}

const selectableIds = new Set(countries.map((country) => country.id))
const VISITED_COLORS = ['#ff6b57', '#ffb627', '#19b8a6', '#7c5cff', '#ff7ab6', '#2f9bff']

function colorFor(id: string) {
  const sum = Array.from(id).reduce((total, char) => total + char.charCodeAt(0), 0)
  return VISITED_COLORS[sum % VISITED_COLORS.length]
}

export default function WorldMap({ visitedCountryIds, onSelectCountry }: WorldMapProps) {
  const visited = new Set(visitedCountryIds)
  const [hovered, setHovered] = useState<{ id: string; name: string; visited: boolean; canAdd: boolean } | null>(null)

  return (
    <div className="map-frame">
      <div className={hovered ? 'map-tip map-tip-on' : 'map-tip'} aria-hidden="true">
        {hovered ? <>{hovered.canAdd && <Flag countryId={hovered.id} className="flag flag-small" />}{hovered.visited ? '📍 ' : ''}{hovered.name}{hovered.canAdd ? ' · click to add a place' : ''}</> : 'Point at a country'}
      </div>
      <ComposableMap
        aria-label="World map showing countries in your travel journal"
        className="world-map"
        projection="geoEqualEarth"
        projectionConfig={{ scale: 155, center: [0, 4] }}
        width={800}
        height={390}
      >
        <Sphere fill="#d9f0ff" stroke="#b6dcf5" strokeWidth={1} />
        <Graticule stroke="#c4e4f8" strokeWidth={0.45} step={[20, 20]} />
        <Geographies geography="/countries-110m.json">
          {({ geographies }) => geographies.map((geography) => {
            const id = String(geography.id)
            const isVisited = visited.has(id)
            const canAdd = selectableIds.has(id)
            const hover = { id, name: String(geography.properties?.name ?? ''), visited: isVisited, canAdd }
            return (
              <Geography
                key={geography.rsmKey}
                geography={geography}
                className={isVisited ? 'map-geography map-geography-visited' : 'map-geography'}
                fill={isVisited ? colorFor(id) : '#fdf3dc'}
                stroke={isVisited ? '#ffffff' : '#ecdcb8'}
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
      </ComposableMap>
    </div>
  )
}
