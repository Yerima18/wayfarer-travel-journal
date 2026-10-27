// Distances from a point on Earth to each country's nearest border, computed in the browser
// from the same topology file the map draws. Nothing about the user's position leaves the device.

type Point = [number, number] // [longitude, latitude]
type Ring = Point[]
export type Shapes = Map<string, Ring[][]> // country id -> polygons -> rings

// Polygon arcs are rings of arc indexes; MultiPolygon arcs are lists of those.
type Geometry = { id?: string | number; type: string; arcs: number[][] | number[][][] }
type Topology = {
  arcs: number[][][]
  transform: { scale: [number, number]; translate: [number, number] }
  objects: { countries: { geometries: Geometry[] } }
}

const EARTH_KM = 6371
const rad = Math.PI / 180

export function decodeShapes(topology: Topology): Shapes {
  const { scale, translate } = topology.transform
  const arcs: Point[][] = topology.arcs.map((arc) => {
    let x = 0
    let y = 0
    return arc.map(([dx, dy]) => {
      x += dx
      y += dy
      return [x * scale[0] + translate[0], y * scale[1] + translate[1]] as Point
    })
  })

  const ringFrom = (indexes: number[]): Ring => {
    const ring: Ring = []
    for (const index of indexes) {
      const arc = index >= 0 ? arcs[index] : arcs[~index].slice().reverse()
      ring.push(...(ring.length ? arc.slice(1) : arc))
    }
    return ring
  }

  const shapes: Shapes = new Map()
  for (const geometry of topology.objects.countries.geometries) {
    if (geometry.id === undefined) continue
    const polygons = geometry.type === 'Polygon' ? [geometry.arcs as number[][]] : (geometry.arcs as number[][][])
    shapes.set(String(geometry.id), polygons.map((polygon) => polygon.map(ringFrom)))
  }
  return shapes
}

let shapesPromise: Promise<Shapes> | null = null

export function loadShapes(): Promise<Shapes> {
  shapesPromise ??= fetch('/countries-110m.json')
    .then((response) => response.json() as Promise<Topology>)
    .then(decodeShapes)
    .catch((error) => {
      shapesPromise = null
      throw error
    })
  return shapesPromise
}

const wrapLon = (lon: number) => ((((lon + 180) % 360) + 360) % 360) - 180

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number) {
  const dLat = (lat2 - lat1) * rad
  const dLon = (lon2 - lon1) * rad
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLon / 2) ** 2
  return 2 * EARTH_KM * Math.asin(Math.min(1, Math.sqrt(h)))
}

function distanceToRing(lat: number, lon: number, ring: Ring): number {
  let best = Number.POSITIVE_INFINITY
  for (let i = 0; i < ring.length - 1; i++) {
    const [aLon, aLat] = ring[i]
    const [bLon, bLat] = ring[i + 1]
    // Work in a flat patch around the segment: longitudes relative to the point, scaled by latitude.
    const ax = wrapLon(aLon - lon)
    const bx = ax + wrapLon(bLon - aLon)
    const k = Math.cos(((aLat + bLat) / 2) * rad)
    const dx = (bx - ax) * k
    const dy = bLat - aLat
    const lengthSquared = dx * dx + dy * dy
    // Parameter of the closest point on the segment to the origin (the user), clamped to the segment.
    const t = lengthSquared === 0 ? 0 : Math.max(0, Math.min(1, -(ax * k * dx + (aLat - lat) * dy) / lengthSquared))
    const closestLat = aLat + t * (bLat - aLat)
    const closestLon = lon + ax + t * (bx - ax)
    best = Math.min(best, haversineKm(lat, lon, closestLat, closestLon))
  }
  return best
}

function insideRing(lat: number, lon: number, ring: Ring): boolean {
  let inside = false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    // Rings are cut at the antimeridian, so plain longitude/latitude ray casting is correct here.
    const xi = ring[i][0]
    const xj = ring[j][0]
    const yi = ring[i][1]
    const yj = ring[j][1]
    if (yi > lat !== yj > lat && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside
  }
  return inside
}

function insidePolygon(lat: number, lon: number, rings: Ring[]): boolean {
  return insideRing(lat, lon, rings[0]) && !rings.slice(1).some((hole) => insideRing(lat, lon, hole))
}

/** Straight-line km from a point to each country's nearest border (0 when the point is inside it). */
export function distancesFrom(lat: number, lon: number, shapes: Shapes): Map<string, number> {
  const result = new Map<string, number>()
  shapes.forEach((polygons, id) => {
    if (polygons.some((rings) => insidePolygon(lat, lon, rings))) {
      result.set(id, 0)
      return
    }
    let best = Number.POSITIVE_INFINITY
    for (const rings of polygons) best = Math.min(best, distanceToRing(lat, lon, rings[0]))
    result.set(id, best)
  })
  return result
}

export function countryAt(distances: Map<string, number>): string | null {
  for (const [id, km] of distances) if (km === 0) return id
  return null
}
