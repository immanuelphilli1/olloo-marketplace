import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Link, useLocation } from 'react-router-dom'
import ArrowLeftSLineIcon from 'remixicon-react/ArrowLeftSLineIcon'
import CheckLineIcon from 'remixicon-react/CheckLineIcon'
import CloseFillIcon from 'remixicon-react/CloseFillIcon'
import EyeLineIcon from 'remixicon-react/EyeLineIcon'
import EyeOffLineIcon from 'remixicon-react/EyeOffLineIcon'
import LockPasswordLineIcon from 'remixicon-react/LockPasswordLineIcon'
import GlobalLineIcon from 'remixicon-react/GlobalLineIcon'
import MailLineIcon from 'remixicon-react/MailLineIcon'
import SmartphoneLineIcon from 'remixicon-react/SmartphoneLineIcon'
import User6LineIcon from 'remixicon-react/User6LineIcon'
import { images } from '../assets/images'
import { accountApi, authApi, cartApi, localeApi, type LookupOption } from '../api'
import { preferredCountryPayloadForOption } from '../api/services/account'
import { notifyPreferredCountryChanged, writeStoredPreferredCountry } from '../api/preferredCountry'
import { clearOAuthState, saveOAuthReturnPath, saveOAuthState } from '../api/googleOAuth'
import { useAuth } from '../context/AuthContext'
import { useShop } from '../context/ShopContext'
import { forgotPasswordCopy, signInLegalCopy, type SignInStep } from '../data/auth'
import { getGoogleOAuthCallbackPath } from '../data/shopRoutes'
import { formatGhanaPhone, ghanaNationalDigits, GHANA_PHONE_HINT } from '../utils/ghanaPhone'
import { OllooMark } from './OllooLogo'

type SignInModalProps = {
  isOpen: boolean
  onClose: () => void
}

/**
 * How the shopper identifies themselves. Phone is the default for olloo; email
 * stays available for accounts created before phone sign-in (including staff
 * and Google accounts), which have no number on file.
 */
type SignInMethod = 'phone' | 'email'

/** Phone sign-ups default to Ghana as the country of residence. */
const DEFAULT_REGISTER_COUNTRY = 'GH'

const fieldShellClass =
  'flex h-14 w-full items-center overflow-hidden rounded-2xl border-2 border-border-secondary bg-bg-primary transition-colors focus-within:border-brand'
const fieldInputClass =
  'min-w-0 flex-1 bg-transparent px-3 text-base font-medium text-text-primary outline-none placeholder:font-normal placeholder:text-text-tertiary'

function IconInputField({
  id,
  icon: Icon,
  type = 'text',
  value,
  onChange,
  placeholder,
  autoComplete,
  rightSlot,
}: {
  id: string
  icon: typeof MailLineIcon
  type?: string
  value: string
  onChange: (value: string) => void
  placeholder: string
  autoComplete?: string
  rightSlot?: ReactNode
}) {
  return (
    <label htmlFor={id} className={fieldShellClass}>
      <Icon className="ml-4 size-5 shrink-0 text-text-tertiary" aria-hidden />
      <input
        id={id}
        type={type}
        value={value}
        placeholder={placeholder}
        autoComplete={autoComplete}
        aria-label={placeholder}
        onChange={(event) => onChange(event.target.value)}
        className={fieldInputClass}
      />
      {rightSlot ? <div className="mr-4 shrink-0">{rightSlot}</div> : null}
    </label>
  )
}

/** Ghana number entry: fixed `+233` prefix, national digits typed after it. */
function PhoneInputField({
  value,
  onChange,
  onSubmit,
}: {
  value: string
  onChange: (value: string) => void
  onSubmit: () => void
}) {
  return (
    <label htmlFor="sign-in-phone" className={fieldShellClass}>
      <span className="ml-3 flex h-9 shrink-0 items-center gap-1.5 rounded-xl bg-bg-secondary px-2.5 text-sm font-bold text-text-primary">
        <span aria-hidden className="text-base leading-none">
          🇬🇭
        </span>
        +233
      </span>
      <input
        id="sign-in-phone"
        type="tel"
        inputMode="tel"
        autoComplete="tel-national"
        value={value}
        maxLength={16}
        placeholder="24 123 4567"
        aria-label="Ghana mobile number"
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter') onSubmit()
        }}
        className={`${fieldInputClass} tracking-wide`}
      />
    </label>
  )
}

