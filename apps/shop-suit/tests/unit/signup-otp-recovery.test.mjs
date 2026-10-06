import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import {
  classifyOtpFailure,
  createPendingOnboardingDraft,
  isExistingIdentityError,
  normalizeSignupEmail,
  signupNeedsRecovery,
  PENDING_ONBOARDING_MAX_AGE_MS,
  restorePendingOnboarding,
} from '../../app/utils/pendingOnboarding.ts'

const now = Date.UTC(2026, 8, 30, 10)
const safeForm = {
  displayName: 'Owner',
  email: 'owner@example.test',
  shopName: 'Recoverable shop',
  businessMode: 'mixed',
  mainLocationName: 'Downtown',
  mainLocationCode: 'DT',
  mainLocationAddress: '1 Main Street',
  mainLocationPhone: '+201000000000',
}

test('pending signup persists only resumable non-secret fields', () => {
  const draft = createPendingOnboardingDraft(
    { ...safeForm, password: 'must-not-persist', otp: '123456', accessToken: 'secret' },
    { expiresAt: now + 3_600_000, resendAt: now + 60_000 },
    now,
  )
  const serialized = JSON.stringify(draft)
  assert.deepEqual(draft.form, safeForm)
  assert.doesNotMatch(serialized, /must-not-persist|123456|accessToken|password|otp/i)
})

test('pending signup restores active and expired OTP states and rejects stale or malformed state', () => {
  const active = createPendingOnboardingDraft(safeForm, { expiresAt: now + 1_000, resendAt: now + 500 }, now)
  assert.equal(restorePendingOnboarding(JSON.stringify(active), now).status, 'active')
  assert.equal(restorePendingOnboarding(JSON.stringify(active), now + 2_000).status, 'expired')

  const staleSavedAt = now - PENDING_ONBOARDING_MAX_AGE_MS - 1
  const stale = { ...active, savedAt: staleSavedAt, expiresAt: staleSavedAt + 3_600_000, resendAt: staleSavedAt + 60_000 }
  assert.equal(restorePendingOnboarding(JSON.stringify(stale), now).status, 'stale')
  assert.equal(restorePendingOnboarding(JSON.stringify({ ...active, resendAt: now + 86_400_000 }), now).status, 'invalid')
  assert.equal(restorePendingOnboarding('{broken', now).status, 'invalid')
  assert.equal(restorePendingOnboarding(null, now).status, 'none')
})

test('existing identity and OTP errors select recoverable state transitions', () => {
  assert.equal(isExistingIdentityError({ code: 'user_already_exists' }), true)
  assert.equal(isExistingIdentityError(new Error('User already registered')), true)
  assert.equal(isExistingIdentityError(new Error('network unavailable')), false)
  assert.equal(classifyOtpFailure({ code: 'otp_expired', message: 'Token has expired' }, false), 'expired')
  assert.equal(classifyOtpFailure({ code: 'otp_expired', message: 'Token has expired or is invalid' }, false), 'invalid')
  assert.equal(classifyOtpFailure({ code: 'bad_code' }, false), 'invalid')
  assert.equal(classifyOtpFailure({ code: 'bad_code' }, true), 'expired')
})

test('OTP screen exposes recovery in English and Arabic and provisioning remains idempotent', async () => {
  const signup = await readFile(new URL('../../app/pages/auth/signup.vue', import.meta.url), 'utf8')
  for (const copy of [
    'Send another code', 'Change email', 'Start signup over', 'Sign in instead',
    'ابعت كود جديد', 'غيّر الإيميل', 'ابدأ التسجيل من جديد', 'سجّل دخول بدل كده',
  ]) assert.match(signup, new RegExp(copy))
  assert.match(signup, /if \(!currentId\.value\)/)
  assert.match(signup, /rpc\('create_owner_shop'/)
  assert.match(signup, /clearDraft\(\)/)
  assert.doesNotMatch(signup, /localStorage\.setItem|sessionStorage\.setItem\([^\n]*(password|otp|token)/i)
})

test('signup is plan-neutral, defaults to mixed operations, and explains later safe changes', async () => {
  const signup = await readFile(new URL('../../app/pages/auth/signup.vue', import.meta.url), 'utf8')
  assert.doesNotMatch(signup, /id="signup-plan"|p_plan_slug|form\.plan/)
  assert.match(signup, /businessMode: 'mixed'/)
  assert.match(signup, /p_main_location_name: form\.mainLocationName\.trim\(\)/)
  assert.match(signup, /main_location_name: form\.mainLocationName\.trim\(\)/)
  for (const copy of [
    'Full product access for 7 days',
    'no paid-plan choice',
    'change this later in Business settings without losing data',
    'تجربة كاملة 7 أيام',
    'من غير ما تختار خطة مدفوعة',
    'تقدر تغيّرها بعدين من إعدادات النشاط، وبياناتك هتفضل محفوظة',
  ]) assert.match(signup, new RegExp(copy))
})

test('signup distinguishes masked/explicit duplicates from unconfirmed signup without identity lookup', () => {
  assert.equal(signupNeedsRecovery({ identities: [] }, null), true)
  assert.equal(signupNeedsRecovery(null, { code: 'user_already_exists' }), true)
  assert.equal(signupNeedsRecovery({ identities: [{ id: 'real-identity' }] }, null), false)
  assert.equal(signupNeedsRecovery(null, { code: 'over_email_send_rate_limit' }), false)
})

test('normalization is stable across signup, storage and refresh; recovery state survives refresh', () => {
  assert.equal(normalizeSignupEmail('  OWNER@Example.test  '), safeForm.email)
  const draft = createPendingOnboardingDraft({ ...safeForm, email: '  OWNER@Example.test  ' }, { expiresAt: now + 1000, resendAt: now }, now)
  assert.equal(draft.form.email, safeForm.email)
  const restored = restorePendingOnboarding(JSON.stringify({ ...draft, recovery: true }), now)
  assert.equal(restored.status, 'active')
  assert.equal(restored.draft.recovery, true)
  assert.equal(restored.draft.form.email, safeForm.email)
})
