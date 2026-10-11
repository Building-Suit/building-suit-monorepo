import type { BusinessMode } from './businessMode.ts'
import { BUSINESS_MODES } from './businessMode.ts'

export const PENDING_ONBOARDING_STORAGE_KEY = 'shop-suit.pending-onboarding'
export const PENDING_ONBOARDING_MAX_AGE_MS = 24 * 60 * 60 * 1000

export interface PendingOnboardingForm {
  displayName: string
  email: string
  shopName: string
  businessMode: BusinessMode
  mainLocationName: string
  mainLocationCode: string
  mainLocationAddress: string
  mainLocationPhone: string
}

export interface PendingOnboardingDraft {
  version: 1
  savedAt: number
  expiresAt: number
  resendAt: number
  form: PendingOnboardingForm
  recovery?: boolean
}

export type PendingOnboardingRestore =
  | { status: 'none' | 'invalid' | 'stale' }
  | { status: 'active' | 'expired'; draft: PendingOnboardingDraft }

function isFiniteTimestamp(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
}

function readForm(value: unknown): PendingOnboardingForm | null {
  if (!value || typeof value !== 'object') return null
  const form = value as Record<string, unknown>
  if (!['displayName', 'email', 'shopName'].every(key => typeof form[key] === 'string')) return null
  if (!BUSINESS_MODES.includes(form.businessMode as BusinessMode)) return null
  return {
    displayName: String(form.displayName),
    email: normalizeSignupEmail(String(form.email)),
    shopName: String(form.shopName),
    businessMode: form.businessMode as BusinessMode,
    mainLocationName: typeof form.mainLocationName === 'string'
      ? form.mainLocationName
      : `${String(form.shopName).trim()} main location`,
    mainLocationCode: typeof form.mainLocationCode === 'string' ? form.mainLocationCode : '',
    mainLocationAddress: typeof form.mainLocationAddress === 'string' ? form.mainLocationAddress : '',
    mainLocationPhone: typeof form.mainLocationPhone === 'string' ? form.mainLocationPhone : '',
  }
}

/** Persist only the non-secret fields needed to resume email verification. */
export function createPendingOnboardingDraft(
  form: PendingOnboardingForm,
  timers: { expiresAt: number; resendAt: number },
  now = Date.now(),
): PendingOnboardingDraft {
  return {
    version: 1,
    savedAt: now,
    expiresAt: timers.expiresAt,
    resendAt: timers.resendAt,
    form: {
      displayName: form.displayName,
      email: normalizeSignupEmail(form.email),
      shopName: form.shopName,
      businessMode: form.businessMode,
      mainLocationName: form.mainLocationName,
      mainLocationCode: form.mainLocationCode,
      mainLocationAddress: form.mainLocationAddress,
      mainLocationPhone: form.mainLocationPhone,
    },
  }
}

export function restorePendingOnboarding(raw: string | null, now = Date.now()): PendingOnboardingRestore {
  if (!raw) return { status: 'none' }
  try {
    const value = JSON.parse(raw) as Record<string, unknown>
    const form = readForm(value.form)
    if (!form || !form.email.trim() || !isFiniteTimestamp(value.expiresAt) || !isFiniteTimestamp(value.resendAt)) return { status: 'invalid' }

    // Drafts written before version 1 did not include savedAt. Their configured
    // one-hour OTP expiry gives us a conservative creation time for migration.
    const savedAt = isFiniteTimestamp(value.savedAt) ? value.savedAt : value.expiresAt - 60 * 60 * 1000
    if (savedAt > now + 5 * 60 * 1000
      || value.expiresAt > savedAt + 2 * 60 * 60 * 1000
      || value.resendAt > savedAt + 5 * 60 * 1000) return { status: 'invalid' }
    if (now - savedAt > PENDING_ONBOARDING_MAX_AGE_MS) return { status: 'stale' }
    const draft: PendingOnboardingDraft = {
      version: 1,
      savedAt,
      expiresAt: value.expiresAt,
      resendAt: value.resendAt,
      form,
      recovery: value.recovery === true,
    }
    return { status: draft.expiresAt <= now ? 'expired' : 'active', draft }
  }
  catch {
    return { status: 'invalid' }
  }
}

export function isExistingIdentityError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false
  const value = error as { code?: unknown; message?: unknown }
  const code = typeof value.code === 'string' ? value.code.toLowerCase() : ''
  const message = typeof value.message === 'string' ? value.message.toLowerCase() : ''
  return ['email_exists', 'user_already_exists', 'user_already_registered'].includes(code)
    || message.includes('already registered')
    || message.includes('already exists')
}

export function classifyOtpFailure(error: unknown, locallyExpired: boolean): 'expired' | 'invalid' {
  if (locallyExpired) return 'expired'
  if (!error || typeof error !== 'object') return 'invalid'
  const value = error as { code?: unknown; message?: unknown }
  const code = typeof value.code === 'string' ? value.code.toLowerCase() : ''
  const message = typeof value.message === 'string' ? value.message.toLowerCase() : ''
  // GoTrue may describe a bad current code as "expired or invalid" under the
  // otp_expired code. The browser timer is the reliable distinction here.
  if ((code.includes('expired') || message.includes('expired')) && !message.includes('invalid')) return 'expired'
  return 'invalid'
}

/** One canonical address for Auth requests and refresh recovery. */
export function normalizeSignupEmail(email: string): string {
  return email.trim().toLowerCase()
}

/** GoTrue can conceal a confirmed duplicate behind an empty identity list. */
export function signupNeedsRecovery(user: { identities?: unknown } | null, error: unknown): boolean {
  return isExistingIdentityError(error)
    || (Array.isArray(user?.identities) && user.identities.length === 0)
}
