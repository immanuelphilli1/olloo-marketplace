import { useCallback, useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import ArrowDownSLineIcon from 'remixicon-react/ArrowDownSLineIcon'
import BankCardLineIcon from 'remixicon-react/BankCardLineIcon'
import CalendarEventLineIcon from 'remixicon-react/CalendarEventLineIcon'
import CheckLineIcon from 'remixicon-react/CheckLineIcon'
import CloseFillIcon from 'remixicon-react/CloseFillIcon'
import LockLineIcon from 'remixicon-react/LockLineIcon'
import ShieldCheckFillIcon from 'remixicon-react/ShieldCheckFillIcon'
import type { PaymentNetwork } from '../data/paymentNetworks'
import { usePaymentNetworks } from '../hooks/usePaymentNetworks'
import {
  countryOptionToType,
  emptyPaymentMethodForm,
  paymentCountryOptions,
  paymentSecurityBullets,
  paymentSecurityTitle,
  type PaymentCountryOption,
  type PaymentMethodFormValues,
} from '../data/paymentMethods'

type AddPaymentMethodModalProps = {
  isOpen: boolean
  mode: 'add' | 'edit'
  initialValues?: PaymentMethodFormValues
  onClose: () => void
  onSubmit: (values: PaymentMethodFormValues) => void
}

function FloatingField({
  id,
  label,
  value,
  onChange,
  placeholder,
  type = 'text',
}: {
  id: string
  label: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
  type?: string
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
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        className="w-full bg-transparent text-base font-medium leading-5 tracking-[-0.32px] text-text-primary outline-none placeholder:font-medium placeholder:text-text-secondary"
      />
    </label>
  )
}

function PaymentTypeSelect({
  value,
  onChange,
}: {
  value: PaymentCountryOption
  onChange: (value: PaymentCountryOption) => void
}) {
  return (
    <label
      htmlFor="payment-country-option"
      className="relative flex h-14 w-full flex-col justify-center overflow-hidden rounded-2xl border border-border-secondary px-4"
    >
      <span className="text-xs font-normal leading-4 tracking-[-0.24px] text-text-tertiary">
        Select your payment method
      </span>
      <select
        id="payment-country-option"
        value={value}
        onChange={(event) => onChange(event.target.value as PaymentCountryOption)}
        className="w-full appearance-none bg-transparent pr-8 text-base font-normal leading-5 tracking-[-0.32px] text-text-primary outline-none"
      >
        {paymentCountryOptions.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
      <ArrowDownSLineIcon
        className="pointer-events-none absolute right-4 top-1/2 size-6 -translate-y-1/2 text-text-secondary"
        aria-hidden
      />
    </label>
  )
}

function CardInputField({
  id,
  icon: Icon,
  value,
  onChange,
  placeholder,
  type = 'text',
}: {
  id: string
  icon: typeof BankCardLineIcon
  value: string
  onChange: (value: string) => void
  placeholder: string
  type?: string
}) {
  return (
    <label htmlFor={id} className="flex h-14 min-w-0 flex-1 items-center">
      <Icon className="ml-4 size-6 shrink-0 text-text-secondary" aria-hidden />
      <input
        id={id}
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        className="min-w-0 flex-1 bg-transparent px-4 text-base font-medium leading-5 tracking-[-0.32px] text-text-primary outline-none placeholder:font-medium placeholder:text-text-secondary"
      />
    </label>
  )
}

function NetworkSelect({
  value,
  onChange,
  networks,
  isLoading,
}: {
  value: string
  onChange: (value: string) => void
  networks: PaymentNetwork[]
  isLoading: boolean
}) {
  return (
    <label
      htmlFor="payment-network"
      className="relative flex h-14 w-full items-center overflow-hidden rounded-2xl border border-border-secondary px-4"
    >
      <select
        id="payment-network"
        value={value}
        disabled={isLoading}
        onChange={(event) => onChange(event.target.value)}
        className={`w-full appearance-none bg-transparent pr-8 text-base leading-5 tracking-[-0.32px] outline-none disabled:cursor-wait ${
          value ? 'font-medium text-text-primary' : 'font-normal text-text-tertiary'
        }`}
      >
        <option value="">{isLoading ? 'Loading networks…' : 'Network'}</option>
        {/* `id` is submitted and `label` shown, so the stored value is the API's
            network key rather than its display name. */}
        {networks.map((network) => (
          <option key={network.id} value={network.id}>
            {network.label}
          </option>
        ))}
      </select>
      <ArrowDownSLineIcon
        className="pointer-events-none absolute right-4 size-6 text-text-secondary"
        aria-hidden
      />
      <span className="sr-only">Network</span>
    </label>
  )
}

function SecurityFooter() {
  return (
    <div className="flex flex-col gap-4 border-t border-border-primary p-4 lg:p-6">
      <div className="flex items-center gap-1">
        <ShieldCheckFillIcon className="size-5 shrink-0 text-primary-green" aria-hidden />
        <p className="text-sm font-medium leading-4.5 tracking-[-0.28px] text-text-primary">
          {paymentSecurityTitle}
        </p>
      </div>
      <ul className="flex flex-col gap-2">
        {paymentSecurityBullets.map((bullet) => (
          <li key={bullet} className="flex items-start gap-2">
            <CheckLineIcon className="mt-0.5 size-4 shrink-0 text-primary-green" aria-hidden />
            <span className="text-xs leading-4 tracking-[-0.24px] text-text-secondary">{bullet}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

export function AddPaymentMethodModal({
  isOpen,
  mode,
  initialValues,
  onClose,
  onSubmit,
}: AddPaymentMethodModalProps) {
  const [form, setForm] = useState<PaymentMethodFormValues>(emptyPaymentMethodForm)
  // The network list is backend-owned, so it is fetched rather than hardcoded.
  const { networks, isLoading: isLoadingNetworks } = usePaymentNetworks()

  useEffect(() => {
    if (!isOpen) return
    setForm(initialValues ?? emptyPaymentMethodForm)
  }, [initialValues, isOpen])

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

  const updateField = <K extends keyof PaymentMethodFormValues>(
    key: K,
    value: PaymentMethodFormValues[K],
  ) => {
    setForm((current) => ({ ...current, [key]: value }))
  }

  const handleSubmit = () => {
    onSubmit(form)
    handleClose()
  }

  if (!isOpen) return null

  const paymentType = countryOptionToType(form.countryOption)
  const title = mode === 'edit' ? 'Edit Payment method' : 'Add Payment method'
  const submitLabel = mode === 'edit' ? 'Save payment method' : 'Add payment method'

  return createPortal(
    <>
      <button
        type="button"
        aria-label="Close add payment method modal"
        className="fixed inset-0 z-50 bg-[rgba(0,6,7,0.3)]"
        onClick={handleClose}
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-payment-method-title"
        className="fixed left-1/2 top-1/2 z-50 flex max-h-[calc(100dvh-2rem)] w-[min(680px,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-2xl bg-bg-primary"
      >
        <div className="flex shrink-0 items-center gap-2 border-b border-border-primary px-4 py-4 lg:px-6">
          <h2
            id="add-payment-method-title"
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
            <PaymentTypeSelect
              value={form.countryOption}
              onChange={(value) => updateField('countryOption', value)}
            />

            {paymentType === 'paypal' ? (
              <FloatingField
                id="payment-email"
                label="Email address"
                value={form.email}
                onChange={(value) => updateField('email', value)}
                placeholder="vikjunr@gmail.com"
                type="email"
              />
            ) : null}

            {paymentType === 'visa' ? (
              <div className="overflow-hidden rounded-2xl border border-border-primary">
                <CardInputField
                  id="payment-card-number"
                  icon={BankCardLineIcon}
                  value={form.cardNumber}
                  onChange={(value) => updateField('cardNumber', value)}
                  placeholder="0000 0000 0000 0000"
                />
                <div className="flex border-t border-border-primary">
                  <CardInputField
                    id="payment-expiry"
                    icon={CalendarEventLineIcon}
                    value={form.expiry}
                    onChange={(value) => updateField('expiry', value)}
                    placeholder="mm/yyyy"
                  />
                  <div className="w-px shrink-0 bg-border-primary" aria-hidden />
                  <CardInputField
                    id="payment-cvc"
                    icon={LockLineIcon}
                    value={form.cvc}
                    onChange={(value) => updateField('cvc', value)}
                    placeholder="CVC"
                    type="password"
                  />
                </div>
              </div>
            ) : null}

            {paymentType === 'mobile_money' ? (
              <div className="flex flex-col gap-4">
                <FloatingField
                  id="payment-mobile-number"
                  label="Mobile number"
                  value={form.mobileNumber}
                  onChange={(value) => updateField('mobileNumber', value)}
                  placeholder="054 271 7127"
                  type="tel"
                />
                <NetworkSelect
                  value={form.network}
                  onChange={(value) => updateField('network', value)}
                  networks={networks}
                  isLoading={isLoadingNetworks}
                />
              </div>
            ) : null}
          </div>

          <div className="px-4 py-2 lg:px-6 lg:py-2">
            <div className="flex flex-col-reverse gap-4 sm:flex-row">
              <button
                type="button"
                onClick={handleClose}
                className="flex h-13 flex-1 cursor-pointer items-center justify-center rounded-full bg-bg-secondary px-6 text-base font-medium leading-5 tracking-[-0.32px] text-text-primary"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSubmit}
                className="btn-orange flex h-13 flex-1 cursor-pointer items-center justify-center rounded-full px-6 text-base font-medium leading-5 tracking-[-0.32px] text-text-inverse"
              >
                {submitLabel}
              </button>
            </div>
          </div>

          <SecurityFooter />
        </div>
      </div>
    </>,
    document.body,
  )
}
