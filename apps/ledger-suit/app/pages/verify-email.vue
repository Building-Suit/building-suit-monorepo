<script setup lang="ts">
import type { Database } from '~~/types/database.types'

definePageMeta({ layout: false })

const supabase = useSupabaseClient<Database>()
const route = useRoute()
const { t } = useI18n()
const { restore } = useTheme()
const describeError = useErrorMessage()

useHead({ title: () => `${t('onboarding.otpTitle')} · ${t('app.name')}` })

const email = computed(() => typeof route.query.email === 'string' ? route.query.email.trim().toLowerCase() : '')
const otp = ref('')
const pending = ref(false)
const errorMessage = ref('')
const verified = ref(false)
const verification = useVerificationTimer()
const ONBOARDING_STORAGE_KEY = 'ledger-suit.pending-onboarding'

async function verify() {
  if (!email.value || pending.value) return
  pending.value = true
  errorMessage.value = ''
  try {
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession()
    if (sessionError) throw sessionError
    if (sessionData.session?.user.email?.toLowerCase() === email.value) verified.value = true

    if (!verified.value) {
      if (otp.value.length !== 6 || verification.expired.value) return
      const { data, error } = await supabase.auth.verifyOtp({
        email: email.value,
        token: otp.value,
        type: 'email',
      })
      if (error || !data.session) throw new Error(t('onboarding.otpInvalid'))
      verified.value = true
    }

    const { data: organizationId, error: resumeError } = await supabase.rpc('resume_saved_signup')
    if (resumeError) throw new Error(describeError(resumeError))
    if (!organizationId) {
      await navigateTo('/signup')
      return
    }

    sessionStorage.removeItem(ONBOARDING_STORAGE_KEY)
    await navigateTo('/dashboard')
  }
  catch (error) {
    errorMessage.value = error instanceof Error ? error.message : t('errors.generic')
    if (!verified.value) otp.value = ''
  }
  finally { pending.value = false }
}

async function resend() {
  if (!email.value || verification.resendIn.value > 0) return
  pending.value = true
  errorMessage.value = ''
  try {
    const { error } = await supabase.auth.resend({ type: 'signup', email: email.value })
    if (error) throw error
    verification.start()
  }
  catch { errorMessage.value = t('onboarding.otpResendFailed') }
  finally { pending.value = false }
}

onMounted(() => {
  restore()
  if (!email.value) navigateTo('/login')
  verification.start()
})
</script>

<template>
  <BsAuthLayout :product-name="t('app.name')" :home-label="t('marketing.home')" :title="t('onboarding.otpTitle')" :description="t('onboarding.otpDescription')">
    <template #logo="{ tone }"><BsProductLogo name="Ledger Suit" asset-prefix="/brand/ledger-suit" :tone="tone" size="auth" /></template>
    <BsVerificationForm
      v-model="otp" :eyebrow="t('onboarding.otpEyebrow')" :title="t('onboarding.otpTitle')"
      :description="t('onboarding.otpDescription')" :email="email" :code-label="t('onboarding.otpLabel')"
      :pending="pending" :error="errorMessage" :expired="verification.expired.value" :verified="verified"
      :expiry-label="t('onboarding.otpExpiresIn', { time: verification.format(verification.expiresIn.value) })"
      :expired-label="t('onboarding.otpExpired')" :attempts-label="t('onboarding.otpAttemptsHint')"
      :submit-label="verified ? t('billing.startTrial') : t('onboarding.otpVerify')" :pending-label="t('onboarding.otpVerifying')"
      :resend-prompt="t('onboarding.otpMissing')"
      :resend-label="verification.resendIn.value > 0 ? t('onboarding.otpResendIn', { time: verification.format(verification.resendIn.value) }) : t('onboarding.otpResend')"
      :resend-disabled="verification.resendIn.value > 0" :security-title="t('onboarding.otpSecurityTitle')" :security-body="t('onboarding.otpSecurityBody')"
      @submit="verify" @resend="resend"
    />
  </BsAuthLayout>
</template>
