import { useEffect, useState } from 'react'
import { cmsApi } from '../api'
import type { CmsPageResponse } from '../api/types'
import type { PrivacyPolicyBlock } from '../data/privacyPolicy'

type CmsPageFallback = {
  title: string
  lastUpdated: string
  intro: readonly string[]
  blocks: readonly PrivacyPolicyBlock[]
}

export function useCmsPage(slug: string, fallback: CmsPageFallback) {
  const [page, setPage] = useState<CmsPageResponse | null>(null)

  useEffect(() => {
    let cancelled = false

    async function loadPage() {
      try {
        const response = await cmsApi.getPageContent(slug)
        if (!cancelled) setPage(response)
      } catch {
        if (!cancelled) setPage(null)
      }
    }

    void loadPage()

    return () => {
      cancelled = true
    }
  }, [slug])

  return {
    title: page?.title ?? fallback.title,
    lastUpdated: page?.lastUpdated ?? fallback.lastUpdated,
    intro: page?.intro ?? [...fallback.intro],
    blocks: page?.blocks ?? [...fallback.blocks],
  }
}
