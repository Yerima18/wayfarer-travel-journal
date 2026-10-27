'use client'

import { KeyboardEvent, useEffect, useId, useMemo, useRef, useState } from 'react'
import Flag from '@/components/Flag'
import { useI18n } from '@/lib/i18n'
import { searchPlaces, type CityResult, type CountryResult } from '@/lib/search'

export type SearchPick = { countryId: string; city?: string }

type SearchBoxProps = {
  onPick: (pick: SearchPick) => void
}

type Option = CountryResult | CityResult

export default function SearchBox({ onPick }: SearchBoxProps) {
  const { locale, t } = useI18n()
  const [query, setQuery] = useState('')
  const [isOpen, setIsOpen] = useState(false)
  const [isExpanded, setIsExpanded] = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)
  const rootRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const listId = useId()

  const results = useMemo(() => searchPlaces(query, locale), [query, locale])
  const options: Option[] = [...results.countries, ...results.cities]
  const hasQuery = query.trim().length > 0
  const isListVisible = isOpen && hasQuery

  useEffect(() => {
    if (!isOpen) return
    const closeOnOutsideClick = (event: MouseEvent) => {
      if (rootRef.current?.contains(event.target as Node)) return
      setIsOpen(false)
      setIsExpanded(false)
    }
    document.addEventListener('mousedown', closeOnOutsideClick)
    return () => document.removeEventListener('mousedown', closeOnOutsideClick)
  }, [isOpen])

  function close() {
    setIsOpen(false)
    setIsExpanded(false)
    setQuery('')
  }

  function pick(option: Option) {
    onPick(option.kind === 'city' ? { countryId: option.countryId, city: option.city } : { countryId: option.countryId })
    close()
    inputRef.current?.blur()
  }

  function handleKey(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Escape') {
      close()
      return
    }
    if (options.length === 0) return
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setActiveIndex((index) => (index + 1) % options.length)
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      setActiveIndex((index) => (index - 1 + options.length) % options.length)
    } else if (event.key === 'Enter') {
      event.preventDefault()
      pick(options[Math.min(activeIndex, options.length - 1)])
    }
  }

  function expand() {
    setIsExpanded(true)
    setIsOpen(true)
    window.setTimeout(() => inputRef.current?.focus(), 0)
  }

  function renderOption(option: Option, index: number) {
    const id = `${listId}-${index}`
    return (
      <li key={option.kind === 'city' ? `${option.countryId}:${option.city}` : option.countryId} role="presentation">
        <button id={id} type="button" role="option" aria-selected={index === activeIndex} className={index === activeIndex ? 'search-option search-option-on' : 'search-option'} onMouseEnter={() => setActiveIndex(index)} onClick={() => pick(option)}>
          <Flag countryId={option.countryId} className="flag flag-small" />
          <span className="search-option-name">{option.label}</span>
          {option.kind === 'city' && <span className="search-option-sub">{option.countryLabel}</span>}
        </button>
      </li>
    )
  }

  return (
    <div ref={rootRef} className={isExpanded ? 'search search-expanded' : 'search'}>
      <button className="search-toggle" type="button" aria-label={t('search.open')} onClick={expand}>
        <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" width="19" height="19"><circle cx="11" cy="11" r="6.5" stroke="currentColor" strokeWidth="1.8" /><path d="m16 16 4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>
      </button>
      <div className="search-field">
        <svg aria-hidden="true" className="search-glyph" viewBox="0 0 24 24" fill="none" width="17" height="17"><circle cx="11" cy="11" r="6.5" stroke="currentColor" strokeWidth="1.8" /><path d="m16 16 4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>
        <input
          ref={inputRef}
          type="search"
          role="combobox"
          aria-expanded={isListVisible}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={isListVisible && options.length > 0 ? `${listId}-${Math.min(activeIndex, options.length - 1)}` : undefined}
          aria-label={t('search.aria')}
          placeholder={t('search.placeholder')}
          value={query}
          autoComplete="off"
          onFocus={() => setIsOpen(true)}
          onChange={(event) => { setQuery(event.target.value); setActiveIndex(0); setIsOpen(true) }}
          onKeyDown={handleKey}
        />
        <button className="search-close" type="button" aria-label={t('search.close')} onClick={close}>×</button>
      </div>
      {isListVisible && (
        <div className="search-results" id={listId} role="listbox" aria-label={t('search.aria')}>
          {options.length === 0 ? <p className="search-none">{t('search.none')}</p> : (
            <>
              {results.countries.length > 0 && <><div className="search-group">{t('search.countries')}</div><ul>{results.countries.map((option, index) => renderOption(option, index))}</ul></>}
              {results.cities.length > 0 && <><div className="search-group">{t('search.cities')}</div><ul>{results.cities.map((option, index) => renderOption(option, results.countries.length + index))}</ul></>}
            </>
          )}
        </div>
      )}
    </div>
  )
}
