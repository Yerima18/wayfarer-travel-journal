'use client'

import { useState } from 'react'
import { ComposableMap, Geographies, Geography, Graticule, Sphere } from 'react-simple-maps'

type WorldMapProps = {
  visitedCountryIds: string[]
}

const VISITED_COLORS = ['#ff6b57', '#ffb627', '#19b8a6', '#7c5cff', '#ff7ab6', '#2f9bff']

function colorFor(id: string) {
  const sum = Array.from(id).reduce((total, char) => total + char.charCodeAt(0), 0)
  return VISITED_COLORS[sum % VISITED_COLORS.length]
}

export default function WorldMap({ visitedCountryIds }: WorldMapProps) {
  const visited = new Set(visitedCountryIds)
  const [hovered, setHovered] = useState<{ name: string; visited: boolean } | null>(null)

  return (
    <div className="map-frame">
      <div className={hovered ? 'map-tip map-tip-on' : 'map-tip'} aria-hidden="true">
        {hovered ? `${hovered.visited ? '📍 ' : ''}${hovered.name}` : 'Point at a country'}
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
            return (
              <Geography
                key={geography.rsmKey}
                geography={geography}
                className={isVisited ? 'map-geography map-geography-visited' : 'map-geography'}
                fill={isVisited ? colorFor(id) : '#fdf3dc'}
                stroke={isVisited ? '#ffffff' : '#ecdcb8'}
                strokeWidth={0.65}
                onMouseEnter={() => setHovered({ name: String(geography.properties?.name ?? ''), visited: isVisited })}
                onMouseLeave={() => setHovered(null)}
                onFocus={() => setHovered({ name: String(geography.properties?.name ?? ''), visited: isVisited })}
                onBlur={() => setHovered(null)}
              />
            )
          })}
        </Geographies>
      </ComposableMap>
    </div>
  )
}
