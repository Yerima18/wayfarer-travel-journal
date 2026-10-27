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
  /** Limits the choice to these countries. Defaults to every country on the map. */
  candidateIds?: string[]
  /** When set, the value is submitted with a form under this field name. */
  name?: string
  placeholder?: string
  /** Adds a first choice that clears the value, such as "No residence permit". */
  emptyLabel?: string
  /** Blocks form submission until a country is picked. */
  isRequired?: boolean
  ariaLabel?: string
}

type Choice = { id: string; label: string }

/** A country field you can type into instead of scrolling a long dropdown. */
export default function CountryPicker({ value, onChange, priorityIds = [], candidateIds, name, placeholder, emptyLabel, isRequired = false, ariaLabel }: CountryPickerProps) {
  const { locale, t } = useI18n()
  const [text, setText] = useState('')
  const [isEditing, setIsEditing] = useState(false)
  const [isOpen, setIsOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const listId = useId()

  const choices = useMemo<Choice[]>(() => {
    const allowed = candidateIds ? new Set(candidateIds) : undefined
    const toChoice = (id: string): Choice => ({ id, label: countryLabel(id, locale) })
    if (isEditing && text.trim()) {
      return searchCountries(text, locale, MAX_TYPED_RESULTS, allowed).map((result) => toChoice(result.countryId))
    }
    const priority = new Set(priorityIds)
    const all = sortedCountries(locale).map((country) => country.id).filter((id) => !allowed || allowed.has(id))
    const ordered = [...all.filter((id) => priority.has(id)), ...all.filter((id) => !priority.has(id))].map(toChoice)
    return emptyLabel ? [{ id: '', label: emptyLabel }, ...ordered] : ordered
  }, [isEditing, text, locale, priorityIds, candidateIds, emptyLabel])

  const shownText = isEditing ? text : value ? countryLabel(value, locale) : emptyLabel ?? ''
  const hasFlag = Boolean(value) && !isEditing

  useEffect(() => {
    inputRef.current?.setCustomValidity(isRequired && !value ? t('form.chooseCountry') : '')
  }, [isRequired, value, t])

  useEffect(() => {
    if (!isOpen) return
    listRef.current?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest' })
  }, [activeIndex, isOpen])

  function pick(countryId: string) {
    onChange(countryId)
    setIsEditing(false)
    setIsOpen(false)
  }

  function openList(input: HTMLInputElement) {
    setText('')
    setIsEditing(true)
    setIsOpen(true)
    setActiveIndex(0)
    input.select()
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
      if (choices.length === 0) return
      const step = event.key === 'ArrowDown' ? 1 : -1
      setActiveIndex((index) => (index + step + choices.length) % choices.length)
      return
    }
    if (event.key === 'Enter' && isOpen && choices.length > 0) {
      event.preventDefault()
      pick(choices[Math.min(activeIndex, choices.length - 1)].id)
    }
  }

  return (
    <div className="country-picker">
      {hasFlag && <Flag countryId={value} className="flag flag-small country-picker-flag" />}
      <input
        ref={inputRef}
        type="text"
        role="combobox"
        className={hasFlag ? 'country-picker-input country-picker-has-flag' : 'country-picker-input'}
        aria-expanded={isOpen}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-label={ariaLabel}
        autoComplete="off"
        placeholder={placeholder ?? t('form.chooseCountry')}
        value={shownText}
        onFocus={(event) => openList(event.currentTarget)}
        // A click on an already-focused field (after picking with Enter) must reopen the list.
        onClick={(event) => { if (!isOpen) openList(event.currentTarget) }}
        onBlur={stopEditing}
        onChange={(event) => { setText(event.target.value); setIsEditing(true); setIsOpen(true); setActiveIndex(0) }}
        onKeyDown={handleKey}
      />
      {name && <input type="hidden" name={name} value={value} />}
      {isOpen && (
        <div ref={listRef} className="search-results country-picker-list" id={listId} role="listbox" aria-label={ariaLabel ?? placeholder ?? t('form.country')}>
          {choices.length === 0 ? <p className="search-none">{t('search.none')}</p> : choices.map((choice, index) => (
            // mousedown keeps focus in the field; preventDefault on click stops an enclosing <label> from re-clicking the field.
            <button key={choice.id || 'none'} type="button" role="option" aria-selected={index === activeIndex} className={index === activeIndex ? 'search-option search-option-on' : 'search-option'} onMouseDown={(event) => event.preventDefault()} onMouseEnter={() => setActiveIndex(index)} onClick={(event) => { event.preventDefault(); pick(choice.id) }}>
              {choice.id && <Flag countryId={choice.id} className="flag flag-small" />}
              <span className="search-option-name">{choice.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
