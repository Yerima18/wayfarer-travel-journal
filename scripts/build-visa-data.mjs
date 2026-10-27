// Builds public/visa/<passport>.json (one small file per passport) from the open
// passport-index-dataset matrix, plus src/lib/centroids.json for "closest first" sorting.
//
//   node scripts/build-visa-data.mjs path/to/passport-index-matrix-iso2.csv
//
// Source: https://github.com/ilyankou/passport-index-dataset (MIT). Re-run to refresh the data.
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'

const csvPath = process.argv[2]
if (!csvPath) throw new Error('Usage: node scripts/build-visa-data.mjs <passport-index-matrix-iso2.csv>')

const root = path.resolve(import.meta.dirname, '..')
const countriesSrc = fs.readFileSync(path.join(root, 'src/lib/countries.ts'), 'utf8')
const flagsSrc = fs.readFileSync(path.join(root, 'src/lib/flags.ts'), 'utf8')
const names = [...countriesSrc.matchAll(/id: "(\d+)", name: "([^"]*)"/g)].map((m) => ({ id: m[1], name: m[2] }))
const codeByName = Object.fromEntries([...flagsSrc.matchAll(/"([^"]+)": "([a-z]{2})"/g)].map((m) => [m[1], m[2].toUpperCase()]))
const ours = new Set(names.map((c) => codeByName[c.name]).filter(Boolean))

// Compact codes: f<days>|f = visa-free, o = on arrival, e = e-visa / ETA, v = visa required, n = no admission, s = own country.
function compact(value) {
  const v = value.trim().toLowerCase()
  if (v === '-1') return 's'
  if (/^\d+$/.test(v)) return `f${v}`
  if (v === 'visa free') return 'f'
  if (v === 'visa on arrival') return 'o'
  if (v === 'e-visa' || v === 'eta') return 'e'
  if (v === 'visa required') return 'v'
  if (v === 'no admission') return 'n'
  return null
}

const [header, ...rows] = fs.readFileSync(csvPath, 'utf8').trim().split(/\r?\n/).map((line) => line.split(','))
const destinations = header.slice(1)
const outDir = path.join(root, 'public/visa')
fs.mkdirSync(outDir, { recursive: true })
let written = 0
const passports = []
for (const row of rows) {
  const passport = row[0]
  if (!ours.has(passport)) continue
  const data = {}
  destinations.forEach((dest, i) => {
    if (!ours.has(dest)) return
    const code = compact(row[i + 1] ?? '')
    if (code) data[dest] = code
  })
  fs.writeFileSync(path.join(outDir, `${passport.toLowerCase()}.json`), JSON.stringify(data))
  passports.push(passport.toLowerCase())
  written++
}
fs.writeFileSync(path.join(root, 'src/lib/visaPassports.json'), JSON.stringify(passports.sort()))
fs.writeFileSync(path.join(outDir, 'meta.json'), JSON.stringify({
  source: 'passport-index-dataset',
  url: 'https://github.com/ilyankou/passport-index-dataset',
  dataAsOf: '2025-01',
}))
console.log(`wrote ${written} passport files; passports in our list without data:`, [...ours].filter((c) => !rows.some((r) => r[0] === c)))

// Country centres (lon/lat) from the same topology the map uses.
const require = createRequire(path.join(process.argv[3] ?? root, 'package.json'))
const { geoCentroid } = require('d3-geo')
const { feature } = require('topojson-client')
const topology = JSON.parse(fs.readFileSync(path.join(root, 'public/countries-110m.json'), 'utf8'))
const centroids = {}
for (const f of feature(topology, topology.objects.countries).features) {
  const [lon, lat] = geoCentroid(f)
  centroids[String(f.id)] = [Math.round(lon * 10) / 10, Math.round(lat * 10) / 10]
}
fs.writeFileSync(path.join(root, 'src/lib/centroids.json'), JSON.stringify(centroids))
console.log('centroids:', Object.keys(centroids).length)
