'use client'

import Avatar from '@/components/Avatar'
import Flag from '@/components/Flag'
import WorldMap from '@/components/WorldMap'
import { worldPercentOf } from '@/components/WorldProgress'
import { useI18n } from '@/lib/i18n'
import { cityLabel, countryLabel } from '@/lib/names'
import type { SharedProfile } from '@/lib/social'

type SharedProfileViewProps = {
  shared: SharedProfile
}

function groupCities(cities: NonNullable<SharedProfile['cities']>): Map<string, string[]> {
  const byCountry = new Map<string, string[]>()
  cities.forEach(({ countryId, city }) => byCountry.set(countryId, [...(byCountry.get(countryId) ?? []), city]))
  return byCountry
}

/** Someone's shared journal: their map, countries (and cities) and dream list, read-only. */
export default function SharedProfileView({ shared }: SharedProfileViewProps) {
  const { locale, t } = useI18n()
  const visited = new Set(shared.countries)
  const citiesByCountry = shared.cities ? groupCities(shared.cities) : null
  const percent = new Intl.NumberFormat(locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(worldPercentOf(shared.countries.length))
  const dreams = (shared.wishlist ?? []).filter((id) => !visited.has(id))

  function describe(countryId: string): string {
    if (visited.has(countryId)) return t('map.been')
    return dreams.includes(countryId) ? t('map.wish') : t('map.dreaming')
  }

  return (
    <div className="shared-profile">
      <header className="panel shared-head reveal">
        <Avatar profile={shared.profile} photoUrl={null} isLarge />
        <div className="shared-who">
          <h2>{shared.profile.name}</h2>
          <p>{`@${shared.handle}`}</p>
        </div>
        <div className="shared-stats">
          <strong>{t('count.countries', { n: shared.countries.length })}</strong>
          <span>{t('shared.world', { percent })}</span>
        </div>
      </header>

      <section className="panel map-panel reveal" aria-label={t('map.aria')}>
        <WorldMap visitedCountryIds={shared.countries} wishlistIds={dreams} describe={describe} />
      </section>

      <section className="panel shared-section reveal" aria-labelledby="shared-countries">
        <h3 id="shared-countries">{t('shared.countriesTitle')}</h3>
        {shared.countries.length === 0 ? (
          <p className="wishlist-empty">{t('shared.noCountries')}</p>
        ) : (
          <ul className="wishlist-list">
            {shared.countries.map((id) => (
              <li key={id} className="shared-country">
                <Flag countryId={id} className="flag flag-small" />
                <span className="wishlist-name">{countryLabel(id, locale)}</span>
                {citiesByCountry?.get(id) ? <small>{citiesByCountry.get(id)?.map((city) => cityLabel(city, locale)).join(', ')}</small> : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      {dreams.length > 0 && (
        <section className="panel shared-section reveal" aria-labelledby="shared-dreams">
          <h3 id="shared-dreams">{t('shared.wishTitle')}</h3>
          <ul className="wishlist-list">
            {dreams.map((id) => (
              <li key={id}>
                <Flag countryId={id} className="flag flag-small" />
                <span className="wishlist-name">{countryLabel(id, locale)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
