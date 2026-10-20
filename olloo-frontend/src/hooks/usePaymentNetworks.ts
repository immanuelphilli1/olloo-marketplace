import { useEffect, useMemo, useState } from 'react'
import { accountApi } from '../api'
import type { PaymentNetwork } from '../data/paymentNetworks'

export type { PaymentNetwork }

/**
 * Networks to fall back on when the API list is unavailable.
 *
 * These are display names, not the API's `id` keys, so they are a last resort
 * for the label only. Anything the API does return takes precedence.
 */
const FALLBACK_NETWORKS: PaymentNetwork[] = [
  { id: 'mtn', label: 'MTN' },
  { id: 'vodafone', label: 'Vodafone Cash' },
  { id: 'airteltigo', label: 'AirtelTigo Money' },
]

type UsePaymentNetworksResult = {
  /** The networks to offer, as `{ id, label }` pairs. */
  networks: PaymentNetwork[]
  /** True while the first load is in flight. */
  isLoading: boolean
}

/**
 * The mobile-money networks the store supports.
 *
 * `GET /payment-methods/networks` is the source of truth: the list is fixed by
 * the backend, and an admin adding a network must not require a client change.
 * The endpoint is public and cheap, so it is read once per mount and shared by
 * every surface that offers a network choice.
 *
 * A failure is not fatal — the fallback list keeps the selector usable, since a
 * hardcoded list is what this replaced and blocking payment-method entry on a
 * network-list outage would be a regression.
 */
export function usePaymentNetworks(): UsePaymentNetworksResult {
  const [networks, setNetworks] = useState<PaymentNetwork[]>(FALLBACK_NETWORKS)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    async function loadNetworks() {
      try {
        const loaded = await accountApi.getPaymentNetworks()
        if (cancelled) return

        // Rows missing either field would render as a blank option, so they are
        // dropped. An empty list falls back rather than offering no choice.
        const usable = loaded.filter((network) => network.id && network.label)
        if (usable.length > 0) {
          setNetworks(usable)
        }
      } catch {
        // Keep the fallback list.
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }

    void loadNetworks()

    return () => {
      cancelled = true
    }
  }, [])

  // Memoized so a consumer putting `networks` in a dependency list is not
  // re-run by a new array literal on every render.
  return useMemo(() => ({ networks, isLoading }), [networks, isLoading])
}