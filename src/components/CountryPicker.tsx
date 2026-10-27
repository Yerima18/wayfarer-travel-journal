'use client'

import { KeyboardEvent, useEffect, useId, useMemo, useRef, useState } from 'react'
import Flag from '@/components/Flag'
import { useI18n } from '@/lib/i18n'
import { countryLabel, sortedCountries } from '@/lib/names'
import { searchCountries } from '@/lib/search'

const MAX_TYPED_RESULTS = 8

type CountryPickerProps = {
  /** Selected country id, or an empty string when nothing is chosen. */
  value: string
  onChange: (countryId: string) => void
  /** Countries to list first when the field is empty, e.g. the ones already in the journal. */
  priorityIds?: string[]
}

/** A country field you can type into instead of scrolling a long dropdown. Submits as `country`. */
export default function CountryPicker({ value, onChange, priorityIds = [] }: CountryPickerProps) {
  const { locale, t } = useI18n()
  const [text, setText] = useState('')
  const [isEditing, setIsEditing] = useState(false)
  const [isOpen, setIsOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const listId = useId()

  const options = useMemo(() => {
    if (isEditing && text.trim()) {
      return searchCountries(text, locale, MAX_TYPED_RESULTS).map((result) => result.countryId)
    }
    const priority = new Set(priorityIds)
    const all = sortedCountries(locale).map((country) => country.id)
    return [...all.filter((id) => priority.has(id)), ...all.filter((id) => !priority.has(id))]
  }, [isEditing, text, locale, priorityIds])

  const shownText = isEditing ? text : value ? countryLabel(value, locale) : ''

  // Blocks form submission until a country is picked from the list.
  useEffect(() => {
    inputRef.current?.setCustomValidity(value ? '' : t('form.chooseCountry'))
  }, [value, t])

  useEffect(() => {
    if (!isOpen) return
    listRef.current?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest' })
  }, [activeIndex, isOpen])

  function pick(countryId: string) {
    onChange(countryId)
    setIsEditing(false)
    setIsOpen(false)
  }

  function stopEditing() {
    setIsEditing(false)
    setIsOpen(false)
  }

  function handleKey(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Escape') {
      if (isOpen) event.stopPropagation()
      stopEditing()
      return
    }
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      if (!isOpen) {
        setIsOpen(true)
        return
      }
      const step = event.key === 'ArrowDown' ? 1 : -1
      setActiveIndex((index) => (index + step + options.length) % options.length)
      return
    }
    if (event.key === 'Enter' && isOpen && options.length > 0) {
      event.preventDefault()
      pick(options[Math.min(activeIndex, options.length - 1)])
    }
  }

  return (
    <div className="country-picker">
      {value && !isEditing && <Flag countryId={value} className="flag flag-small country-picker-flag" />}
      <input
        ref={inputRef}
        type="text"
        role="combobox"
        className={value && !isEditing ? 'country-picker-input country-picker-has-flag' : 'country-picker-input'}
        aria-expanded={isOpen}
        aria-controls={listId}
        aria-autocomplete="list"
        autoComplete="off"
        placeholder={t('form.chooseCountry')}
        value={shownText}
        onFocus={(event) => { setText(''); setIsEditing(true); setIsOpen(true); setActiveIndex(0); event.currentTarget.select() }}
        onBlur={stopEditing}
        onChange={(event) => { setText(event.target.value); setIsEditing(true); setIsOpen(true); setActiveIndex(0) }}
        onKeyDown={handleKey}
      />
      <input type="hidden" name="country" value={value} />
      {isOpen && (
        <div ref={listRef} className="search-results country-picker-list" id={listId} role="listbox" aria-label={t('form.country')}>
          {options.length === 0 ? <p className="search-none">{t('search.none')}</p> : options.map((id, index) => (
            // mousedown keeps focus in the field so the list is still there when the click lands.
            <button key={id} type="button" role="option" aria-selected={index === activeIndex} className={index === activeIndex ? 'search-option search-option-on' : 'search-option'} onMouseDown={(event) => event.preventDefault()} onMouseEnter={() => setActiveIndex(index)} onClick={() => pick(id)}>
              <Flag countryId={id} className="flag flag-small" />
              <span className="search-option-name">{countryLabel(id, locale)}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
