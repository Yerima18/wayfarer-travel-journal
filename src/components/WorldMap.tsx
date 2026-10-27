'use client'

import { ComposableMap, Geographies, Geography, Graticule, Sphere } from 'react-simple-maps'

type WorldMapProps = {
  visitedCountryIds: string[]
}

export default function WorldMap({ visitedCountryIds }: WorldMapProps) {
  const visited = new Set(visitedCountryIds)

  return (
    <div className="map-frame">
      <ComposableMap
        aria-label="World map showing countries in your travel journal"
        className="world-map"
        projection="geoEqualEarth"
        projectionConfig={{ scale: 155, center: [0, 4] }}
        width={800}
        height={390}
      >
        <Sphere fill="#fbfcf8" stroke="#e4e9df" strokeWidth={0.8} />
        <Graticule stroke="#e8ece4" strokeWidth={0.45} step={[20, 20]} />
        <Geographies geography="/countries-110m.json">
          {({ geographies }) => geographies.map((geography) => {
            const isVisited = visited.has(String(geography.id))
            return (
              <Geography
                key={geography.rsmKey}
                geography={geography}
                className={isVisited ? 'map-geography map-geography-visited' : 'map-geography'}
                fill={isVisited ? '#5a8a69' : '#e5e9e1'}
                stroke="#fbfcf8"
                strokeWidth={0.65}
              />
            )
          })}
        </Geographies>
      </ComposableMap>
    </div>
  )
}
