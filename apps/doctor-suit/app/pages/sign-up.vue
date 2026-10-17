<script setup lang="ts">
definePageMeta({ layout: false })
const { auth, copy, product, availability, error } = useDoctorAuthPresentation()
const form = ref({ name: '', phone: '', jobTitle: '', email: '', password: '', workspaceName: '', legalName: '', businessType: '', country: '', currency: '', timezone: '', fiscalMonth: 1, taxIdentifier: '', locationName: '', locationCode: '', locationAddress: '', locationPhone: '', businessMode: '' })
const otp = ref('')
const consent = ref(false)
const validation = ref(false)
const features = { phone: false, jobTitle: false, organizationDetails: false, mainLocation: false, businessMode: false, passwordMinLength: 12, workspaceMinLength: null, workspaceMaxLength: null, locationMinLength: null, locationMaxLength: null, locationCodeMaxLength: null, locationAddressMaxLength: null, locationPhoneMaxLength: null }
const view = computed(() => ({ stage: auth.state.phase === 'verification' ? 'verification' as const : 'account' as const, step: 1, pending: auth.state.pending, error: validation.value ? copy.value.invalid : error.value || '', notice: '', existingAccount: false, hydrated: true, submitDisabled: false, submitLabel: copy.value.signUp, pendingLabel: copy.value.pending, expired: auth.state.error === 'expired', resendDisabled: auth.state.pending, verified: false, canStartOver: true }))
const signupCopy = computed(() => ({ ...copy.value, eyebrow: '', title: copy.value.signUp, passwordHint: copy.value.passwordHint, phone: '', jobTitle: '', workspaceName: '', legalName: '', businessType: '', country: '', currency: '', timezone: '', fiscalMonth: '', taxIdentifier: '', optional: '', mainLocation: '', locationName: '', locationCode: '', locationAddress: '', locationPhone: '', businessMode: '', businessModeHelp: '', trialTitle: '', trialBody: '', back: '', formFooter: '', recoveryTitle: copy.value.recovery, recoveryBody: copy.value.recoveryDescription, recover: copy.value.forgot, startOver: copy.value.signUp, steps: [] }))
const verificationCopy = computed(() => ({ title: copy.value.verify, description: copy.value.verifyDescription, codeLabel: copy.value.code, expiryLabel: '', expiredLabel: copy.value.expired, submitLabel: copy.value.verify, pendingLabel: copy.value.pending, resendLabel: copy.value.resend }))
async function submit() {
  validation.value = form.value.password.length < 12 || !form.value.name.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.value.email)
  if (validation.value) return
  const secret = form.value.password
  form.value.password = ''
  await auth.signUp(form.value.name.trim(), form.value.email.trim(), secret)
}
async function verify() {
  const code = otp.value
  otp.value = ''
  if (await auth.verify(form.value.email.trim(), code)) await navigateTo('/account')
}
async function resend() { otp.value = ''; await auth.resend(form.value.email.trim()) }
function clearDraft() { form.value.password = ''; form.value.email = ''; form.value.name = ''; otp.value = '' }
async function startOver() { clearDraft(); await auth.refresh() }
onBeforeUnmount(clearDraft)
</script>
<template>
  <BsSignupPage v-model:form="form" v-model:otp="otp" v-model:consent="consent" :product="{ ...product, framed: true, assetPrefix: '' }" :features="features" :view="view" :copy="signupCopy" :verification-copy="verificationCopy" :availability="availability" :choices="{ businessTypes: [], countries: [], currencies: [], fiscalMonths: [], businessModes: [] }" :links="{ signInTo: '/sign-in', recoveryTo: '/recover', formSignInLabel: copy.signIn, verificationFooter: true, legal: [] }" :legal-consent="null" @submit="submit" @verify="verify" @resend="resend" @start-over="startOver" @sign-in="navigateTo('/sign-in')" @clear-draft="clearDraft" />
</template>
