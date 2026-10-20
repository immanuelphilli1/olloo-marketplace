import { useEffect, useState } from 'react'
import { accountApi } from '../api'
import { ApiError } from '../api/client'
import { mapApiPaymentMethods } from '../api/mappers'
import DeleteBin7LineIcon from 'remixicon-react/DeleteBin7LineIcon'
import LockFillIcon from 'remixicon-react/LockFillIcon'
import { images } from '../assets/images'
import { ListingLoader } from './ListingLoader'
import { AccountEmptyState } from './AccountEmptyState'
import {
  paymentSafeguardNotice,
  paymentTypeLabel,
  getPaymentMethodsEmptyStateMessage,
  type PaymentMethodRecord,
  type PaymentMethodType,
} from '../data/paymentMethods'
import { getPaymentNetworkLabel, type PaymentNetwork } from '../data/paymentNetworks'
import { usePaymentNetworks } from '../hooks/usePaymentNetworks'

/** Server errors carry the real reason; fall back to friendly copy. */
function getErrorMessage(error: unknown, fallback: string): string {
  return error instanceof ApiError && error.message ? error.message : fallback
}

function PaymentMethodIcon({ type }: { type: PaymentMethodType }) {
  if (type === 'paypal') {
    return (
      <img
        alt=""
        aria-hidden
        className="h-6 w-8 shrink-0 object-contain"
        src={images.footer.paypal}
      />
    )
  }

  if (type === 'visa') {
    return (
      <img
        alt=""
        aria-hidden
        className="h-6 w-8 shrink-0 object-contain"
        src={images.footer.visa}
      />
    )
  }

  return (
    <span
      aria-hidden
      className="flex h-6 w-8 shrink-0 items-center justify-center rounded bg-bg-primary text-[10px] font-semibold leading-none tracking-[-0.2px] text-primary-green"
    >
      MM
    </span>
  )
}

function PaymentDefaultToggle({
  isDefault,
  onSelect,
}: {
  isDefault: boolean
  onSelect: () => void
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className="flex min-w-0 cursor-pointer items-center gap-4"
      aria-pressed={isDefault}
    >
      <span
        className={`flex size-8 shrink-0 items-center justify-center rounded-full border-2 ${
          isDefault ? 'border-text-primary bg-text-primary' : 'border-border-secondary bg-bg-primary'
        }`}
        aria-hidden
      >
        {isDefault ? <span className="size-3 rounded-full bg-bg-primary" /> : null}
      </span>
      <span className="truncate text-base font-medium leading-5 tracking-[-0.32px] text-text-primary">
        {isDefault ? 'Default payment method' : 'Set as default'}
      </span>
    </button>
  )
}

function PaymentMethodCard({
  payment,
  onSetDefault,
  onDelete,
  isBusy,
  networks,
}: {
  payment: PaymentMethodRecord
  onSetDefault: () => void
  onDelete: () => void
  isBusy: boolean
  networks: PaymentNetwork[]
}) {
  return (
    <article className="flex flex-col overflow-hidden rounded-2xl border border-border-primary bg-bg-secondary">
      <div className="flex flex-col gap-4 p-4">
        <p className="text-sm font-medium leading-4.5 tracking-[-0.28px] text-text-primary">
          {payment.cardholderName}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm leading-4.5 tracking-[-0.28px] text-text-primary">
            {paymentTypeLabel(payment.type)}
          </span>
          <PaymentMethodIcon type={payment.type} />
          {payment.type === 'mobile_money' && payment.network ? (
            <span className="text-sm leading-4.5 tracking-[-0.28px] text-text-primary">
              {/* Stored as an enum key (`mtn`), so it is resolved to the API's
                  label before being shown. */}
              {getPaymentNetworkLabel(networks, payment.network)}
            </span>
          ) : null}
          <span className="text-sm leading-4.5 tracking-[-0.28px] text-text-primary">
            {payment.maskedDetail}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-4 border-t border-border-secondary p-4">
        <div className="min-w-0 flex-1">
          <PaymentDefaultToggle
            isDefault={payment.isDefault}
            onSelect={isBusy || payment.isDefault ? () => undefined : onSetDefault}
          />
        </div>

        {/* No edit affordance: the API no longer accepts client-supplied card
            data, so a saved token can only be set as default or removed. */}
        <button
          type="button"
          onClick={onDelete}
          disabled={isBusy}
          aria-label="Delete payment method"
          className="shrink-0 cursor-pointer p-1 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <DeleteBin7LineIcon className="size-6 text-text-secondary" aria-hidden />
        </button>
      </div>
    </article>
  )
}

