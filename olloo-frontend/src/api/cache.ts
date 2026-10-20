const CACHE_TTL_MS = 5 * 60 * 1000

type CacheEntry = {
  expiresAt: number
  value: unknown
}

const cache = new Map<string, CacheEntry>()
const inflight = new Map<string, Promise<unknown>>()

export function buildCacheKey(prefix: string, params?: Record<string, unknown>): string {
  if (!params) {
    return prefix
  }

  const entries = Object.entries(params).filter(
    ([, value]) => value !== undefined && value !== null && value !== '',
  )

  if (entries.length === 0) {
    return prefix
  }

  entries.sort(([left], [right]) => left.localeCompare(right))
  const query = entries.map(([key, value]) => `${key}=${String(value)}`).join('&')
  return `${prefix}?${query}`
}

export async function cachedGet<T>(key: string, fetcher: () => Promise<T>): Promise<T> {
  const now = Date.now()
  const cached = cache.get(key)

  if (cached && cached.expiresAt > now) {
    return cached.value as T
  }

  const pending = inflight.get(key)
  if (pending) {
    return pending as Promise<T>
  }

  const promise = fetcher()
    .then((value) => {
      cache.set(key, { expiresAt: now + CACHE_TTL_MS, value })
      inflight.delete(key)
      return value
    })
    .catch((error) => {
      inflight.delete(key)
      throw error
    })

  inflight.set(key, promise)
  return promise
}

export function invalidateCache(prefix?: string) {
  if (!prefix) {
    cache.clear()
    inflight.clear()
    return
  }

  for (const key of cache.keys()) {
    if (key.startsWith(prefix)) {
      cache.delete(key)
    }
  }
}
