<script setup lang="ts">
import type { Database } from '~~/types/database.types'

definePageMeta({ layout: false })

type InviteStep = 'loading' | 'ready' | 'otp' | 'password' | 'invalid'
interface InvitationPreview {
  email: string
  organization_name: string
  role: Database['public']['Enums']['organization_role']
  role_key: string | null
  role_name_en: string | null
  role_name_ar: string | null
  inviter_name: string
  inviter_job_title: string | null
  expires_at: string
  user_exists: boolean
}

const supabase = useSupabaseClient<Database>()
const route = useRoute()
const { t, locale } = useI18n()
const { restore } = useTheme()
const tenant = useTenant()

const token = computed(() => typeof route.query.token === 'string' ? route.query.token.trim() : '')
const preview = ref<InvitationPreview | null>(null)
const previewRoleLabel = computed(() => {
  if (!preview.value) return ''
  if (preview.value.role_name_en) return locale.value === 'ar' ? preview.value.role_name_ar : preview.value.role_name_en
  return t(`org.roles.${preview.value.role}`)
})
const step = ref<InviteStep>('loading')
const user = useSupabaseUser()
const fullName = ref('')
const phone = ref('')
const jobTitle = ref('')
const otp = ref('')
const password = ref('')
const confirmPassword = ref('')
const pending = ref(false)
const errorMessage = ref('')
const hydrated = ref(false)
const resendAvailableAt = ref(0)
const now = ref(Date.now())
const resendIn = computed(() => Math.max(0, Math.ceil((resendAvailableAt.value - now.value) / 1000)))

useHead({ title: () => `${preview.value?.organization_name ?? t('access.invitations')} · ${t('app.name')}` })

async function loadPreview() {
  if (!token.value) {
    step.value = 'invalid'
    return
  }
  const { data, error } = await supabase.rpc('preview_organization_invitation', { p_token: token.value })
  const invitation = (data as InvitationPreview[] | null)?.[0]
  if (error || !invitation) {
    step.value = 'invalid'
    return
  }
  preview.value = invitation
  if (invitation.user_exists) {
    if (user.value?.email?.toLowerCase() === invitation.email.toLowerCase()) {
      try {
        const { error: acceptError } = await supabase.rpc('accept_organization_invitation', { p_token: token.value })
        if (acceptError) throw acceptError
        await tenant.loadOrganizations(user.value.id, { force: true })
        await navigateTo('/dashboard')
        return
      }
      catch {
        step.value = 'invalid'
        return
      }
    }
    if (user.value) await supabase.auth.signOut()
    await navigateTo(`/login?redirect=${encodeURIComponent(route.fullPath)}`)
    return
  }
  step.value = 'ready'
}

async function sendOtp() {
  if (!preview.value || (resendIn.value > 0 && step.value === 'otp')) return
  pending.value = true
  errorMessage.value = ''
  try {
    const { error } = await supabase.auth.signInWithOtp({ email: preview.value.email, options: { shouldCreateUser: true } })
    if (error) throw error
    otp.value = ''
    step.value = 'otp'
    resendAvailableAt.value = Date.now() + 60 * 1000
  }
  catch { errorMessage.value = t('auth.failed') }
  finally { pending.value = false }
}

async function verifyOtp() {
  if (!preview.value || otp.value.length !== 6) return
  pending.value = true
  errorMessage.value = ''
  try {
    const { data, error } = await supabase.auth.verifyOtp({ email: preview.value.email, token: otp.value, type: 'email' })
    if (error || !data.session) throw error ?? new Error('Session missing')
    step.value = 'password'
  }
  catch {
    otp.value = ''
    errorMessage.value = t('access.inviteFlow.otpFailed')
  }
  finally { pending.value = false }
}

async function finish() {
  if (!preview.value || password.value.length < 8) return
  if (password.value !== confirmPassword.value) {
    errorMessage.value = t('access.inviteFlow.passwordMismatch')
    return
  }
  if (!fullName.value || !phone.value || !jobTitle.value) {
    errorMessage.value = t('validation.required')
    return
  }
  pending.value = true
  errorMessage.value = ''
  try {
    const { error: passwordError } = await supabase.auth.updateUser({ password: password.value })
    if (passwordError) throw passwordError
    const { data: authData } = await supabase.auth.getUser()
    if (!authData.user || authData.user.email?.toLowerCase() !== preview.value.email.toLowerCase()) throw new Error('Invitation identity mismatch')
    const { error: profileError } = await supabase.from('profiles').update({
      full_name: fullName.value.trim(),
      phone: phone.value.trim(),
      job_title: jobTitle.value.trim(),
    }).eq('id', authData.user.id)
    if (profileError) throw profileError
    const { error: invitationError } = await supabase.rpc('accept_organization_invitation', { p_token: token.value })
    if (invitationError) throw invitationError
    await tenant.loadOrganizations(authData.user.id, { force: true })
    await navigateTo('/dashboard')
  }
  catch { errorMessage.value = t('auth.failed') }
  finally { pending.value = false }
}

