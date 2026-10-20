import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import ArrowDownSLineIcon from 'remixicon-react/ArrowDownSLineIcon'
import CloseFillIcon from 'remixicon-react/CloseFillIcon'
import LockFillIcon from 'remixicon-react/LockFillIcon'
import { accountApi } from '../api'
import type { LookupOption } from '../api'
import {
  addressCountries,
  addressRegions,
  emptyAddressForm,
  fallbackCountryCodes,
  type AddressFormValues,
} from '../data/addresses'
import { privacyNotice } from '../data/profile'

type AddAddressModalProps = {
  isOpen: boolean
  mode: 'add' | 'edit'
  initialValues?: AddressFormValues
  onClose: () => void
  onSubmit: (values: AddressFormValues) => void
}

/** Cap on address suggestions shown beneath a text input. */
const MAX_ADDRESS_SUGGESTIONS = 6

/** Lets a suggestion click land before the input's blur hides the list. */
const SUGGESTION_BLUR_MS = 120

function FloatingField({
  id,
  label,
  value,
  onChange,
  placeholder,
}: {
  id: string
  label: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
}) {
  return (
    <label
      htmlFor={id}
      className="flex h-14 w-full flex-col justify-center overflow-hidden rounded-2xl border-[1.5px] border-border-primary px-4"
    >
      <span className="text-xs font-medium leading-4 tracking-[-0.24px] text-text-secondary">
        {label}
      </span>
      <input
        id={id}
        type="text"
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        className="w-full bg-transparent text-base font-medium leading-5 tracking-[-0.32px] text-text-primary outline-none placeholder:text-text-tertiary"
      />
    </label>
  )
}

function SelectField({
  id,
  label,
  value,
  onChange,
  options,
  placeholder,
  isDisabled = false,
}: {
  id: string
  label: string
  value: string
  onChange: (value: string) => void
  options: string[]
  placeholder: string
  isDisabled?: boolean
}) {
  return (
    <label
      htmlFor={id}
      className="relative flex h-14 w-full items-center overflow-hidden rounded-2xl border border-border-secondary px-4"
    >
      <select
        id={id}
        value={value}
        disabled={isDisabled}
        onChange={(event) => onChange(event.target.value)}
        className={`w-full appearance-none bg-transparent pr-8 text-base leading-5 tracking-[-0.32px] outline-none disabled:cursor-not-allowed disabled:opacity-60 ${
          value ? 'font-medium text-text-primary' : 'font-normal text-text-tertiary'
        }`}
      >
        <option value="">{placeholder}</option>
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
      <ArrowDownSLineIcon
        className="pointer-events-none absolute right-4 size-6 text-text-secondary"
        aria-hidden
      />
      <span className="sr-only">{label}</span>
    </label>
  )
}

/**
 * A text input that also offers the lookup suggestions.
 *
 * Region and city are typed rather than chosen from a `<select>`: the lookup
 * endpoints only cover a few countries, so a closed list would leave users
 * unable to enter an address anywhere else. Suggestions still appear as they
 * type, and picking one is optional.
 */
