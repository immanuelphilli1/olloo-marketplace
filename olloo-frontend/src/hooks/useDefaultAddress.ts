import { useEffect, useState } from 'react'
import { accountApi } from '../api'
import { addressRecordToDefaultPreview, mapApiAddresses, mapApiDefaultAddress } from '../api/mappers'
import type { DefaultAddress } from '../data/profile'

type UseDefaultAddressResult = {
  /** The account's default address, or `null` when none is set. */
  address: DefaultAddress | null
  isLoading: boolean
}

/**
 * Resolves the account's default address from a single source so every surface
 * that shows it — Your Profile and Checkout — renders the same record.
 *
 * The Addresses list is the source of truth: the entry flagged `isDefault` is
 * the one the user marked. The profile payload embeds its own copy of the
 * default address, but that copy can drift from the list, so it is only used as
 * a fallback when the list carries no default flag at all. That fallback call is
 * made lazily, so the common case costs a single request.
 */
export function useDefaultAddress(): UseDefaultAddressResult {
  const [address, setAddress] = useState<DefaultAddress | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    async function loadDefaultAddress() {
      setIsLoading(true)
      try {
        const addresses = mapApiAddresses(await accountApi.listAddresses())
        if (cancelled) return

        const defaultRecord = addresses.find((item) => item.isDefault)
        if (defaultRecord) {
          setAddress(addressRecordToDefaultPreview(defaultRecord))
          return
        }

        // No entry is flagged default yet, so the profile's embedded copy is all
        // there is to show.
        const { defaultAddress } = await accountApi.getProfile()
        if (cancelled) return

        const fallback = defaultAddress ? mapApiDefaultAddress(defaultAddress) : null
        setAddress(fallback?.contactName || fallback?.line1 ? fallback : null)
      } catch {
        if (!cancelled) setAddress(null)
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }

    void loadDefaultAddress()

    return () => {
      cancelled = true
    }
  }, [])

  return { address, isLoading }
}