function PasswordField({
  value,
  onChange,
  placeholder,
  autoComplete,
  onSubmit,
}: {
  value: string
  onChange: (value: string) => void
  placeholder: string
  autoComplete: string
  onSubmit: () => void
}) {
  const [isVisible, setIsVisible] = useState(false)

  return (
    <label htmlFor="sign-in-password" className={fieldShellClass}>
      <LockPasswordLineIcon className="ml-4 size-5 shrink-0 text-text-tertiary" aria-hidden />
      <input
        id="sign-in-password"
        type={isVisible ? 'text' : 'password'}
        value={value}
        placeholder={placeholder}
        aria-label={placeholder}
        autoComplete={autoComplete}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter') onSubmit()
        }}
        className={fieldInputClass}
      />
      <button
        type="button"
        onClick={() => setIsVisible((current) => !current)}
        aria-label={isVisible ? 'Hide password' : 'Show password'}
        className="mr-4 shrink-0 cursor-pointer"
      >
        {isVisible ? (
          <EyeOffLineIcon className="size-5 text-text-tertiary" aria-hidden />
        ) : (
          <EyeLineIcon className="size-5 text-text-tertiary" aria-hidden />
        )}
      </button>
    </label>
  )
}

function LegalNotice({ onLinkClick }: { onLinkClick: () => void }) {
  return (
    <p className="text-center text-xs font-medium leading-relaxed text-text-tertiary">
      By continuing, you agree to our{' '}
      <Link to="/terms-of-use" onClick={onLinkClick} className="underline hover:text-text-primary">
        Terms of Use
      </Link>{' '}
      and{' '}
      <Link to="/privacy-policy" onClick={onLinkClick} className="underline hover:text-text-primary">
        Privacy Policy
      </Link>
      .
    </p>
  )
}

