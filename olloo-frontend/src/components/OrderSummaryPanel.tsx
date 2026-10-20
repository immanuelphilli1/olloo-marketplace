import { Link } from 'react-router-dom'
import InformationLineIcon from 'remixicon-react/InformationLineIcon'
import LockFillIcon from 'remixicon-react/LockFillIcon'
import ShieldCheckFillIcon from 'remixicon-react/ShieldCheckFillIcon'
import { mapCartSummaryToDisplay } from '../api/mappers'
import { cartOrderSummary, securePaymentsCopy, securePrivacyCopy } from '../data/cart'
import { useShop } from '../context/ShopContext'

type OrderSummaryPanelProps = {
  mode: 'cart' | 'checkout'
  onPrimaryAction: () => void
  /** Disables the button while checkout is handing off to the provider. */
  isBusy?: boolean
}

function SummaryRow({
  label,
  value,
  valueClassName = 'font-normal text-text-primary',
}: {
  label: string
  value: string
  valueClassName?: string
}) {
  return (
    <div className="flex items-center gap-2 text-sm leading-4.5 tracking-[-0.28px]">
      <span className="flex-1 font-medium text-text-primary">{label}</span>
      <span className={`flex-1 text-right ${valueClassName}`}>{value}</span>
    </div>
  )
}

export function OrderSummaryPanel({
  mode,
  onPrimaryAction,
  isBusy = false,
}: OrderSummaryPanelProps) {
  const { cartSummary } = useShop()
  const summary = cartSummary ? mapCartSummaryToDisplay(cartSummary) : cartOrderSummary
  const primaryLabel =
    mode === 'cart' ? 'Checkout' : isBusy ? 'Redirecting to payment…' : 'Submit Order'

  return (
    <aside className="w-full shrink-0 lg:w-90">
      <div className="overflow-hidden rounded-2xl border border-border-primary bg-bg-primary">
        <div className="border-b border-border-primary p-4">
          <h2 className="text-base font-medium leading-5 tracking-[-0.32px] text-text-primary">
            Order Summary
          </h2>
        </div>

        <div className="flex flex-col gap-4 border-b border-border-primary p-4">
          <SummaryRow label="Items Total:" value={summary.itemsTotal} />
          <SummaryRow
            label="Items discount:"
            value={summary.itemsDiscount}
            valueClassName="font-medium text-primary-orange"
          />
          {mode === 'checkout' ? (
            <SummaryRow
              label=""
              value={summary.subtotal}
              valueClassName="font-normal text-text-primary"
            />
          ) : null}
        </div>

        <div className="flex flex-col gap-4 border-b border-border-primary p-4">
          <SummaryRow label="Shipping:" value={summary.shipping} />
          {/* Tax only arrives once the destination country is known, so the row
              appears only when the API actually charged it. */}
          {summary.tax ? <SummaryRow label="Tax:" value={summary.tax} /> : null}
          <div className="flex items-center gap-2 text-base font-medium leading-5 tracking-[-0.32px] text-text-primary">
            <span className="flex-1">Total</span>
            <span className="flex-1 text-right">{summary.total}</span>
          </div>
          <p className="text-xs leading-4 tracking-[-0.24px] text-text-secondary">
            {mode === 'checkout' ? (
              <>
                By submitting your order, you agree to our{' '}
                <Link to="/terms-of-use" className="text-[#2b7fff] hover:underline">
                  Terms of Use
                </Link>{' '}
                and{' '}
                <Link to="/privacy-policy" className="text-[#2b7fff] hover:underline">
                  Privacy Policy
                </Link>
                .
              </>
            ) : (
              cartOrderSummary.paymentNote
            )}
          </p>
        </div>

        <div className="flex flex-col gap-4 p-4">
          <button
            type="button"
            onClick={onPrimaryAction}
            disabled={isBusy}
            className="btn-orange flex h-10 w-full cursor-pointer items-center justify-center rounded-full px-4 text-sm font-medium leading-4.5 tracking-[-0.28px] text-text-inverse disabled:cursor-not-allowed disabled:opacity-70"
          >
            {primaryLabel}
          </button>

          <div className="flex items-start gap-2">
            <InformationLineIcon className="size-6 shrink-0 text-text-secondary" aria-hidden />
            <p className="text-xs leading-4 tracking-[-0.24px] text-text-secondary">
              {cartOrderSummary.availabilityNote}
            </p>
          </div>
        </div>

        {mode === 'cart' ? (
          <div className="border-t border-border-primary p-4">
            <div className="flex items-start gap-1">
              <LockFillIcon className="size-5 shrink-0 text-primary-green" aria-hidden />
              <p className="text-sm font-medium leading-4.5 tracking-[-0.28px] text-text-primary">
                {cartOrderSummary.chargeNote}
              </p>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-4 border-t border-border-primary p-4">
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-1">
                <ShieldCheckFillIcon className="size-5 shrink-0 text-primary-green" aria-hidden />
                <p className="text-sm font-medium leading-4.5 tracking-[-0.28px] text-text-primary">
                  Secure payments
                </p>
              </div>
              <p className="text-xs leading-4 tracking-[-0.24px] text-text-secondary">
                {securePaymentsCopy}
              </p>
            </div>
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-1">
                <LockFillIcon className="size-5 shrink-0 text-primary-green" aria-hidden />
                <p className="text-sm font-medium leading-4.5 tracking-[-0.28px] text-text-primary">
                  Secure privacy
                </p>
              </div>
              <p className="text-xs leading-4 tracking-[-0.24px] text-text-secondary">
                {securePrivacyCopy}
              </p>
            </div>
          </div>
        )}
      </div>
    </aside>
  )
}
