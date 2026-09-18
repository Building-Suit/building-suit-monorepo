<script setup lang="ts">
import type { Database } from '~~/types/database.types'

definePageMeta({ layout: false })

const supabase = useSupabaseClient<Database>()
const { t } = useI18n()
const { restore } = useTheme()
const describeError = useErrorMessage()
const { currentId, loadOrganizations } = useTenant()

useHead({ title: () => `${t('onboarding.title')} · ${t('app.name')}` })

const { step, advance, back } = useSignupWizard(2)
const pending = ref(false)
const errorMessage = ref('')
const awaitingOtp = ref(false)
const otp = ref('')
const { expiresAt: otpExpiresAt, resendAt: resendAvailableAt, expiresIn: otpExpiresIn, resendIn, start: startVerification, format: formatCountdown } = useVerificationTimer()
const hydrated = ref(false)
const consentAccepted = ref(false)
const provisionedOrganizationId = ref<string | null>(null)
const existingAccountOnboarding = ref(false)
const ONBOARDING_STORAGE_KEY = 'ledger-suit.pending-onboarding'
type BusinessType = Database['public']['Enums']['organization_business_type']
const form = reactive({
  fullName: '', phone: '', jobTitle: '', email: '', password: '',
  organizationName: '', legalName: '', businessType: 'limited_liability' as BusinessType,
  countryCode: 'EG', timezone: 'Africa/Cairo', currency: 'EGP',
  fiscalYearStartMonth: 1, taxIdentifier: '',
})

const countries = [
  { code: 'EG', timezone: 'Africa/Cairo', currency: 'EGP' },
  { code: 'SA', timezone: 'Asia/Riyadh', currency: 'SAR' },
  { code: 'AE', timezone: 'Asia/Dubai', currency: 'AED' },
  { code: 'GB', timezone: 'Europe/London', currency: 'GBP' },
  { code: 'US', timezone: 'America/New_York', currency: 'USD' },
]
const supportedCurrencies = ['EGP', 'SAR', 'AED', 'USD', 'GBP', 'EUR'] as const
const businessTypes: BusinessType[] = ['sole_proprietorship', 'partnership', 'limited_liability', 'corporation', 'nonprofit', 'other']
const otpExpired = computed(() => awaitingOtp.value && otpExpiresIn.value === 0)

const submitButtonText = computed(() => {
  if (pending.value) {
    if (step.value === 1) return t('onboarding.checkingAvailability')
    return step.value === 2 ? t('onboarding.creating') : t('onboarding.checkingAvailability')
  }
  return step.value === 1 ? t('common.continue') : t('onboarding.startFreeTrial')
})

function hasPersonalDetails() {
  return Boolean(form.fullName.trim() && form.phone.trim() && form.jobTitle.trim() && form.email.trim())
}

function hasBusinessDetails() {
  return Boolean(form.organizationName.trim() && form.legalName.trim())
}

function restoreFromUserMetadata(authenticatedUser: { email?: string; user_metadata?: Record<string, unknown> }) {
  const metadata = authenticatedUser.user_metadata ?? {}
  const onboarding = metadata.pending_onboarding
  const pendingOnboarding = onboarding && typeof onboarding === 'object'
    ? onboarding as Record<string, unknown>
    : {}

  form.email = authenticatedUser.email?.trim().toLowerCase() ?? form.email
  if (typeof metadata.full_name === 'string') form.fullName = metadata.full_name
  if (typeof metadata.phone === 'string') form.phone = metadata.phone
  if (typeof metadata.job_title === 'string') form.jobTitle = metadata.job_title
  if (typeof pendingOnboarding.organization_name === 'string') form.organizationName = pendingOnboarding.organization_name
  if (typeof pendingOnboarding.legal_name === 'string') form.legalName = pendingOnboarding.legal_name
  if (businessTypes.includes(pendingOnboarding.business_type as BusinessType)) form.businessType = pendingOnboarding.business_type as BusinessType
  if (countries.some(country => country.code === pendingOnboarding.country_code)) form.countryCode = String(pendingOnboarding.country_code)
  if (typeof pendingOnboarding.timezone === 'string') form.timezone = pendingOnboarding.timezone
  if (typeof pendingOnboarding.base_currency === 'string') {
    const currency = pendingOnboarding.base_currency.trim().toUpperCase()
    if (supportedCurrencies.includes(currency as typeof supportedCurrencies[number])) form.currency = currency
  }
  if (Number.isInteger(pendingOnboarding.fiscal_year_start_month) && Number(pendingOnboarding.fiscal_year_start_month) >= 1 && Number(pendingOnboarding.fiscal_year_start_month) <= 12) {
    form.fiscalYearStartMonth = Number(pendingOnboarding.fiscal_year_start_month)
  }
  if (typeof pendingOnboarding.tax_identifier === 'string') form.taxIdentifier = pendingOnboarding.tax_identifier
}


