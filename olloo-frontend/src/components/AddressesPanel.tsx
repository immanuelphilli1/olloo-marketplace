import { useEffect, useMemo, useState } from 'react'
import { accountApi } from '../api'
import { notifyPreferredCountryChanged } from '../api/preferredCountry'
import { ApiError } from '../api/client'
import { getApiAddressId, mapApiAddress, mapApiAddresses } from '../api/mappers'
import DeleteBin7LineIcon from 'remixicon-react/DeleteBin7LineIcon'
import EditBoxLineIcon from 'remixicon-react/EditBoxLineIcon'
import FileCopyLineIcon from 'remixicon-react/FileCopyLineIcon'
import LockFillIcon from 'remixicon-react/LockFillIcon'
import { AddAddressModal } from './AddAddressModal'
import { AccountEmptyState } from './AccountEmptyState'
import { ListingLoader } from './ListingLoader'
import {
  addressSafeguardNotice,
  addressToFormValues,
  emptyAddressForm,
  formValuesToAddress,
  formatAddressContact,
  getAddressesEmptyStateMessage,
  type AddressFormValues,
  type AddressRecord,
} from '../data/addresses'
import { clearResidenceAddressIntent, readResidenceAddressIntent } from '../api/residenceAddressIntent'

/**
 * Ensures exactly one address reads as default: the preferred one when given,
 * otherwise the first, otherwise the server's own flags are respected.
 */
function applyDefaultFlag(items: AddressRecord[], preferredDefaultId?: string): AddressRecord[] {
  if (items.length === 0) return items

  const hasPreferred =
    preferredDefaultId !== undefined && items.some((item) => item.id === preferredDefaultId)

  if (hasPreferred) {
    return items.map((item) => ({
      ...item,
      isDefault: item.id === preferredDefaultId,
    }))
  }

  if (items.some((item) => item.isDefault)) return items

  return items.map((item, index) => ({
    ...item,
    isDefault: index === 0,
  }))
}

/** Server errors carry the real reason; fall back to friendly copy. */
function getApiErrorMessage(error: unknown, fallback: string): string {
  return error instanceof ApiError && error.message ? error.message : fallback
}

function AddressDefaultToggle({
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
        {isDefault ? 'Default Address' : 'Set as default'}
      </span>
    </button>
  )
}

function AddressCard({
  address,
  onSetDefault,
  onDelete,
  onEdit,
  onDuplicate,
}: {
  address: AddressRecord
  onSetDefault: () => void
  onDelete: () => void
  onEdit: () => void
  onDuplicate: () => void
}) {
  return (
    <article className="flex flex-col overflow-hidden rounded-2xl border border-border-primary bg-bg-secondary">
      <div className="flex flex-col gap-2 p-4 text-sm leading-4.5 tracking-[-0.28px] text-text-primary">
        <p className="font-medium">{formatAddressContact(address)}</p>
        <div className="flex flex-col gap-2 font-normal">
          <p>{address.addressLine}</p>
          <p>{address.cityLine}</p>
        </div>
      </div>

      <div className="flex items-center gap-4 border-t border-border-secondary p-4">
        <div className="min-w-0 flex-1">
          <AddressDefaultToggle isDefault={address.isDefault} onSelect={onSetDefault} />
        </div>

        <div className="flex shrink-0 items-center gap-0 xl:gap-6">
          <button
            type="button"
            onClick={onDelete}
            aria-label="Delete address"
            className="cursor-pointer p-1"
          >
            <DeleteBin7LineIcon className="size-6 text-text-secondary" aria-hidden />
          </button>
          <span aria-hidden className="h-6 w-px bg-border-secondary" />
          <button
            type="button"
            onClick={onEdit}
            aria-label="Edit address"
            className="cursor-pointer p-1"
          >
            <EditBoxLineIcon className="size-6 text-text-secondary" aria-hidden />
          </button>
          <span aria-hidden className="h-6 w-px bg-border-secondary" />
          <button
            type="button"
            onClick={onDuplicate}
            aria-label="Duplicate address"
            className="cursor-pointer p-1"
          >
            <FileCopyLineIcon className="size-6 text-text-secondary" aria-hidden />
          </button>
        </div>
      </div>
    </article>
  )
}

