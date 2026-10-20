type IconProps = {
  src: string
  alt?: string
  className?: string
}

export function Icon({ src, alt = '', className = 'size-6' }: IconProps) {
  return (
    <div className={`relative shrink-0 ${className}`}>
      <img alt={alt} className="absolute inset-0 block size-full max-w-none" src={src} />
    </div>
  )
}
