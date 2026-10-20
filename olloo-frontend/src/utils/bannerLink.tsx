import { Link } from 'react-router-dom'
import type { ReactNode } from 'react'

function isStorefrontPath(linkUrl: string): boolean {
  return linkUrl.startsWith('/') && !linkUrl.startsWith('//')
}

export function BannerLink({
  linkUrl,
  children,
  className,
}: {
  linkUrl: string | null
  children: ReactNode
  className?: string
}) {
  if (!linkUrl) {
    return <>{children}</>
  }

  if (isStorefrontPath(linkUrl)) {
    return (
      <Link to={linkUrl} className={className}>
        {children}
      </Link>
    )
  }

  return (
    <a href={linkUrl} className={className}>
      {children}
    </a>
  )
}
