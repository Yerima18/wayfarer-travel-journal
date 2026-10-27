import { citiesByCountryName } from './cities'
import { countries } from './countries'
import { countryLabel, cityLabel } from './names'
import type { Locale } from './messages'

export type CountryResult = { kind: 'country'; countryId: string; label: string; rank: number }
export type CityResult = { kind: 'city'; countryId: string; city: string; label: string; countryLabel: string; rank: number }
export type SearchResults = { countries: CountryResult[]; cities: CityResult[] }

const MAX_COUNTRIES = 5
const MAX_CITIES = 6

/** Lower-cases and strips accents so "zurich", "Zürich" and "ZURICH" all match. */
export function normalize(text: string): string {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()
}

// Words that start the name beat words that merely appear inside it.
function matchRank(haystacks: string[], query: string): number | null {
  let best: number | null = null
  for (const haystack of haystacks) {
    const index = haystack.indexOf(query)
    if (index === -1) continue
    const rank = index === 0 ? 0 : haystack.includes(` ${query}`) ? 1 : 2
    if (best === null || rank < best) best = rank
  }
  return best
}

function byRank<T extends { rank: number }>(items: T[]): T[] {
  return items.sort((a, b) => a.rank - b.rank)
}

function matchCountries(normalizedQuery: string, locale: Locale): CountryResult[] {
  return byRank(countries.flatMap((country) => {
    const rank = matchRank([normalize(country.name), normalize(countryLabel(country.id, 'en')), normalize(countryLabel(country.id, 'fr'))], normalizedQuery)
    return rank === null ? [] : [{ rank, kind: 'country' as const, countryId: country.id, label: countryLabel(country.id, locale) }]
  }))
}

/** Countries matching a typed name in either language, best matches first. */
export function searchCountries(rawQuery: string, locale: Locale, limit: number): CountryResult[] {
  const query = normalize(rawQuery)
  return query ? matchCountries(query, locale).slice(0, limit) : []
}

/** Finds countries and cities by name in either language. Cities come from the popular-places list. */
export function searchPlaces(rawQuery: string, locale: Locale): SearchResults {
  const query = normalize(rawQuery)
  if (!query) return { countries: [], cities: [] }

  const countryHits = matchCountries(query, locale)

  const cityHits = byRank(countries.flatMap((country) =>
    (citiesByCountryName[country.name] ?? []).flatMap((city) => {
      const rank = matchRank([normalize(city), normalize(cityLabel(city, 'fr'))], query)
      if (rank === null) return []
      return [{ rank, kind: 'city' as const, countryId: country.id, city, label: cityLabel(city, locale), countryLabel: countryLabel(country.id, locale) }]
    })))

  return {
    countries: countryHits.slice(0, MAX_COUNTRIES),
    cities: cityHits.slice(0, MAX_CITIES),
  }
}
