import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react'
import { getHomePlacements, type HomeBannerPlacement } from '../api/services/catalog'

type HomePlacementsContextValue = {
  hero: HomeBannerPlacement[]
  promo: HomeBannerPlacement[]
  isLoading: boolean
}

const HomePlacementsContext = createContext<HomePlacementsContextValue | null>(null)

export function HomePlacementsProvider({ children }: { children: ReactNode }) {
  const [hero, setHero] = useState<HomeBannerPlacement[]>([])
  const [promo, setPromo] = useState<HomeBannerPlacement[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    async function load() {
      setIsLoading(true)
      try {
        const response = await getHomePlacements()
        if (cancelled) return

        const heroItems: HomeBannerPlacement[] = []
        const promoItems: HomeBannerPlacement[] = []
        for (const item of response.items ?? []) {
          if (item.position === 'hero') heroItems.push(item)
          else if (item.position === 'promo') promoItems.push(item)
        }
        setHero(heroItems)
        setPromo(promoItems)
      } catch {
        if (!cancelled) {
          setHero([])
          setPromo([])
        }
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }

    void load()

    return () => {
      cancelled = true
    }
  }, [])

  return (
    <HomePlacementsContext.Provider value={{ hero, promo, isLoading }}>
      {children}
    </HomePlacementsContext.Provider>
  )
}

export function useHomePlacements(): HomePlacementsContextValue {
  const value = useContext(HomePlacementsContext)
  if (!value) {
    return { hero: [], promo: [], isLoading: true }
  }
  return value
}