let timer: ReturnType<typeof setInterval> | undefined
onMounted(() => {
  restore()
  hydrated.value = true
  void loadPreview()
  timer = setInterval(() => (now.value = Date.now()), 1000)
})
onBeforeUnmount(() => clearInterval(timer))
</script>

<template>
  <BsAuthLayout
    :product-name="t('app.name')" :home-label="t('marketing.home')"
    :title="preview?.organization_name || t('app.name')" :description="t('auth.welcomeBody')"
  >
    <template #logo="{ tone }"><BsProductLogo name="Ledger Suit" asset-prefix="/brand/ledger-suit" :tone="tone" class="h-auto w-56" /></template>

    <div v-if="step === 'loading'" aria-busy="true" class="w-full">
      <BsSectionSkeleton variant="table" :rows="4" />
    </div>

    <BsAuthForm
      v-else-if="step === 'invalid'" :title="t('access.inviteFlow.invalid')"
      :data-hydrated="hydrated" :submit-label="t('access.inviteFlow.backToLogin')"
      @submit="navigateTo('/login')"
    >
      <BsStateSurface state="error" :title="t('access.inviteFlow.invalid')" />
    </BsAuthForm>

    <BsVerificationForm
      v-else-if="preview && step === 'otp'" v-model="otp"
      :eyebrow="t('access.inviteFlow.eyebrow')" :title="t('access.inviteFlow.otpTitle')"
      :description="t('access.inviteFlow.otpBody', { email: preview.email })" :email="preview.email"
      :code-label="t('onboarding.otpLabel')" :pending="pending" :error="errorMessage"
      :expired-label="t('onboarding.otpExpired')" :submit-label="t('access.inviteFlow.verifyOtp')"
      :pending-label="t('access.inviteFlow.verifyingOtp')"
      :resend-label="resendIn ? t('onboarding.otpResendIn', { time: `00:${String(resendIn).padStart(2, '0')}` }) : t('access.inviteFlow.resend')"
      :resend-disabled="resendIn > 0" :security-body="t('access.inviteFlow.security')"
      @submit="verifyOtp" @resend="sendOtp"
    />

    <BsAuthForm
      v-else-if="preview" :eyebrow="t('access.inviteFlow.eyebrow')"
      :title="step === 'ready' ? t('access.inviteFlow.title', { organization: preview.organization_name }) : t('access.inviteFlow.passwordTitle')"
      :description="step === 'ready' ? t('access.inviteFlow.subtitle', { name: preview.inviter_name, jobTitle: preview.inviter_job_title || t('org.roles.admin'), role: previewRoleLabel }) : t('access.inviteFlow.passwordBody')"
      :pending="pending" :error="errorMessage"
      :submit-label="step === 'ready' ? t('access.inviteFlow.sendOtp') : t('access.inviteFlow.finish')"
      :pending-label="step === 'ready' ? t('access.inviteFlow.sendingOtp') : t('access.inviteFlow.finishing')"
      :submit-disabled="step === 'password' && (password.length < 8 || confirmPassword.length < 8)"
      :data-hydrated="hydrated" @submit="step === 'ready' ? sendOtp() : finish()"
    >
      <BsFloatingField :label="t('access.inviteFlow.emailLabel')">
        <input :value="preview.email" type="email" class="ls-input" readonly dir="ltr" aria-readonly="true">
      </BsFloatingField>

      <template v-if="step === 'password'">
        <BsFloatingField :label="t('onboarding.fullName')">
          <input v-model="fullName" type="text" autocomplete="name" class="ls-input" required>
        </BsFloatingField>
        <BsFloatingField :label="t('onboarding.phone')">
          <input v-model="phone" type="tel" autocomplete="tel" class="ls-input" required dir="ltr">
        </BsFloatingField>
        <BsFloatingField :label="t('onboarding.jobTitle')">
          <input v-model="jobTitle" type="text" autocomplete="organization-title" class="ls-input" required>
        </BsFloatingField>
        <BsFloatingField :label="t('access.inviteFlow.password')">
          <input v-model="password" type="password" minlength="8" autocomplete="new-password" class="ls-input" required dir="ltr">
        </BsFloatingField>
        <BsFloatingField :label="t('access.inviteFlow.confirmPassword')">
          <input v-model="confirmPassword" type="password" minlength="8" autocomplete="new-password" class="ls-input" required dir="ltr">
        </BsFloatingField>
      </template>

      <div class="flex items-start gap-3 ls-card-muted p-4 text-xs leading-5 text-fg-muted">
        <BsIcon name="checkBadge" :size="19" class="mt-0.5 shrink-0 text-success" />
        <p>{{ t('access.inviteFlow.security') }}</p>
      </div>
    </BsAuthForm>
  </BsAuthLayout>
</template>
