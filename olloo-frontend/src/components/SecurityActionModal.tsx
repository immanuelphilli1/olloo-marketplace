import { useCallback, useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import CloseFillIcon from 'remixicon-react/CloseFillIcon'
import LockFillIcon from 'remixicon-react/LockFillIcon'

/**
 * The four security actions, each in its own form.
 *
 * Grouped in one modal rather than four because they share the same shape — a
 * field or two, a confirm, an error line — and the panel rows are only a label
 * and a button each, so opening a small dialog keeps the page itself still.
 */
export type SecurityAction = 'email' | 'phone' | 'password' | 'twoFactor' | 'deleteAccount'

type SecurityActionModalProps = {
  action: SecurityAction
  isOpen: boolean
  /** Current phone, pre-filled for the edit case. Null when none is set. */
  currentPhone: string | null
  /** True when 2FA is on, so the dialog can offer turning it off. */
  isTwoFactorEnabled: boolean
  onClose: () => void
  /**
   * Performs the action. Receives the values collected by the form, and returns
   * the server's message on success or its error on failure, so the dialog stays
   * open on a rejection instead of closing over an error the shopper never saw.
   */
  onSubmit: (values: SecurityActionValues) => Promise<string | null>
}

export type SecurityActionValues = {
  email?: string
  phone?: string
  password?: string
  currentPassword?: string
  /** Shown once after 2FA is enabled, for the authenticator app. */
  otpauthUrl?: string
}

const actionCopy: Record<
  SecurityAction,
  { title: string; submitLabel: string; confirm: string }
> = {
  email: {
    title: 'Change email',
    submitLabel: 'Update email',
    confirm: 'We will send a confirmation to the new address.',
  },
  phone: {
    title: 'Add phone',
    submitLabel: 'Save phone',
    confirm: 'Used for delivery updates and sign-in.',
  },
  password: {
    title: 'Change password',
    submitLabel: 'Update password',
    confirm: 'Choose a password you do not use anywhere else.',
  },
  twoFactor: {
    title: 'Two-factor authentication',
    submitLabel: 'Turn on',
    confirm: 'Scan the code in your authenticator app after turning this on.',
  },
  deleteAccount: {
    title: 'Delete your account',
    submitLabel: 'Delete my account',
    confirm: 'This permanently removes your account and cannot be undone.',
  },
}

function Field({
  id,
  label,
  type = 'text',
  value,
  autoComplete,
  onChange,
}: {
  id: string
  label: string
  type?: string
  value: string
  autoComplete?: string
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
        type={type}
        value={value}
        autoComplete={autoComplete}
        onChange={(event) => onChange(event.target.value)}
        className="w-full bg-transparent text-base font-medium leading-5 tracking-[-0.32px] text-text-primary outline-none placeholder:text-transparent"
      />
    </label>
  )
}

export function SecurityActionModal({
  action,
  isOpen,
  currentPhone,
  isTwoFactorEnabled,
  onClose,
  onSubmit,
}: SecurityActionModalProps) {
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  // Not rendered when closed, so its state is discarded on close. Remounting on
  // each open is what clears the fields and any stale error, without resetting
  // state inside an effect (which cascades a render the project lints against).
  if (!isOpen) return null

  return (
    <SecurityActionDialog
      action={action}
      currentPhone={currentPhone}
      isTwoFactorEnabled={isTwoFactorEnabled}
      errorMessage={errorMessage}
      isSaving={isSaving}
      onErrorChange={setErrorMessage}
      onSavingChange={setIsSaving}
      onClose={onClose}
      onSubmit={onSubmit}
    />
  )
}

type SecurityActionDialogProps = Omit<SecurityActionModalProps, 'isOpen'> & {
  errorMessage: string | null
  isSaving: boolean
  onErrorChange: (message: string | null) => void
  onSavingChange: (isSaving: boolean) => void
}

function SecurityActionDialog({
  action,
  currentPhone,
  isTwoFactorEnabled,
  errorMessage,
  isSaving,
  onErrorChange,
  onSavingChange,
  onClose,
  onSubmit,
}: SecurityActionDialogProps) {
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState(currentPhone ?? '')
  const [password, setPassword] = useState('')
  const [currentPassword, setCurrentPassword] = useState('')

  const copy = actionCopy[action]
  // Turning 2FA *off* and deleting an account both require the current password,
  // so the dialog asks for it rather than letting either be a single tap.
  const isSensitiveConfirmation =
    action === 'twoFactor' ? isTwoFactorEnabled : action === 'deleteAccount'

  const handleClose = useCallback(() => {
    onClose()
  }, [onClose])

  useEffect(() => {
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !isSaving) handleClose()
    }
    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.body.style.overflow = previousOverflow
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [handleClose, isSaving])

  // Required input per action. Submitting short of it is refused here as well as
  // on the server, so the shopper is not made to wait for a round trip to be told
  // the field is empty.
  const isSubmittable = (() => {
    switch (action) {
      case 'email':
        return email.trim().length > 0 && password.length > 0
      case 'phone':
        return phone.trim().length > 0
      case 'password':
        return password.length > 0 && currentPassword.length > 0
      case 'twoFactor':
        return !isTwoFactorEnabled || currentPassword.length > 0
      case 'deleteAccount':
        return currentPassword.length > 0
      default: {
        const exhaustiveCheck: never = action
        return exhaustiveCheck
      }
    }
  })()

  const handleSubmit = async () => {
    if (!isSubmittable || isSaving) return

    onSavingChange(true)
    onErrorChange(null)

    const result = await onSubmit({
      email: email.trim(),
      phone: phone.trim(),
      password,
      currentPassword,
    })

    // `null` means success; a string is the error to show while the dialog stays
    // open so the shopper does not lose what they typed.
    if (result !== null) {
      onErrorChange(result)
      onSavingChange(false)
      return
    }

    onSavingChange(false)
    handleClose()
  }

  return createPortal(
    <>
      <button
        type="button"
        aria-label={`Close ${copy.title.toLowerCase()}`}
        className="fixed inset-0 z-50 bg-[rgba(0,6,7,0.3)]"
        onClick={isSaving ? undefined : handleClose}
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="security-action-title"
        className="fixed left-1/2 top-1/2 z-50 flex max-h-[calc(100dvh-2rem)] w-[min(362px,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-2xl bg-bg-primary"
      >
        <div className="flex shrink-0 items-center gap-2 border-b border-border-primary px-6 py-4">
          <h2
            id="security-action-title"
            className="min-w-0 flex-1 text-base font-semibold leading-5 tracking-[-0.32px] text-text-secondary"
          >
            {/* Turning 2FA off reads as its own action, so the title says which way
                the toggle currently points. */}
            {action === 'twoFactor' && isTwoFactorEnabled ? 'Turn off two-factor' : copy.title}
          </h2>
          <button
            type="button"
            onClick={handleClose}
            disabled={isSaving}
            aria-label="Close"
            className="flex size-6 shrink-0 cursor-pointer items-center justify-center disabled:opacity-50"
          >
            <CloseFillIcon className="size-6 text-text-secondary" aria-hidden />
          </button>
        </div>

        <div className="flex flex-col gap-4 overflow-y-auto p-4">
          {errorMessage ? (
            <p
              role="alert"
              className="rounded-xl bg-orange-light px-4 py-3 text-sm font-medium leading-4.5 tracking-[-0.28px] text-primary-orange"
            >
              {errorMessage}
            </p>
          ) : null}

          {action === 'email' ? (
            <>
              <Field
                id="security-email"
                label="New email"
                type="email"
                value={email}
                autoComplete="email"
                onChange={setEmail}
              />
              {/* Changing the email needs the password to prove the account is
                  really the shopper's, not just an open session. */}
              <Field
                id="security-email-password"
                label="Current password"
                type="password"
                value={password}
                autoComplete="current-password"
                onChange={setPassword}
              />
            </>
          ) : null}

          {action === 'phone' ? (
            <Field
              id="security-phone"
              label="Phone number"
              type="tel"
              value={phone}
              autoComplete="tel"
              onChange={setPhone}
            />
          ) : null}

          {action === 'password' ? (
            <>
              <Field
                id="security-current-password"
                label="Current password"
                type="password"
                value={currentPassword}
                autoComplete="current-password"
                onChange={setCurrentPassword}
              />
              <Field
                id="security-new-password"
                label="New password"
                type="password"
                value={password}
                autoComplete="new-password"
                onChange={setPassword}
              />
            </>
          ) : null}

          {action === 'twoFactor' && !isTwoFactorEnabled ? (
            <p className="text-sm leading-4.5 tracking-[-0.28px] text-text-secondary">
              When you turn this on, we will show a setup key to add to your authenticator
              app.
            </p>
          ) : null}

          {isSensitiveConfirmation ? (
            <Field
              id="security-confirm-password"
              label="Current password"
              type="password"
              value={currentPassword}
              autoComplete="current-password"
              onChange={setCurrentPassword}
            />
          ) : null}

          <div className="flex items-start gap-1">
            <LockFillIcon className="size-6 shrink-0 text-primary-green" aria-hidden />
            <p className="text-sm leading-4.5 tracking-[-0.28px] text-primary-green">{copy.confirm}</p>
          </div>

          <button
            type="button"
            onClick={() => void handleSubmit()}
            disabled={!isSubmittable || isSaving}
            className="btn-orange flex h-13 w-fit cursor-pointer items-center justify-center rounded-full px-6 text-base font-medium leading-5 tracking-[-0.32px] text-text-inverse disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSaving ? 'Saving…' : copy.submitLabel}
          </button>
        </div>
      </div>
    </>,
    document.body,
  )
}