import { useCallback, useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import CameraLineIcon from 'remixicon-react/CameraLineIcon'
import CloseFillIcon from 'remixicon-react/CloseFillIcon'
import LockFillIcon from 'remixicon-react/LockFillIcon'
import { getProfileInitials, privacyNotice } from '../data/profile'

type EditProfileModalProps = {
  isOpen: boolean
  fullName: string
  onClose: () => void
  onSubmit: (fullName: string) => void
}

function FloatingField({
  id,
  label,
  value,
  onChange,
}: {
  id: string
  label: string
  value: string
  onChange: (value: string) => void
}) {
  return (
    <label
      htmlFor={id}
      className="flex h-14 w-full flex-col justify-center overflow-hidden rounded-2xl border-[1.5px] border-border-primary px-4"
    >
      <span className="text-xs font-medium leading-4 tracking-[-0.24px] text-text-secondary">
        {label}
      </span>
      <input
        id={id}
        type="text"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full bg-transparent text-base font-medium leading-5 tracking-[-0.32px] text-text-primary outline-none placeholder:text-transparent"
      />
    </label>
  )
}

export function EditProfileModal({ isOpen, fullName, onClose, onSubmit }: EditProfileModalProps) {
  const [name, setName] = useState(fullName)

  useEffect(() => {
    if (!isOpen) return
    setName(fullName)
  }, [fullName, isOpen])

  const handleClose = useCallback(() => {
    onClose()
  }, [onClose])

  useEffect(() => {
    if (!isOpen) return

    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth

    document.body.style.overflow = 'hidden'
    document.body.style.paddingRight = `${scrollbarWidth}px`

    return () => {
      document.body.style.overflow = ''
      document.body.style.paddingRight = ''
    }
  }, [isOpen])

  useEffect(() => {
    if (!isOpen) return

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') handleClose()
    }

    document.addEventListener('keydown', handleKeyDown)

    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [handleClose, isOpen])

  const handleSubmit = () => {
    const trimmedName = name.trim()
    if (!trimmedName) return
    onSubmit(trimmedName)
    handleClose()
  }

  if (!isOpen) return null

  const initials = getProfileInitials(name || fullName)

  return createPortal(
    <>
      <button
        type="button"
        aria-label="Close edit profile modal"
        className="fixed inset-0 z-50 bg-[rgba(0,6,7,0.3)]"
        onClick={handleClose}
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="edit-profile-title"
        className="fixed left-1/2 top-1/2 z-50 flex max-h-[calc(100dvh-2rem)] w-[min(362px,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-2xl bg-bg-primary"
      >
        <div className="flex shrink-0 items-center gap-2 border-b border-border-primary px-6 py-4">
          <h2
            id="edit-profile-title"
            className="min-w-0 flex-1 text-base font-semibold leading-5 tracking-[-0.32px] text-text-secondary"
          >
            Edit profile
          </h2>
          <button
            type="button"
            onClick={handleClose}
            aria-label="Close"
            className="flex size-6 shrink-0 cursor-pointer items-center justify-center"
          >
            <CloseFillIcon className="size-6 text-text-secondary" aria-hidden />
          </button>
        </div>

        <div className="border-b border-border-primary p-4">
          <div className="relative inline-flex">
            <div className="flex size-18 items-center justify-center rounded-full bg-bg-secondary text-[32px] font-medium leading-10 tracking-[-0.64px] text-text-primary">
              {initials}
            </div>
            <div className="absolute bottom-0 right-0 flex size-7.5 items-center justify-center rounded-full border border-border-secondary bg-bg-primary p-1">
              <CameraLineIcon className="size-5 text-text-secondary" aria-hidden />
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-4 p-4">
          <FloatingField id="profile-full-name" label="Full name*" value={name} onChange={setName} />

          <div className="flex items-start gap-1">
            <LockFillIcon className="size-6 shrink-0 text-primary-green" aria-hidden />
            <p className="text-sm leading-4.5 tracking-[-0.28px] text-primary-green">{privacyNotice}</p>
          </div>

          <button
            type="button"
            onClick={handleSubmit}
            className="btn-orange flex h-13 w-fit cursor-pointer items-center justify-center rounded-full px-6 text-base font-medium leading-5 tracking-[-0.32px] text-text-inverse"
          >
            Update Profile
          </button>
        </div>
      </div>
    </>,
    document.body,
  )
}