function savePendingOnboarding() {
  if (!import.meta.client) return
  const { password: _password, ...safeForm } = form
  sessionStorage.setItem(ONBOARDING_STORAGE_KEY, JSON.stringify({
    form: safeForm,
    otpExpiresAt: otpExpiresAt.value,
    resendAvailableAt: resendAvailableAt.value,
    provisionedOrganizationId: provisionedOrganizationId.value,
  }))
}

function clearPendingOnboarding() {
  if (import.meta.client) sessionStorage.removeItem(ONBOARDING_STORAGE_KEY)
}

function showOtpVerification() {

  awaitingOtp.value = true
  otp.value = ''
  startVerification()
  savePendingOnboarding()
}

watch(() => form.countryCode, (code) => {
  const country = countries.find(item => item.code === code)
  if (country) { form.timezone = country.timezone; form.currency = country.currency }
})

async function next() {
  errorMessage.value = ''
  if (step.value === 1 && (!hasPersonalDetails() || (!existingAccountOnboarding.value && form.password.length < 8))) {
    errorMessage.value = t('onboarding.completeRequired')
    return
  }
  pending.value = true
  try {
    if (step.value === 1 && !existingAccountOnboarding.value) {
      const { data, error } = await supabase.rpc('check_owner_availability', {
        p_email: form.email.trim(),
        p_phone: form.phone.trim()
      })
      if (error) throw error
      if (data) {
        const { email_taken, phone_taken } = data as { email_taken: boolean, phone_taken: boolean }
        if (email_taken && phone_taken) {
          errorMessage.value = t('onboarding.bothTaken')
          return
        }
        if (email_taken) {
          errorMessage.value = t('onboarding.emailTaken')
          return
        }
        if (phone_taken) {
          errorMessage.value = t('onboarding.phoneTaken')
          return
        }
      }
    }

    await advance()
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : t('errors.generic')
  } finally {
    pending.value = false
  }
}

async function provisionAndStartTrial(authenticatedUserId?: string) {
  if (provisionedOrganizationId.value) {
    clearPendingOnboarding()
    await navigateTo('/dashboard')
    return
  }

  // An older deployment may already have provisioned the workspace. Reload
  // first so both fresh and resumed verification tabs reach the same trial.
  await loadOrganizations(authenticatedUserId, { force: true })
  if (currentId.value) {
    provisionedOrganizationId.value = currentId.value
    clearPendingOnboarding()
    await navigateTo('/dashboard')
    return
  }

  // Accounts created just before the durable trigger was deployed can still
  // rebuild from the same server-side metadata that survived the closed tab.
  const { data: resumedOrganizationId, error: resumeError } = await supabase.rpc('resume_saved_signup')
  if (resumeError) throw new Error(describeError(resumeError))
  if (resumedOrganizationId) {
    provisionedOrganizationId.value = resumedOrganizationId
    await loadOrganizations(authenticatedUserId, { force: true })
    clearPendingOnboarding()
    await navigateTo('/dashboard')
    return
  }

  // Compatibility for older incomplete accounts that have no saved metadata.
  const { data: organizationId, error: onboardingError } = await supabase.rpc('complete_account_onboarding', {
    p_full_name: form.fullName.trim(),
    p_phone: form.phone.trim(),
    p_job_title: form.jobTitle.trim(),
    p_organization_name: form.organizationName.trim(),
    p_legal_name: form.legalName.trim(),
    p_business_type: form.businessType,
    p_country_code: form.countryCode,
    p_timezone: form.timezone,
    p_base_currency: form.currency,
    p_fiscal_year_start_month: form.fiscalYearStartMonth,
    p_tax_identifier: form.taxIdentifier.trim() || undefined,
  })
  if (onboardingError) throw new Error(describeError(onboardingError))
  if (!organizationId) throw new Error(t('errors.generic'))
  provisionedOrganizationId.value = organizationId
  savePendingOnboarding()
  clearPendingOnboarding()
  await navigateTo('/dashboard')
}

