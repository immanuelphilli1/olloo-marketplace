import { images } from '../assets/images'

export function HomePageLogoLoader() {
  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-bg-primary"
      aria-busy="true"
      aria-label="Loading homepage"
    >
      <img
        src={images.nav.logo}
        alt=""
        aria-hidden
        className="h-8 w-auto hidden animate-logo-loading sm:h-9"
      />
    </div>
  )
}