export function SignInModal({ isOpen, onClose }: SignInModalProps) {
  const { signIn, register } = useAuth()
  const { refreshCart, refreshWishlist } = useShop()
  const location = useLocation()
  const [step, setStep] = useState<SignInStep>('identify')
  const [method, setMethod] = useState<SignInMethod>('phone')
  const [phoneInput, setPhoneInput] = useState('')
  /** The number as the API normalised it (`+233...`), set once it is checked. */
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [registerCountry, setRegisterCountry] = useState(DEFAULT_REGISTER_COUNTRY)
  const [registerCountries, setRegisterCountries] = useState<LookupOption[]>([])
  const [isRegisterFlow, setIsRegisterFlow] = useState(false)
  /**
   * True when `check-email` reports an account that only has a Google login and
   * no password, so we must not show a password field for it.
   */
  const [isOAuthOnlyAccount, setIsOAuthOnlyAccount] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  /** Explains why the modal switched the shopper from email to phone. */
  const [infoMessage, setInfoMessage] = useState<string | null>(null)
  /**
   * The API's answer to a reset request. It is set only on success, and it is
   * deliberately non-committal about whether the address is registered.
   */
  const [resetConfirmation, setResetConfirmation] = useState<string | null>(null)

  useEffect(() => {
    if (!isOpen) return
    setStep('identify')
    setMethod('phone')
    setPhoneInput('')
    setPhone('')
    setEmail('')
    setPassword('')
    setFullName('')
    setRegisterCountry(DEFAULT_REGISTER_COUNTRY)
    setRegisterCountries([])
    setIsRegisterFlow(false)
    setIsOAuthOnlyAccount(false)
    setIsSubmitting(false)
    setErrorMessage(null)
    setInfoMessage(null)
    setResetConfirmation(null)
  }, [isOpen])

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

  const switchMethod = (next: SignInMethod) => {
    setMethod(next)
    setStep('identify')
    setErrorMessage(null)
    setInfoMessage(null)
    setIsOAuthOnlyAccount(false)
  }

  const handlePhoneContinue = async () => {
    // Checked locally first so a typo gets an instant answer; the API checks again.
    if (!ghanaNationalDigits(phoneInput)) {
      setErrorMessage(GHANA_PHONE_HINT)
      return
    }
    setIsSubmitting(true)
    setErrorMessage(null)
    setInfoMessage(null)
    try {
      const response = await authApi.checkPhone(phoneInput.trim())
      setPhone(response.phone)
      setIsRegisterFlow(response.nextStep === 'register')
      setPassword('')
      setStep('password')
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Unable to continue with this number.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleEmailContinue = async () => {
    if (!email.trim()) return
    setIsSubmitting(true)
    setErrorMessage(null)
    try {
      const response = await authApi.checkEmail(email.trim())
      if (response.nextStep === 'register') {
        // New accounts are created with a phone number, so an unknown email
        // sends the shopper to the phone step instead of a dead end.
        setMethod('phone')
        setInfoMessage(
          `No olloo account uses ${email.trim()} yet. Create one with your phone number. We'll keep this email for receipts.`,
        )
        return
      }
      setIsRegisterFlow(false)
      setIsOAuthOnlyAccount(response.nextStep === 'oauth')
      // Google-only accounts have no password, so sending them to the password
      // step would dead-end. Send them straight back to the provider buttons.
      if (response.nextStep === 'password') {
        setPassword('')
        setStep('password')
      }
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Unable to continue with email.')
    } finally {
      setIsSubmitting(false)
    }
  }

  useEffect(() => {
    if (!isOpen || !isRegisterFlow || step !== 'password') return

    let cancelled = false

    async function loadRegisterCountries() {
      try {
        const countries = await accountApi.getCountries()
        if (!cancelled) setRegisterCountries(countries)
      } catch {
        if (!cancelled) setRegisterCountries([])
      }
    }

    void loadRegisterCountries()

    return () => {
      cancelled = true
    }
  }, [isOpen, isRegisterFlow, step])

  const handlePasswordContinue = async () => {
    if (!password) {
      setErrorMessage(isRegisterFlow ? 'Create a password.' : 'Enter your password.')
      return
    }
    if (isRegisterFlow) {
      if (!fullName.trim()) {
        setErrorMessage('Enter your full name.')
        return
      }
      if (!email.trim()) {
        setErrorMessage('Enter your email address. We send receipts and password resets there.')
        return
      }
      if (password.length < 8) {
        setErrorMessage('Use at least 8 characters for your password.')
        return
      }
      if (!registerCountry.trim()) {
        setErrorMessage('Choose your country of residence.')
        return
      }
    }
    setIsSubmitting(true)
    setErrorMessage(null)
    try {
      if (isRegisterFlow) {
        await register({
          phone,
          email: email.trim(),
          password,
          fullName: fullName.trim().slice(0, 120),
          country: registerCountry.trim().toUpperCase(),
        })
        void localeApi.getLocale().catch(() => undefined)
        const selected = registerCountries.find(
          (row) => row.code?.toUpperCase() === registerCountry.trim().toUpperCase(),
        )
        if (selected) {
          writeStoredPreferredCountry(email.trim(), preferredCountryPayloadForOption(selected))
          notifyPreferredCountryChanged()
        }
      } else {
        await signIn(method === 'phone' ? { phone } : { email: email.trim() }, password)
      }
      try {
        await cartApi.mergeCart()
      } catch {
        // Guest cart merge is best-effort after sign-in.
      }
      await refreshCart()
      await refreshWishlist()
      handleClose()
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Unable to sign in.')
    } finally {
      setIsSubmitting(false)
    }
  }

  /**
   * Asks the API to email a password-reset link.
   *
   * The endpoint always succeeds, by design: the API answers identically whether
   * or not the address is registered, so a resolved request only means "we
   * handled it". The API's own wording is shown verbatim for that reason.
   * `checkEmail` is deliberately not consulted here: it would leak whether an
   * account exists before the reset mail is even requested.
   */
  const handleForgotPasswordSubmit = async () => {
    if (!email.trim()) {
      setErrorMessage('Enter your email address to reset your password.')
      return
    }

    setIsSubmitting(true)
    setErrorMessage(null)
    try {
      const confirmation = await authApi.forgotPassword(email.trim())
      setResetConfirmation(confirmation)
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Unable to send the reset link.')
    } finally {
      setIsSubmitting(false)
    }
  }

  /**
   * Starts the Google flow: ask the API for a fresh URL + CSRF `state`, stash
   * both, then hand the whole page over to Google. The callback page reads the
   * state back and completes the exchange.
   */
  const handleGoogleSignIn = useCallback(async () => {
    setIsSubmitting(true)
    setErrorMessage(null)
    try {
      // A fresh URL/state pair on every click: `state` is single-use and short-lived.
      const { url, state } = await authApi.getGoogleOAuthUrl()
      clearOAuthState()
      saveOAuthState(state)
      // Return the user to where they started (e.g. checkout) after sign-in. The
      // modal can be reopened on the callback page itself when a Google attempt
      // failed, and saving that would loop the user back here forever.
      if (location.pathname !== getGoogleOAuthCallbackPath()) {
        saveOAuthReturnPath(location.pathname + location.search)
      }
      window.location.assign(url)
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Unable to continue with Google.')
      setIsSubmitting(false)
    }
  }, [location.pathname, location.search])

  const handleBack = () => {
    setErrorMessage(null)
    setResetConfirmation(null)
    setStep(step === 'forgot' && method === 'phone' && phone ? 'password' : 'identify')
  }

  const handlePrimaryAction = () => {
    if (step === 'forgot') {
      void handleForgotPasswordSubmit()
      return
    }
    if (step === 'password') {
      void handlePasswordContinue()
      return
    }
    void (method === 'phone' ? handlePhoneContinue() : handleEmailContinue())
  }

  if (!isOpen) return null

  const heading =
    step === 'forgot'
      ? { title: forgotPasswordCopy.title, subtitle: forgotPasswordCopy.subtitle }
      : step === 'password' && isRegisterFlow
        ? {
            title: 'Create your olloo account',
            subtitle: 'Just a few details and you can start shopping.',
          }
        : step === 'password'
          ? { title: 'Welcome back', subtitle: 'Enter your password to sign in.' }
          : {
              title: 'Sign in or create an account',
              subtitle:
                method === 'phone'
                  ? 'Use your Ghana mobile number to continue.'
                  : 'Use the email on your existing olloo account.',
            }

  const primaryLabel =
    step === 'forgot'
      ? isSubmitting
        ? 'Sending…'
        : resetConfirmation
          ? forgotPasswordCopy.resendLabel
          : forgotPasswordCopy.submitLabel
      : isSubmitting
        ? 'Please wait…'
        : step === 'password'
          ? isRegisterFlow
            ? 'Create account'
            : 'Sign in'
          : 'Continue'

  return createPortal(
    <>
      <button
        type="button"
        aria-label="Close sign in modal"
        className="fixed inset-0 z-50 bg-ink/50 backdrop-blur-[2px]"
        onClick={handleClose}
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="sign-in-title"
        className="fixed left-1/2 top-1/2 z-50 flex max-h-[calc(100dvh-2rem)] w-[min(480px,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-3xl bg-bg-primary shadow-float"
      >
        <div className="flex shrink-0 items-center justify-between gap-2 px-5 pt-4">
          {step !== 'identify' ? (
            <button
              type="button"
              onClick={handleBack}
              className="flex cursor-pointer items-center rounded-full py-1 pr-2 text-sm font-semibold text-text-secondary hover:text-text-primary"
            >
              <ArrowLeftSLineIcon className="size-5" aria-hidden />
              Back
            </button>
          ) : (
            <span aria-hidden />
          )}
          <button
            type="button"
            onClick={handleClose}
            aria-label="Close"
            className="flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-full bg-bg-secondary text-text-secondary hover:text-text-primary"
          >
            <CloseFillIcon className="size-5" aria-hidden />
          </button>
        </div>

        <div className="overflow-y-auto px-6 pb-6 sm:px-8">
          <div className="flex flex-col items-center gap-3 pb-6 pt-1 text-center">
            <OllooMark className="size-12" />
            <div className="flex flex-col gap-1">
              <h2
                id="sign-in-title"
                className="font-display text-2xl font-bold tracking-[-0.02em] text-text-primary"
              >
                {heading.title}
              </h2>
              <p className="text-sm text-text-secondary">{heading.subtitle}</p>
            </div>
          </div>

          <form
            noValidate
            onSubmit={(event) => {
              event.preventDefault()
              handlePrimaryAction()
            }}
            className="flex flex-col gap-3"
          >
            {step === 'identify' && method === 'phone' ? (
              <PhoneInputField
                value={phoneInput}
                onChange={(value) => {
                  setPhoneInput(value)
                  setErrorMessage(null)
                }}
                onSubmit={handlePrimaryAction}
              />
            ) : null}

            {(step === 'identify' && method === 'email') || step === 'forgot' ? (
              <IconInputField
                id="sign-in-email"
                icon={MailLineIcon}
                type="email"
                autoComplete="email"
                value={email}
                onChange={setEmail}
                placeholder={step === 'forgot' ? forgotPasswordCopy.emailPlaceholder : 'Email address'}
              />
            ) : null}

            {step === 'password' ? (
              // The identifier being used, with a quick way to change it.
              <div className="flex items-center justify-between gap-3 rounded-2xl bg-bg-secondary px-4 py-3">
                <span className="flex min-w-0 items-center gap-2 text-sm font-semibold text-text-primary">
                  {method === 'phone' ? (
                    <SmartphoneLineIcon className="size-5 shrink-0 text-brand" aria-hidden />
                  ) : (
                    <MailLineIcon className="size-5 shrink-0 text-brand" aria-hidden />
                  )}
                  <span className="truncate">
                    {method === 'phone' ? formatGhanaPhone(phone) : email.trim()}
                  </span>
                </span>
                <button
                  type="button"
                  onClick={() => setStep('identify')}
                  className="shrink-0 cursor-pointer text-sm font-bold text-brand hover:text-brand-dark"
                >
                  Change
                </button>
              </div>
            ) : null}

            {step === 'password' && isRegisterFlow ? (
              <>
                <IconInputField
                  id="sign-in-full-name"
                  icon={User6LineIcon}
                  autoComplete="name"
                  value={fullName}
                  onChange={setFullName}
                  placeholder="Full name"
                />
                <IconInputField
                  id="sign-in-register-email"
                  icon={MailLineIcon}
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={setEmail}
                  placeholder="Email address (for receipts)"
                />
                <label htmlFor="sign-in-country" className={fieldShellClass}>
                  <GlobalLineIcon className="ml-4 size-5 shrink-0 text-text-tertiary" aria-hidden />
                  <select
                    id="sign-in-country"
                    value={registerCountry}
                    onChange={(event) => setRegisterCountry(event.target.value)}
                    aria-label="Country of residence"
                    className="min-w-0 flex-1 cursor-pointer bg-transparent px-3 text-base font-medium text-text-primary outline-none"
                  >
                    <option value="">Country of residence</option>
                    {/* Keeps Ghana selectable before the country list arrives. */}
                    {registerCountries.length === 0 ? <option value="GH">Ghana</option> : null}
                    {registerCountries.map((country) => (
                      <option key={country.rid} value={country.code?.toUpperCase() ?? country.rid}>
                        {country.label==='United States' ? 'Rest of the World' : country.label}
                      </option>
                    ))}
                  </select>
                </label>
              </>
            ) : null}

            {step === 'password' ? (
              <PasswordField
                value={password}
                onChange={setPassword}
                placeholder={isRegisterFlow ? 'Create a password' : 'Password'}
                autoComplete={isRegisterFlow ? 'new-password' : 'current-password'}
                onSubmit={handlePrimaryAction}
              />
            ) : null}

            {step === 'password' && isRegisterFlow ? (
              <p className="px-1 text-xs text-text-tertiary">Use at least 8 characters.</p>
            ) : null}

            {infoMessage ? (
              <p role="status" className="rounded-xl bg-brand-light px-4 py-3 text-sm font-medium text-brand-dark">
                {infoMessage}
              </p>
            ) : null}

            {errorMessage ? (
              <p role="alert" className="px-1 text-sm font-semibold text-primary-red">
                {errorMessage}
              </p>
            ) : null}

            {/* The request succeeded. `aria-live` announces it, and the wording is
                the API's own, which never confirms whether the address exists. */}
            {resetConfirmation ? (
              <p
                role="status"
                aria-live="polite"
                className="flex items-start gap-2 rounded-xl bg-green-light px-4 py-3 text-sm font-medium text-primary-green"
              >
                <CheckLineIcon className="mt-0.5 size-5 shrink-0" aria-hidden />
                <span>{resetConfirmation}</span>
              </p>
            ) : null}

            {step === 'forgot' && !resetConfirmation ? (
              <p className="px-1 text-sm text-text-secondary">{forgotPasswordCopy.privacyNote}</p>
            ) : null}

            {isOAuthOnlyAccount ? (
              <p className="px-1 text-sm text-text-secondary">
                This account uses Google to sign in and has no password yet. Continue with Google
                below, or use Forgot password to set one.
              </p>
            ) : null}

            {step === 'password' && !isRegisterFlow ? (
              <button
                type="button"
                onClick={() => {
                  setStep('forgot')
                  setErrorMessage(null)
                  setResetConfirmation(null)
                }}
                className="cursor-pointer self-end text-sm font-semibold text-brand hover:text-brand-dark"
              >
                Forgot password?
              </button>
            ) : null}

            <button
              type="submit"
              disabled={isSubmitting}
              className="btn-brand mt-1 flex h-13 w-full cursor-pointer items-center justify-center rounded-full px-6 text-base font-bold text-text-inverse transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {primaryLabel}
            </button>
          </form>

          {step === 'identify' ? (
            <div className="flex flex-col gap-3 pt-5">
              <div className="flex items-center gap-3 text-xs font-semibold text-text-tertiary">
                <span className="h-px flex-1 bg-border-primary" aria-hidden />
                or
                <span className="h-px flex-1 bg-border-primary" aria-hidden />
              </div>
              <button
                type="button"
                onClick={() => switchMethod(method === 'phone' ? 'email' : 'phone')}
                className="flex h-12 w-full cursor-pointer items-center justify-center gap-2 rounded-full border-2 border-border-secondary text-sm font-bold text-text-primary transition-colors hover:border-text-tertiary"
              >
                {method === 'phone' ? (
                  <>
                    <MailLineIcon className="size-5" aria-hidden />
                    Sign in with email instead
                  </>
                ) : (
                  <>
                    <SmartphoneLineIcon className="size-5" aria-hidden />
                    Use my phone number
                  </>
                )}
              </button>
              <button
                type="button"
                disabled={isSubmitting}
                onClick={() => void handleGoogleSignIn()}
                className="flex h-12 w-full cursor-pointer items-center justify-center gap-2 rounded-full border-2 border-border-secondary text-sm font-bold text-text-primary transition-colors hover:border-text-tertiary disabled:cursor-not-allowed disabled:opacity-70"
              >
                <img alt="" aria-hidden className="size-5 object-contain" src={images.auth.google} />
                Continue with Google
              </button>
            </div>
          ) : null}

          <div className="pt-5">
            <LegalNotice onLinkClick={handleClose} />
            <span className="sr-only">{signInLegalCopy}</span>
          </div>
        </div>
      </div>
    </>,
    document.body,
  )
}