async function createAccount() {
  pending.value = true
  errorMessage.value = ''
  try {
    if (!form.organizationName.trim() || !form.legalName.trim()) {
      errorMessage.value = t('onboarding.completeRequired')
      return
    }
    const { data: isAvailable, error: availabilityError } = await supabase.rpc('check_legal_name_availability', {
      p_legal_name: form.legalName.trim(),
    })
    if (availabilityError) throw availabilityError
    if (!isAvailable) {
      errorMessage.value = t('onboarding.legalNameTaken')
      return
    }
    const { data: auth, error: authError } = await supabase.auth.signUp({
      email: form.email.trim().toLowerCase(),
      password: form.password,
      options: {
        data: {
          full_name: form.fullName.trim(),
          phone: form.phone.trim(),
          job_title: form.jobTitle.trim(),
          // This is recovery state, not authorization data. Keeping it with
          // the unconfirmed auth user lets a later tab finish onboarding after
          // sessionStorage from the original signup tab has disappeared.
          pending_onboarding: {
            organization_name: form.organizationName.trim(),
            legal_name: form.legalName.trim(),
            business_type: form.businessType,
            country_code: form.countryCode,
            timezone: form.timezone,
            base_currency: form.currency,
            fiscal_year_start_month: form.fiscalYearStartMonth,
            tax_identifier: form.taxIdentifier.trim(),
          },
        },
      },
    })
    if (authError || !auth.user) throw new Error(t('auth.failed'))
    if (!auth.session) showOtpVerification()
    else await provisionAndStartTrial(auth.user.id)
  }
  catch (error) {
    errorMessage.value = error instanceof Error ? error.message : t('errors.generic')
  }
  finally { pending.value = false }
}

async function finishOnboarding() {
  if (!consentAccepted.value) {
    errorMessage.value = t('onboarding.consentRequired')
    return
  }

  if (existingAccountOnboarding.value) {
    pending.value = true
    errorMessage.value = ''
    try { await provisionAndStartTrial() }
    catch (error) { errorMessage.value = error instanceof Error ? error.message : t('errors.generic') }
    finally { pending.value = false }
    return
  }

  await createAccount()
}

async function verifyOtpAndContinue() {
  if (pending.value) return
  pending.value = true
  errorMessage.value = ''
  let emailVerified = false
  try {
    const normalizedEmail = form.email.trim().toLowerCase()
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession()
    if (sessionError) throw sessionError

    let userId = sessionData.session?.user.email?.toLowerCase() === normalizedEmail
      ? sessionData.session.user.id
      : undefined

    if (!userId) {
      if (otp.value.length !== 6 || otpExpired.value) return
      const { data, error } = await supabase.auth.verifyOtp({
        email: normalizedEmail,
        token: otp.value,
        type: 'email',
      })
      if (error || !data.session) throw new Error(t('onboarding.otpInvalid'))
      userId = data.user?.id
    }

    emailVerified = true
    await provisionAndStartTrial(userId)
  }
  catch (error) {
    errorMessage.value = error instanceof Error ? error.message : t('errors.generic')
    if (!emailVerified) otp.value = ''
  }
  finally { pending.value = false }
}

async function resendOtp() {
  if (resendIn.value > 0) return
  pending.value = true
  errorMessage.value = ''
  try {
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email: form.email.trim().toLowerCase(),
    })
    if (error) throw new Error(t('onboarding.otpResendFailed'))
    showOtpVerification()
  }
  catch (error) { errorMessage.value = error instanceof Error ? error.message : t('errors.generic') }
  finally { pending.value = false }
}

onMounted(() => {
  restore()
  hydrated.value = true
  const stored = sessionStorage.getItem(ONBOARDING_STORAGE_KEY)
  if (stored) {
    try {
      const pendingOnboarding = JSON.parse(stored)
      Object.assign(form, pendingOnboarding.form, { password: '' })
      const restoredCurrency = String(form.currency ?? '').trim().toUpperCase()
      const countryDefault = countries.find(country => country.code === form.countryCode)?.currency ?? 'EGP'
      form.currency = supportedCurrencies.includes(restoredCurrency as typeof supportedCurrencies[number])
        ? restoredCurrency
        : countryDefault
      otpExpiresAt.value = Number(pendingOnboarding.otpExpiresAt) || 0
      resendAvailableAt.value = Number(pendingOnboarding.resendAvailableAt) || 0
      provisionedOrganizationId.value = pendingOnboarding.provisionedOrganizationId ?? null
      awaitingOtp.value = Boolean(form.email && (otpExpiresAt.value > Date.now() || provisionedOrganizationId.value))
    }
    catch { clearPendingOnboarding() }
  }

  void restoreAuthenticatedOnboarding()
})