type AddressesPanelProps = {
  /**
   * When true, the panel opens the default address's edit form as soon as the
   * list loads. Checkout's "Edit" link sets this so the user lands on the form
   * rather than having to find and open it.
   */
  startEditingDefault?: boolean
  /** Clears the `?edit=default` flag once the form is dismissed. */
  onDismissEditIntent?: () => void
  /** Opens add-address prefilled for country of residence (checkout mismatch). */
  startAddingResidenceAddress?: boolean
  onDismissResidenceAddIntent?: () => void
}

export function AddressesPanel({
  startEditingDefault = false,
  onDismissEditIntent,
  startAddingResidenceAddress = false,
  onDismissResidenceAddIntent,
}: AddressesPanelProps) {
  // Starts empty: the API is the only source of truth, so a new account sees the
  // empty state rather than sample addresses.
  const [addresses, setAddresses] = useState<AddressRecord[]>([])
  const [isSaving, setIsSaving] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const [modalMode, setModalMode] = useState<'add' | 'edit'>('add')
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingAddressId, setEditingAddressId] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function loadAddresses() {
      setIsLoading(true)
      try {
        const response = await accountApi.listAddresses()
        const items = mapApiAddresses(response)
        // Set unconditionally, including for an empty result, so an account with
        // no saved addresses is not masked by the removed seed rows.
        if (!cancelled) {
          setAddresses(items)
        }
      } catch {
        // Keep whatever is on screen; the banner below reports load failures.
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }

    void loadAddresses()

    return () => {
      cancelled = true
    }
  }, [])

  /**
   * Checkout's "Edit" link opens the default address's form on arrival. The
   * target is derived while the modal is closed rather than set from an effect,
   * which keeps this out of the render cascade; it resolves only once the list
   * has loaded so the id is the server's, not a seed row's.
   */
  const defaultAddressId = useMemo(
    () => addresses.find((address) => address.isDefault)?.id,
    [addresses],
  )

  const shouldAutoEditDefault =
    startEditingDefault && !isLoading && !isModalOpen && Boolean(defaultAddressId)

  const residenceCountryCode = readResidenceAddressIntent()
  const shouldAutoAddResidence =
    startAddingResidenceAddress &&
    !isLoading &&
    !isModalOpen &&
    !shouldAutoEditDefault &&
    Boolean(residenceCountryCode)

  const residenceAddInitialValues: AddressFormValues | undefined = residenceCountryCode
    ? { ...emptyAddressForm, country: residenceCountryCode, isDefault: true }
    : undefined

  const editingAddress = addresses.find(
    (address) =>
      address.id === editingAddressId ||
      (shouldAutoEditDefault && address.id === defaultAddressId),
  )

  const openAddModal = () => {
    setModalMode('add')
    setEditingAddressId(null)
    setIsModalOpen(true)
  }

  const openEditModal = (addressId: string) => {
    setModalMode('edit')
    setEditingAddressId(addressId)
    setIsModalOpen(true)
  }

  /** Dismissing also drops the `?edit=default` flag, so the form stays closed. */
  const closeModal = () => {
    clearResidenceAddressIntent()
    onDismissResidenceAddIntent?.()
    setIsModalOpen(false)
    setEditingAddressId(null)
    onDismissEditIntent?.()
  }

  /**
   * Flags one address as default locally. The server owns this flag, so a
   * successful call is the source of truth and a failure rolls the toggle back.
   */
  const setDefaultAddress = async (addressId: string) => {
    if (!addressId) return

    const previous = addresses
    setAddresses((current) =>
      current.map((address) => ({
        ...address,
        isDefault: address.id === addressId,
      })),
    )

    try {
      setIsSaving(true)
      const updated = await accountApi.setDefaultAddress(addressId)
      if (getApiAddressId(updated) !== '') {
        setAddresses((current) =>
          current.map((address) => ({
            ...address,
            isDefault: address.id === addressId,
          })),
        )
      }
      notifyPreferredCountryChanged()
    } catch {
      setAddresses(previous)
    } finally {
      setIsSaving(false)
    }
  }

  const deleteAddress = async (addressId: string) => {
    const previous = addresses

    setAddresses((current) => {
      const next = current.filter((address) => address.id !== addressId)
      if (next.length === 0) return next
      if (!next.some((address) => address.isDefault)) {
        next[0] = { ...next[0], isDefault: true }
      }
      return next
    })

    if (!addressId) return

    try {
      setIsSaving(true)
      await accountApi.deleteAddress(addressId)
    } catch {
      setAddresses(previous)
    } finally {
      setIsSaving(false)
    }
  }

  const duplicateAddress = async (addressId: string) => {
    if (!addressId) return

    try {
      setIsSaving(true)
      const created = await accountApi.duplicateAddress(addressId)
      const mapped = mapApiAddress(created)
      if (mapped.id !== '') {
        setAddresses((current) => [...current, { ...mapped, isDefault: false }])
      }
    } catch (error) {
      setErrorMessage(getApiErrorMessage(error, 'We could not duplicate this address.'))
    } finally {
      setIsSaving(false)
    }
  }

  const handleSubmit = async (values: AddressFormValues) => {
    setErrorMessage(null)
    setIsSaving(true)

    const payload = formValuesToAddress(values, '')

    try {
      if (modalMode === 'edit' && editingAddressId) {
        const response = await accountApi.updateAddress(editingAddressId, payload)
        const mapped = mapApiAddress(response)
        setAddresses((current) =>
          applyDefaultFlag(
            current.map((address) =>
              address.id === editingAddressId
                ? { ...address, ...mapped, id: address.id, cityLine: mapped.cityLine || address.cityLine }
                : address,
            ),
            values.isDefault ? editingAddressId : undefined,
          ),
        )

        if (values.isDefault) {
          await accountApi.setDefaultAddress(editingAddressId)
        }
        notifyPreferredCountryChanged()
        return
      }

      const response = await accountApi.createAddress(payload)
      const mapped = mapApiAddress(response)
      if (mapped.id !== '') {
        setAddresses((current) => applyDefaultFlag([...current, mapped], mapped.id))
      }
      notifyPreferredCountryChanged()
    } catch (error) {
      setErrorMessage(getApiErrorMessage(error, 'We could not save this address.'))
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <>
      {/* Keyed by target so switching between "add" and "edit" (or to a different
          address) mounts a fresh form seeded from the new initial values.
          `shouldAutoEditDefault` keeps the form up until the user dismisses it. */}
      <AddAddressModal
        key={`${editingAddressId ?? (shouldAutoEditDefault ? defaultAddressId : shouldAutoAddResidence ? 'residence' : 'new')}-${isModalOpen || shouldAutoEditDefault || shouldAutoAddResidence ? 'open' : 'closed'}`}
        isOpen={isModalOpen || shouldAutoEditDefault || shouldAutoAddResidence}
        mode={shouldAutoEditDefault && !editingAddressId ? 'edit' : modalMode}
        initialValues={
          editingAddress
            ? addressToFormValues(editingAddress)
            : shouldAutoAddResidence
              ? residenceAddInitialValues
              : undefined
        }
        onClose={closeModal}
        onSubmit={handleSubmit}
      />

      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex min-w-0 flex-1 flex-col gap-1 lg:gap-1">
            <div className="flex items-center gap-2 lg:flex-col lg:items-start lg:gap-1">
              <h2 className="min-w-0 flex-1 text-base font-medium leading-5 tracking-[-0.32px] text-text-primary lg:text-2xl lg:leading-8 lg:tracking-[-0.48px]">
                Addresses
              </h2>
              <div className="flex min-w-0 flex-1 items-center gap-1 lg:flex-none">
                <LockFillIcon className="size-6 shrink-0 text-primary-green" aria-hidden />
                <p className="truncate text-sm leading-4.5 tracking-[-0.28px] text-primary-green">
                  {addressSafeguardNotice}
                </p>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={openAddModal}
            disabled={isSaving}
            className="btn-orange flex w-full shrink-0 cursor-pointer items-center justify-center rounded-full px-6 py-4 text-base font-medium leading-5 tracking-[-0.32px] text-text-inverse disabled:cursor-not-allowed disabled:opacity-60 lg:w-auto"
          >
            Add new address
          </button>
        </div>

        {errorMessage ? (
          <p
            role="alert"
            className="rounded-xl bg-orange-light px-4 py-3 text-sm font-medium leading-4.5 tracking-[-0.28px] text-primary-orange"
          >
            {errorMessage}
          </p>
        ) : null}

        {isLoading ? (
          <ListingLoader label="Loading addresses" />
        ) : addresses.length === 0 ? (
          <AccountEmptyState message={getAddressesEmptyStateMessage()} />
        ) : (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {addresses.map((address) => (
              <AddressCard
                key={address.id}
                address={address}
                onSetDefault={() => void setDefaultAddress(address.id)}
                onDelete={() => void deleteAddress(address.id)}
                onEdit={() => openEditModal(address.id)}
                onDuplicate={() => void duplicateAddress(address.id)}
              />
            ))}
          </div>
        )}
      </div>
    </>
  )
}
