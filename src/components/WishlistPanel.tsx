'use client'

import CountryPicker from '@/components/CountryPicker'
import Flag from '@/components/Flag'
import { useI18n } from '@/lib/i18n'
import { countryLabel } from '@/lib/names'

type WishlistPanelProps = {
  wishlistIds: string[]
  /** Countries that can still be added (not visited, not already on the list). */
  candidateIds: string[]
  onAdd: (countryId: string) => void
  onRemove: (countryId: string) => void
  onVisited: (countryId: string) => void
}

/** The "places I want to visit" list, with a type-to-search field to add more. */
export default function WishlistPanel({ wishlistIds, candidateIds, onAdd, onRemove, onVisited }: WishlistPanelProps) {
  const { locale, t } = useI18n()

  return (
    <section className="panel wishlist-panel reveal" aria-labelledby="wishlist-heading">
      <div className="panel-heading">
        <div>
          <div className="panel-kicker">{t('wishlist.kicker')}</div>
          <h2 id="wishlist-heading">{t('wishlist.title')}</h2>
        </div>
        {wishlistIds.length > 0 ? <span className="recent-total">{String(wishlistIds.length).padStart(2, '0')}</span> : null}
      </div>
      <div className="wishlist-add">
        <CountryPicker value="" onChange={onAdd} candidateIds={candidateIds} placeholder={t('wishlist.add')} ariaLabel={t('wishlist.add')} />
      </div>
      {wishlistIds.length === 0 ? (
        <p className="wishlist-empty">{t('wishlist.empty')}</p>
      ) : (
        <ul className="wishlist-list">
          {wishlistIds.map((id) => {
            const name = countryLabel(id, locale)
            return (
              <li key={id}>
                <Flag countryId={id} className="flag flag-small" />
                <span className="wishlist-name">{name}</span>
                <button type="button" className="wishlist-went" onClick={() => onVisited(id)}>{t('wishlist.went')}</button>
                <button type="button" className="wishlist-remove" aria-label={t('wishlist.remove', { name })} onClick={() => onRemove(id)}>✕</button>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