async function restoreAuthenticatedOnboarding() {
  const { data } = await supabase.auth.getUser()
  if (!data.user) return

  existingAccountOnboarding.value = true
  awaitingOtp.value = false
  restoreFromUserMetadata(data.user)

  await loadOrganizations(data.user.id, { force: true })
  if (currentId.value) {
    clearPendingOnboarding()
    await navigateTo('/dashboard')
    return
  }

  step.value = hasPersonalDetails() ? 2 : 1
  if (!hasPersonalDetails() || !hasBusinessDetails()) return

  pending.value = true
  errorMessage.value = ''
  try {
    await provisionAndStartTrial(data.user.id)
  }
  catch (error) {
    errorMessage.value = error instanceof Error ? error.message : t('errors.generic')
  }
  finally { pending.value = false }
}
</script>

<template>
  <BsAuthLayout :product-name="t('app.name')" :home-label="t('marketing.home')" :title="t('onboarding.title')" :description="t('onboarding.subtitle')" wide>
    <template #logo="{ tone }"><AppLogo :tone="tone" class="h-auto w-56" /></template>
        <form v-if="!awaitingOtp" class="ls-auth-card w-full p-6 sm:p-8" :data-hydrated="hydrated" @submit.prevent="step === 1 ? next() : finishOnboarding()">
          <header class="mb-6 space-y-2"><h1 class="text-xl font-bold">{{ t('onboarding.title') }}</h1><p class="text-sm text-fg-muted">{{ t('onboarding.noCardTrial') }}</p></header>
          <BsSignupWizard :step="step" :steps="[1, 2].map(index => ({ title: t(`onboarding.steps.${index}.title`), body: t(`onboarding.steps.${index}.body`) }))" :pending="pending" @back="back">


          <div v-if="step === 1" class="grid gap-4 sm:grid-cols-2">
            <FloatingField class="sm:col-span-2" :label="t('onboarding.fullName')"><input id="owner-name" v-model="form.fullName" class="ls-input" autocomplete="name" required></FloatingField>
            <FloatingField :label="t('onboarding.phone')"><input id="owner-phone" v-model="form.phone" class="ls-input" autocomplete="tel" dir="ltr" required></FloatingField>
            <FloatingField :label="t('onboarding.jobTitle')"><input id="owner-role" v-model="form.jobTitle" class="ls-input" required></FloatingField>
            <FloatingField :label="t('auth.email')"><input id="owner-email" v-model="form.email" type="email" class="ls-input" autocomplete="email" dir="ltr" :readonly="existingAccountOnboarding" required></FloatingField>
            <div v-if="!existingAccountOnboarding"><FloatingField :label="t('auth.password')"><input id="owner-password" v-model="form.password" type="password" minlength="8" class="ls-input" autocomplete="new-password" dir="ltr" required></FloatingField><p class="ls-hint">{{ t('onboarding.passwordHint') }}</p></div>
          </div>

          <div v-else-if="step === 2" class="grid gap-4 sm:grid-cols-2">
            <FloatingField :label="t('org.name')"><input id="org-display-name" v-model="form.organizationName" class="ls-input" required></FloatingField>
            <FloatingField :label="t('onboarding.legalName')"><input id="org-legal-name" v-model="form.legalName" class="ls-input" required></FloatingField>
            <FloatingField :label="t('onboarding.businessType')"><select id="org-type" v-model="form.businessType" class="ls-input"><option v-for="type in businessTypes" :key="type" :value="type">{{ t(`onboarding.businessTypes.${type}`) }}</option></select></FloatingField>
            <FloatingField :label="t('onboarding.country')"><select id="org-country" v-model="form.countryCode" class="ls-input"><option v-for="country in countries" :key="country.code" :value="country.code">{{ t(`onboarding.countries.${country.code}`) }}</option></select></FloatingField>
              <FloatingField :label="t('accounts.currency')"><select id="org-currency" v-model="form.currency" class="ls-input"><option v-for="currency in supportedCurrencies" :key="currency">{{ currency }}</option></select></FloatingField>
            <FloatingField :label="t('onboarding.timezone')"><input id="org-timezone" v-model="form.timezone" class="ls-input" dir="ltr" required></FloatingField>
            <FloatingField :label="t('onboarding.fiscalYear')"><select id="org-fiscal" v-model.number="form.fiscalYearStartMonth" class="ls-input"><option v-for="month in 12" :key="month" :value="month">{{ t(`onboarding.months.${month}`) }}</option></select></FloatingField>
            <div><FloatingField :label="t('onboarding.taxIdentifier')"><input id="org-tax" v-model="form.taxIdentifier" class="ls-input"></FloatingField><p class="ls-hint">{{ t('onboarding.optional') }}</p></div>
          </div>

          <div v-if="step === 2" class="mt-6 flex items-start gap-3 rounded-control border border-[var(--bs-border)] bg-surface-muted p-4 text-sm leading-6">
            <input id="signup-consent" v-model="consentAccepted" type="checkbox" required class="mt-1 size-4 shrink-0 accent-[var(--bs-primary)]">
            <label for="signup-consent">
              <i18n-t keypath="onboarding.consent" tag="span" scope="global">
                <template #terms>
                  <NuxtLink to="/terms" target="_blank" rel="noopener" class="font-semibold text-link underline underline-offset-4">{{ t('marketing.terms') }}</NuxtLink>
                </template>
                <template #refund>
                  <NuxtLink to="/refund-cancellation" target="_blank" rel="noopener" class="font-semibold text-link underline underline-offset-4">{{ t('marketing.refundCancellation') }}</NuxtLink>
                </template>
                <template #privacy>
                  <NuxtLink to="/privacy" target="_blank" rel="noopener" class="font-semibold text-link underline underline-offset-4">{{ t('marketing.privacy') }}</NuxtLink>
                </template>
              </i18n-t>
            </label>
          </div>

          <p v-if="errorMessage" class="ls-error mt-6" role="alert">{{ errorMessage }}</p>
          <button type="submit" class="ls-btn ls-btn-primary mt-8 w-full" :disabled="pending || (step === 2 && !consentAccepted)">{{ submitButtonText }}</button>
          <p v-if="step === 2" class="mt-3 text-center text-xs text-fg-muted">{{ t('onboarding.noCardRequired') }}</p>
          </BsSignupWizard>
        </form>

        <form v-else class="ls-auth-card w-full p-6 sm:p-8" :data-hydrated="hydrated" @submit.prevent="verifyOtpAndContinue">
          <div class="mx-auto max-w-lg text-center">
            <div class="mx-auto grid size-14 place-items-center rounded-full bg-surface-muted text-primary"><AppIcon name="mail" :size="28" /></div>
            <p class="mt-6 text-xs font-bold uppercase tracking-[.18em] text-fg-muted">{{ t('onboarding.otpEyebrow') }}</p>
            <h2 class="mt-2 text-2xl font-black">{{ t('onboarding.otpTitle') }}</h2>
            <p class="mt-3 text-sm leading-6 text-fg-muted">{{ t('onboarding.otpDescription') }}</p>
            <p class="mt-1 break-all font-bold" dir="ltr">{{ form.email }}</p>
          </div>

          <div class="mx-auto mt-8 max-w-md">
            <OtpInput v-model="otp" :label="t('onboarding.otpLabel')" :disabled="pending || otpExpired" />

            <div class="mt-4 flex items-center justify-between gap-4 text-xs text-fg-muted" aria-live="polite">
              <span v-if="!otpExpired">{{ t('onboarding.otpExpiresIn', { time: formatCountdown(otpExpiresIn) }) }}</span>
              <span v-else class="font-semibold text-danger">{{ t('onboarding.otpExpired') }}</span>
              <span>{{ t('onboarding.otpAttemptsHint') }}</span>
            </div>

            <p v-if="errorMessage" class="ls-error mt-6" role="alert">{{ errorMessage }}</p>

            <button class="ls-btn ls-btn-primary mt-6 w-full" :disabled="pending || otp.length !== 6 || otpExpired">
              {{ pending ? t('onboarding.otpVerifying') : t('onboarding.otpVerify') }}
            </button>

            <div class="mt-6 text-center text-sm text-fg-muted">
              <span>{{ t('onboarding.otpMissing') }}</span>
              <button type="button" class="ms-1 font-bold text-fg underline underline-offset-4 disabled:no-underline disabled:opacity-50" :disabled="pending || resendIn > 0" @click="resendOtp">
                {{ resendIn > 0 ? t('onboarding.otpResendIn', { time: formatCountdown(resendIn) }) : t('onboarding.otpResend') }}
              </button>
            </div>

            <div class="mt-8 rounded-control border border-[var(--bs-border)] bg-surface-muted p-4 text-xs leading-5 text-fg-muted">
              <p class="font-bold text-fg">{{ t('onboarding.otpSecurityTitle') }}</p>
              <p class="mt-1">{{ t('onboarding.otpSecurityBody') }}</p>
            </div>
          </div>
        </form>

    <template #legal><p class="mt-4 text-sm text-fg-muted"><NuxtLink to="/login" class="underline">{{ t('auth.signIn') }}</NuxtLink> · <NuxtLink to="/contact" class="underline">{{ t('marketing.contact') }}</NuxtLink></p></template>
  </BsAuthLayout>
</template>