function TextFieldWithSuggestions({
  id,
  label,
  value,
  onChange,
  suggestions,
  placeholder,
  isDisabled = false,
}: {
  id: string
  label: string
  value: string
  onChange: (value: string) => void
  suggestions: string[]
  placeholder?: string
  isDisabled?: boolean
}) {
  const [isFocused, setIsFocused] = useState(false)
  // Suggestions are scoped to what the user has typed so far.
  const matchingSuggestions = suggestions
    .filter((suggestion) => suggestion.toLowerCase().includes(value.trim().toLowerCase()))
    .slice(0, MAX_ADDRESS_SUGGESTIONS)

  const showSuggestions =
    !isDisabled && isFocused && value.trim().length > 0 && matchingSuggestions.length > 0

  return (
    <div className="relative flex w-full flex-col">
      <label
        htmlFor={id}
        className="flex h-14 w-full flex-col justify-center overflow-hidden rounded-2xl border-[1.5px] border-border-primary px-4"
      >
        <span className="text-xs font-medium leading-4 tracking-[-0.24px] text-text-secondary">
          {label}
        </span>
        <input
          id={id}
          type="text"
          value={value}
          disabled={isDisabled}
          placeholder={placeholder}
          autoComplete="off"
          onFocus={() => setIsFocused(true)}
          // Blurring is deferred so a click on a suggestion still registers.
          onBlur={() => window.setTimeout(() => setIsFocused(false), SUGGESTION_BLUR_MS)}
          onChange={(event) => onChange(event.target.value)}
          className="w-full bg-transparent text-base font-medium leading-5 tracking-[-0.32px] text-text-primary outline-none placeholder:text-text-tertiary disabled:cursor-not-allowed disabled:opacity-60"
        />
      </label>

      {showSuggestions ? (
        <ul className="absolute top-full z-10 mt-1 max-h-48 w-full overflow-y-auto rounded-xl border border-border-primary bg-bg-primary shadow-lg">
          {matchingSuggestions.map((suggestion) => (
            <li key={suggestion}>
              <button
                type="button"
                onMouseDown={(event) => {
                  // Prevents the input's blur from firing before the click lands.
                  event.preventDefault()
                  onChange(suggestion)
                  setIsFocused(false)
                }}
                className="w-full cursor-pointer px-4 py-2 text-left text-sm font-medium leading-4.5 tracking-[-0.28px] text-text-primary hover:bg-bg-secondary"
              >
                {suggestion}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}

function DefaultAddressToggle({
  selected,
  onToggle,
}: {
  selected: boolean
  onToggle: () => void
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="flex cursor-pointer items-center gap-4"
      aria-pressed={selected}
    >
      <span
        className={`flex size-8 shrink-0 items-center justify-center rounded-full border-2 ${
          selected ? 'border-text-primary bg-text-primary' : 'border-border-secondary bg-bg-primary'
        }`}
        aria-hidden
      >
        {selected ? <span className="size-3 rounded-full bg-bg-primary" /> : null}
      </span>
      <span className="text-base font-medium leading-5 tracking-[-0.32px] text-text-primary">
        Default Address
      </span>
    </button>
  )
}

export function AddAddressModal({
  isOpen,
  mode,
  initialValues,
  onClose,
  onSubmit,
}: AddAddressModalProps) {
  // The parent keys this component by the address being edited, so the form
  // initialises from `initialValues` in its first render instead of being reset
  // from an effect, which would paint one frame with the previous address.
  const [form, setForm] = useState<AddressFormValues>(initialValues ?? emptyAddressForm)

/**
 * Country and region options come from the public lookup endpoints, with the
 * local seed lists as the fallback so the form stays usable when a lookup
 * fails. Region stays a free-text field; its fetched options are only offered
 * as suggestions.
 */
  const [countries, setCountries] = useState<string[]>(addressCountries)
  const [countryCodes, setCountryCodes] = useState<string[]>(fallbackCountryCodes)
  /** Full country lookup rows, indexed to match `countries`. */
  const [countryMeta, setCountryMeta] = useState<LookupOption[]>([])
  /** Full region lookup rows, so a picked region can be sent as its rid. */
  const [regionMeta, setRegionMeta] = useState<LookupOption[]>([])
  const [regions, setRegions] = useState<string[]>(addressRegions)
  const [isLoadingRegions, setIsLoadingRegions] = useState(false)

  useEffect(() => {
    if (!isOpen) return

    let cancelled = false

    async function loadCountries() {
      try {
        const options = await accountApi.getCountries()
        if (cancelled || options.length === 0) return
        setCountries(options.map((option) => option.label))
        setCountryCodes(options.map((option) => option.rid))
        // Kept alongside the labels so the selected country's ISO code and
        // dialling prefix can be looked up when the choice changes.
        setCountryMeta(options)
      } catch {
        // Keep the local seed list.
      }
    }

    void loadCountries()

    return () => {
      cancelled = true
    }
  }, [isOpen])

  const countryPrefillKeyRef = useRef<string | null>(null)

  useEffect(() => {
    if (!isOpen) {
      countryPrefillKeyRef.current = null
      return
    }

    const countryCode = form.country.trim()
    if (!countryCode || countryMeta.length === 0) return
    if (countryPrefillKeyRef.current === countryCode) return

    const index = countryMeta.findIndex((option) => option.code === countryCode)
    if (index < 0) return

    const meta = countryMeta[index]
    const countryName = countries[index] ?? meta.label
    countryPrefillKeyRef.current = countryCode

    if (!form.phoneCountryCode && meta.phoneCode) {
      setForm((current) => ({
        ...current,
        phoneCountryCode: meta.phoneCode ?? current.phoneCountryCode,
      }))
    }

    const countryRid = countryCodes[index] ?? countryName
    let cancelled = false

    async function loadRegionsForPrefill() {
      setIsLoadingRegions(true)
      try {
        const options = await accountApi.getRegions(countryRid)
        if (cancelled) return
        if (options.length > 0) {
          setRegions(options.map((option) => option.label))
          setRegionMeta(options)
        } else {
          setRegions(addressRegions)
        }
      } catch {
        if (!cancelled) setRegions(addressRegions)
      } finally {
        if (!cancelled) setIsLoadingRegions(false)
      }
    }

    void loadRegionsForPrefill()

    return () => {
      cancelled = true
    }
  }, [countryCodes, countries, countryMeta, form.country, form.phoneCountryCode, isOpen])

/** Resolves a stored ISO country code to the name shown in the dropdown. */
  const getCountryLabel = (countryCode: string) => {
    if (!countryCode) return ''

    const index = countryMeta.findIndex((option) => option.code === countryCode)
    if (index >= 0) return countries[index]

    const fallbackIndex = fallbackCountryCodes.indexOf(countryCode)
    if (fallbackIndex >= 0) return countries[fallbackIndex] ?? countryCode

    // Legacy records may hold the country name instead of the code.
    return countries.includes(countryCode) ? countryCode : ''
  }

  /**
   * Regions depend on the selected country, and the endpoint is keyed by the
 * country's code rather than its name. Changing country also clears the
 * region, because the previous one is no longer valid.
 *
 * The address is stored with the ISO country **code**, not the name, so the
 * saved value is translated here and the dropdown keeps showing the name. The
 * country's dialling prefix is filled in alongside it, since the user would
 * otherwise have to look it up.
 */
  const handleCountryChange = async (countryName: string) => {
    const countryIndex = countries.indexOf(countryName)
    const meta = countryMeta[countryIndex]
    // The lookup row carries the authoritative ISO code; the seed list supplies
    // one when the lookup has not resolved.
    const countryCode = meta?.code ?? fallbackCountryCodes[countryIndex] ?? ''

    setForm((current) => ({
      ...current,
      country: countryCode,
      region: '',
      // The previous region's rid belongs to the previous country.
      regionId: undefined,
      // Only prefill the prefix while it is untouched, so editing an existing
      // address never discards a number the user already entered.
      phoneCountryCode: current.phoneCountryCode || (meta?.phoneCode ?? ''),
    }))

    if (!countryName) {
      setRegions(addressRegions)
      return
    }

    // The seed list has no codes, so fall back to the label if the id map is
    // empty; the lookup simply returns nothing in that case.
    const countryRid = countryCodes[countryIndex] ?? countryName

    setIsLoadingRegions(true)
    try {
      const options = await accountApi.getRegions(countryRid)
      if (options.length > 0) {
        setRegions(options.map((option) => option.label))
        // Kept so a region chosen from this list can be linked by rid, which
        // matches shipping rules more reliably than the typed name.
        setRegionMeta(options)
      } else {
        setRegions(addressRegions)
      }
    } catch {
      setRegions(addressRegions)
    } finally {
      setIsLoadingRegions(false)
    }
  }

  /** Resolves the lookup rid for a region name, if it came from a lookup list. */
  const getRegionId = (regionName: string) =>
    regionMeta.find((option) => option.label === regionName)?.rid

  /**
   * The city lookup is deliberately not used: with city and region both typed,
   * nothing is sent to the API, so a region the lookup does not know about still
   * accepts a city.
   */
  const handleRegionChange = (region: string) => {
    // A region picked from the lookup list also sends its rid, which lets the
    // backend match the shipping rule by identity rather than by name. A typed
    // region has no rid and is matched by name instead.
    setForm((current) => ({ ...current, region, regionId: getRegionId(region) }))
  }

  const handleClose = useCallback(() => {
    onClose()
  }, [onClose])

  useEffect(() => {
    if (!isOpen) return

    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth

    document.body.style.overflow = 'hidden'
    document.body.style.paddingRight = `${scrollbarWidth}px`

    return () => {
      document.body.style.overflow = ''
      document.body.style.paddingRight = ''
    }
  }, [isOpen])

  useEffect(() => {
    if (!isOpen) return

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') handleClose()
    }

    document.addEventListener('keydown', handleKeyDown)

    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [handleClose, isOpen])

  const updateField = <K extends keyof AddressFormValues>(key: K, value: AddressFormValues[K]) => {
    setForm((current) => ({ ...current, [key]: value }))
  }

  const handleSubmit = () => {
    onSubmit(form)
    handleClose()
  }

  if (!isOpen) return null

  const title = mode === 'edit' ? 'Edit Address' : 'Add Address'
  const submitLabel = mode === 'edit' ? 'Save Address' : 'Add Address'

  return createPortal(
    <>
      <button
        type="button"
        aria-label="Close add address modal"
        className="fixed inset-0 z-50 bg-[rgba(0,6,7,0.3)]"
        onClick={handleClose}
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-address-title"
        className="fixed left-1/2 top-1/2 z-50 flex max-h-[calc(100dvh-2rem)] w-[min(680px,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-2xl bg-bg-primary"
      >
        <div className="flex shrink-0 items-center gap-2 border-b border-border-primary px-6 py-4">
          <h2
            id="add-address-title"
            className="min-w-0 flex-1 text-base font-semibold leading-5 tracking-[-0.32px] text-text-secondary"
          >
            {title}
          </h2>
          <button
            type="button"
            onClick={handleClose}
            aria-label="Close"
            className="flex size-6 shrink-0 cursor-pointer items-center justify-center"
          >
            <CloseFillIcon className="size-6 text-text-secondary" aria-hidden />
          </button>
        </div>

        <div className="overflow-y-auto">
          <div className="flex flex-col gap-4 p-4 lg:p-6">
            <div className="flex items-start gap-1">
              <LockFillIcon className="size-6 shrink-0 text-primary-green" aria-hidden />
              <p className="text-sm leading-4.5 tracking-[-0.28px] text-primary-green">{privacyNotice}</p>
            </div>

            <SelectField
              id="address-country"
              label="Country"
              // The form stores the ISO code but the dropdown lists country
              // names, so the matching name is derived for display.
              value={getCountryLabel(form.country)}
              onChange={(value) => void handleCountryChange(value)}
              options={countries}
              placeholder="Select country"
            />

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FloatingField
                id="address-first-name"
                label="First name*"
                value={form.firstName}
                onChange={(value) => updateField('firstName', value)}
              />
              <FloatingField
                id="address-last-name"
                label="Last Name*"
                value={form.lastName}
                onChange={(value) => updateField('lastName', value)}
              />
            </div>

            <label
              htmlFor="address-phone-number"
              className="flex h-14 w-full flex-col justify-center overflow-hidden rounded-2xl border-[1.5px] border-border-primary px-4"
            >
              <span className="text-xs font-medium leading-4 tracking-[-0.24px] text-text-secondary">
                Phone number*
              </span>
              <div className="flex items-center gap-2">
                <span className="shrink-0 text-base font-medium leading-5 tracking-[-0.32px] text-text-primary">
                  {form.phoneCountryCode}
                </span>
                <span aria-hidden className="h-6 w-px bg-border-secondary" />
                <input
                  id="address-phone-number"
                  type="tel"
                  value={form.phoneNumber}
                  onChange={(event) => updateField('phoneNumber', event.target.value)}
                  className="min-w-0 flex-1 bg-transparent text-base font-medium leading-5 tracking-[-0.32px] text-text-primary outline-none"
                />
              </div>
            </label>

            <FloatingField
              id="address-line"
              label="Address*"
              value={form.addressLine}
              onChange={(value) => updateField('addressLine', value)}
              placeholder="Street, apartment/house/unit etc"
            />

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {/* City and region are free text: the lookup endpoints cover only a
                  handful of countries, so a dropdown would block every address
                  outside them. The region field still keeps its suggestions. */}
              <TextFieldWithSuggestions
                id="address-region-input"
                label="State/Province/Region*"
                value={form.region}
                onChange={handleRegionChange}
                suggestions={regions}
                placeholder={isLoadingRegions ? 'Loading regions…' : 'State/Province/Region*'}
                isDisabled={isLoadingRegions}
              />
              <FloatingField
                id="address-city"
                label="City*"
                value={form.city}
                onChange={(value) => updateField('city', value)}
                placeholder="City"
              />
            </div>

            <DefaultAddressToggle
              selected={form.isDefault}
              onToggle={() => updateField('isDefault', !form.isDefault)}
            />
          </div>

          <div className="flex flex-col gap-4 border-t border-border-primary p-4 lg:p-6">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <button
                type="button"
                onClick={handleClose}
                className="flex h-13 cursor-pointer items-center justify-center rounded-full bg-bg-secondary px-6 text-base font-medium leading-5 tracking-[-0.32px] text-text-primary"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSubmit}
                className="btn-orange flex h-13 cursor-pointer items-center justify-center rounded-full px-6 text-base font-medium leading-5 tracking-[-0.32px] text-text-inverse"
              >
                {submitLabel}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>,
    document.body,
  )
}
