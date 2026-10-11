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
const verificationTimer = useVerificationTimer()
const resendIn = verificationTimer.resendIn

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
    verificationTimer.start()
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

onMounted(() => { restore(); void loadPreview() })
const identityForm = computed({
  get: () => ({ email: preview.value?.email ?? '', name: fullName.value, phone: phone.value, jobTitle: jobTitle.value, password: password.value, confirmation: confirmPassword.value }),
  set: (value: import('@building-suit/ui/types/invitationPresentation').BsInvitationIdentityForm) => { fullName.value = value.name; phone.value = value.phone; jobTitle.value = value.jobTitle; password.value = value.password; confirmPassword.value = value.confirmation },
})
const pageCopy = computed(() => ({
  eyebrow: t('access.inviteFlow.eyebrow'), title: step.value === 'ready' ? t('access.inviteFlow.title', { organization: preview.value?.organization_name }) : t('access.inviteFlow.passwordTitle'),
  description: step.value === 'ready' ? t('access.inviteFlow.subtitle', { name: preview.value?.inviter_name, jobTitle: preview.value?.inviter_job_title || t('org.roles.admin'), role: previewRoleLabel.value }) : t('access.inviteFlow.passwordBody'),
  submit: step.value === 'ready' ? t('access.inviteFlow.sendOtp') : t('access.inviteFlow.finish'), pending: step.value === 'ready' ? t('access.inviteFlow.sendingOtp') : t('access.inviteFlow.finishing'), invalid: t('access.inviteFlow.invalid'), backToLogin: t('access.inviteFlow.backToLogin'), email: t('access.inviteFlow.emailLabel'), password: t('access.inviteFlow.password'), confirmation: t('access.inviteFlow.confirmPassword'), name: t('onboarding.fullName'), phone: t('onboarding.phone'), jobTitle: t('onboarding.jobTitle'), security: t('access.inviteFlow.security'),
  verification: { eyebrow: t('access.inviteFlow.eyebrow'), title: t('access.inviteFlow.otpTitle'), description: t('access.inviteFlow.otpBody', { email: preview.value?.email ?? '' }), code: t('onboarding.otpLabel'), submit: t('access.inviteFlow.verifyOtp'), pending: t('access.inviteFlow.verifyingOtp'), resend: resendIn.value ? t('onboarding.otpResendIn', { time: `00:${String(resendIn.value).padStart(2, '0')}` }) : t('access.inviteFlow.resend'), expired: t('onboarding.otpExpired'), security: t('access.inviteFlow.security') },
}))
const pageStage = computed(() => step.value === 'otp' ? 'verification' : step.value === 'password' ? 'profile' : step.value)
</script>
<template>
  <BsInvitationAcceptancePage v-model:form="identityForm" v-model:code="otp" :product="{ name: t('app.name'), assetPrefix: '/brand/ledger-suit', homeLabel: t('marketing.home'), title: preview?.organization_name || t('app.name'), description: t('auth.welcomeBody') }" :stage="pageStage" :copy="pageCopy" :email="preview?.email ?? ''" :pending="pending" :error="errorMessage" :submit-disabled="step === 'password' && (password.length < 8 || confirmPassword.length < 8)" login-to="/login" :verification="{ resendDisabled: resendIn > 0 }" @submit="step === 'ready' ? sendOtp() : finish()" @verify="verifyOtp" @resend="sendOtp" @login="navigateTo('/login')" />
</template>