export function PaymentMethodsPanel() {
  // Starts empty: the API is the only source of truth, so an account with no
  // saved methods shows the empty state rather than sample cards.
  const [payments, setPayments] = useState<PaymentMethodRecord[]>([])
  const [isSaving, setIsSaving] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  // Saved methods carry a network enum key, which needs the API's label to be
  // displayed, so the network list is read here too.
  const { networks } = usePaymentNetworks()

  useEffect(() => {
    let cancelled = false

    async function loadPayments() {
      setIsLoading(true)
      try {
        const response = await accountApi.listPaymentMethods()
        const items = mapApiPaymentMethods(response)
        // Set unconditionally, including for an empty result, so an account with
        // no saved methods is not masked by the removed seed rows.
        if (!cancelled) {
          setPayments(items)
        }
      } catch {
        // Keep whatever is on screen; the banner below reports load failures.
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }

    void loadPayments()

    return () => {
      cancelled = true
    }
  }, [])

  /** The server owns the default flag, so a failure rolls the toggle back. */
  const setDefaultPayment = async (paymentId: string) => {
    if (!paymentId) return

    setErrorMessage(null)

    const previous = payments
    setPayments((current) =>
      current.map((payment) => ({
        ...payment,
        isDefault: payment.id === paymentId,
      })),
    )

    try {
      setIsSaving(true)
      await accountApi.setDefaultPaymentMethod(paymentId)
    } catch (error) {
      setPayments(previous)
      setErrorMessage(getErrorMessage(error, 'We could not update your default payment method.'))
    } finally {
      setIsSaving(false)
    }
  }

  const deletePayment = async (paymentId: string) => {
    setErrorMessage(null)

    const previous = payments

    setPayments((current) => {
      const next = current.filter((payment) => payment.id !== paymentId)
      if (next.length === 0) return next
      if (!next.some((payment) => payment.isDefault)) {
        next[0] = { ...next[0], isDefault: true }
      }
      return next
    })

    if (!paymentId) return

    try {
      setIsSaving(true)
      await accountApi.deletePaymentMethod(paymentId)
    } catch (error) {
      setPayments(previous)
      setErrorMessage(getErrorMessage(error, 'We could not remove this payment method.'))
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <>
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex min-w-0 flex-1 flex-col gap-1 lg:gap-1">
            <div className="flex items-center gap-2 lg:flex-col lg:items-start lg:gap-1">
              <h2 className="min-w-0 flex-1 text-base font-medium leading-5 tracking-[-0.32px] text-text-primary lg:text-2xl lg:leading-8 lg:tracking-[-0.48px]">
                Payment methods
              </h2>
              <div className="flex min-w-0 flex-1 items-center gap-1 lg:flex-none">
                <LockFillIcon className="size-6 shrink-0 text-primary-green" aria-hidden />
                <p className="truncate text-sm leading-4.5 tracking-[-0.28px] text-primary-green">
                  {paymentSafeguardNotice}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Cards are created on the provider's side during checkout, so there is
            nothing to add here — only set-default and remove. */}
        {errorMessage ? (
          <p
            role="alert"
            className="rounded-xl bg-orange-light px-4 py-3 text-sm font-medium leading-4.5 tracking-[-0.28px] text-primary-orange"
          >
            {errorMessage}
          </p>
        ) : null}

        {isLoading ? (
          <ListingLoader label="Loading payment methods" />
        ) : payments.length === 0 ? (
          <AccountEmptyState message={getPaymentMethodsEmptyStateMessage()} />
        ) : (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {payments.map((payment) => (
              <PaymentMethodCard
                key={payment.id}
                payment={payment}
                onSetDefault={() => void setDefaultPayment(payment.id)}
                onDelete={() => void deletePayment(payment.id)}
                isBusy={isSaving}
                networks={networks}
              />
            ))}
          </div>
        )}
      </div>
    </>
  )
}
