<script setup lang="ts">
import type { BsSignupForm, BsSignupFeatures, BsSignupView, BsSignupCopy, BsSignupVerificationCopy, BsSignupProduct, BsSignupChoices, BsSignupLinks, BsSignupLegalConsent } from '@building-suit/ui/types/signupPresentation'

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
const businessTypeOptions = computed(() => businessTypes.map(value => ({ value, label: t(`onboarding.businessTypes.${value}`) })))
const countryOptions = computed(() => countries.map(country => ({ value: country.code, label: t(`onboarding.countries.${country.code}`) })))
const currencyOptions = supportedCurrencies.map(value => ({ value, label: value }))
const fiscalMonthOptions = computed(() => Array.from({ length: 12 }, (_, index) => ({ value: index + 1, label: t(`onboarding.months.${index + 1}`) })))
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

const signupFeatures: BsSignupFeatures = { phone: true, jobTitle: true, organizationDetails: true, mainLocation: false, businessMode: false, passwordMinLength: 8, workspaceMinLength: null, workspaceMaxLength: null, locationMinLength: null, locationMaxLength: null, locationCodeMaxLength: null, locationAddressMaxLength: null, locationPhoneMaxLength: null }
const signupProduct = computed<BsSignupProduct>(() => ({ framed: true, name: t('app.name'), assetPrefix: '/brand/ledger-suit', homeLabel: t('marketing.home'), title: t('onboarding.title'), description: t('onboarding.subtitle') }))
const signupForm = computed<BsSignupForm>({
  get: () => ({ name: form.fullName, phone: form.phone, jobTitle: form.jobTitle, email: form.email, password: form.password, workspaceName: form.organizationName, legalName: form.legalName, businessType: form.businessType, country: form.countryCode, currency: form.currency, timezone: form.timezone, fiscalMonth: form.fiscalYearStartMonth, taxIdentifier: form.taxIdentifier, locationName: '', locationCode: '', locationAddress: '', locationPhone: '', businessMode: '' }),
  set: value => {
    form.fullName = value.name; form.phone = value.phone; form.jobTitle = value.jobTitle; form.email = value.email; form.password = value.password
    form.organizationName = value.workspaceName; form.legalName = value.legalName; form.timezone = value.timezone; form.taxIdentifier = value.taxIdentifier
    if (businessTypes.includes(value.businessType as BusinessType)) form.businessType = value.businessType as BusinessType
    if (countries.some(country => country.code === value.country)) form.countryCode = value.country
    if (supportedCurrencies.includes(value.currency as typeof supportedCurrencies[number])) form.currency = value.currency
    if (Number.isInteger(value.fiscalMonth) && value.fiscalMonth >= 1 && value.fiscalMonth <= 12) form.fiscalYearStartMonth = value.fiscalMonth
  },
})
const signupView = computed<BsSignupView>(() => ({ stage: awaitingOtp.value ? 'verification' : step.value === 1 ? 'account' : 'workspace', step: step.value, pending: pending.value, error: errorMessage.value, notice: '', existingAccount: existingAccountOnboarding.value, hydrated: hydrated.value, submitDisabled: step.value === 2 && !consentAccepted.value, submitLabel: submitButtonText.value, pendingLabel: submitButtonText.value, expired: otpExpired.value, resendDisabled: resendIn.value > 0, verified: false, canStartOver: false }))
const signupCopy = computed<BsSignupCopy>(() => ({ eyebrow: '', title: t('onboarding.title'), description: t('onboarding.noCardTrial'), name: t('onboarding.fullName'), phone: t('onboarding.phone'), jobTitle: t('onboarding.jobTitle'), email: t('auth.email'), password: t('auth.password'), passwordHint: t('onboarding.passwordHint'), workspaceName: t('org.name'), legalName: t('onboarding.legalName'), businessType: t('onboarding.businessType'), country: t('onboarding.country'), currency: t('accounts.currency'), timezone: t('onboarding.timezone'), fiscalMonth: t('onboarding.fiscalYear'), taxIdentifier: t('onboarding.taxIdentifier'), optional: t('onboarding.optional'), mainLocation: '', locationName: '', locationCode: '', locationAddress: '', locationPhone: '', businessMode: '', businessModeHelp: '', trialTitle: '', trialBody: '', back: '', formFooter: t('onboarding.noCardRequired'), signIn: '', recoveryTitle: '', recoveryBody: '', recover: '', startOver: '', steps: [1, 2].map(index => ({ id: index, title: t(`onboarding.steps.${index}.title`), body: t(`onboarding.steps.${index}.body`) })) }))
const signupVerificationCopy = computed<BsSignupVerificationCopy>(() => ({ eyebrow: t('onboarding.otpEyebrow'), title: t('onboarding.otpTitle'), description: t('onboarding.otpDescription'), codeLabel: t('onboarding.otpLabel'), expiryLabel: t('onboarding.otpExpiresIn', { time: formatCountdown(otpExpiresIn.value) }), expiredLabel: t('onboarding.otpExpired'), attemptsLabel: t('onboarding.otpAttemptsHint'), submitLabel: t('onboarding.otpVerify'), pendingLabel: t('onboarding.otpVerifying'), resendPrompt: t('onboarding.otpMissing'), resendLabel: resendIn.value > 0 ? t('onboarding.otpResendIn', { time: formatCountdown(resendIn.value) }) : t('onboarding.otpResend'), securityTitle: t('onboarding.otpSecurityTitle'), securityBody: t('onboarding.otpSecurityBody') }))
const signupChoices = computed<BsSignupChoices>(() => ({ businessTypes: businessTypeOptions.value, countries: countryOptions.value, currencies: currencyOptions, fiscalMonths: fiscalMonthOptions.value, businessModes: [] }))
const signupLinks = computed<BsSignupLinks>(() => ({ signInTo: '/login', recoveryTo: '', formSignInLabel: '', verificationFooter: false, legal: [{ to: '/login', label: t('auth.signIn') }, { to: '/contact', label: t('marketing.contact') }] }))
const signupLegalConsent = computed<BsSignupLegalConsent>(() => ({ keypath: 'onboarding.consent', termsLabel: t('marketing.terms'), termsTo: '/terms', refundLabel: t('marketing.refundCancellation'), refundTo: '/refund-cancellation', privacyLabel: t('marketing.privacy'), privacyTo: '/privacy' }))
async function submitSignup() { if (step.value === 1) await next(); else await finishOnboarding() }
</script>
<template>
  <BsSignupPage v-model:form="signupForm" v-model:otp="otp" v-model:consent="consentAccepted" :product="signupProduct" :features="signupFeatures" :view="signupView" :copy="signupCopy" :verification-copy="signupVerificationCopy" :choices="signupChoices" :links="signupLinks" :legal-consent="signupLegalConsent" @submit="submitSignup" @back="back" @verify="verifyOtpAndContinue" @resend="resendOtp" />
</template>
