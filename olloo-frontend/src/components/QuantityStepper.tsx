import AddLineIcon from 'remixicon-react/AddLineIcon'
import SubtractLineIcon from 'remixicon-react/SubtractLineIcon'

type QuantityStepperProps = {
  quantity: number
  onDecrease: () => void
  onIncrease: () => void
  /**
   * Highest selectable quantity. Omitted when the product is not stock-tracked
   * (made to order), which never sells out.
   */
  max?: number
}

export function QuantityStepper({
  quantity,
  onDecrease,
  onIncrease,
  max,
}: QuantityStepperProps) {
  const isAtMax = max !== undefined && quantity >= max

  return (
    <div className="flex w-26.75 items-center">
      <button
        type="button"
        onClick={onDecrease}
        disabled={quantity <= 1}
        className="flex size-8 cursor-pointer items-center justify-center rounded-full border border-[#d1d3d3] disabled:cursor-not-allowed disabled:opacity-50"
        aria-label="Decrease quantity"
      >
        <SubtractLineIcon className="size-5 text-text-secondary" aria-hidden />
      </button>
      <span className="flex flex-1 items-center justify-center px-4 text-base font-medium leading-5 tracking-[-0.32px] text-text-primary">
        {quantity}
      </span>
      <button
        type="button"
        onClick={onIncrease}
        disabled={isAtMax}
        className="flex size-8 cursor-pointer items-center justify-center rounded-full border border-border-secondary disabled:cursor-not-allowed disabled:opacity-50"
        aria-label="Increase quantity"
      >
        <AddLineIcon className="size-5 text-text-secondary" aria-hidden />
      </button>
    </div>
  )
}
