<script setup lang="ts">
import { usePageExitCleanup } from '@building-suit/ux'
import { doctorSetupForm } from '../utils/practiceSetup'
import { useDoctorOnboardingDraft } from '../composables/useDoctorOnboardingDraft'
definePageMeta({ layout: false, middleware: 'doctor-auth' })
const { auth, product, availability: authAvailability } = useDoctorAuthPresentation(false)
const { practice, copy, error } = useDoctorPracticePresentation()
const hydrated = ref(false)
onMounted(() => { hydrated.value = true })
await practice.load()
if(practice.state.setup?.subscriptionRequired)await navigateTo('/subscription')
const initial = doctorSetupForm(practice.state.setup || { enrollment: 'owner', profile: null, practice: null, location: null, draft: null })
const form = ref({ name: initial.displayName, workspaceName: initial.practiceName, locationName: initial.locationName, timezone: initial.timezone, phone: '', jobTitle: '', email: '', password: '', legalName: '', businessType: '', country: '', currency: '', fiscalMonth: 1, taxIdentifier: '', locationCode: '', locationAddress: '', locationPhone: '', businessMode: '' })
useDoctorOnboardingDraft(auth.state, practice, form)
watch(() => practice.state.setup?.subscriptionRequired, required => { if (required) void navigateTo('/subscription') })
const otp = ref('')
const consent = ref(false)
const editing = computed(() => Boolean(practice.state.setup?.practice))
const availability = computed(() => authAvailability.value || (!hydrated.value || practice.state.phase === 'loading' || practice.state.setup?.subscriptionRequired ? { state: 'loading' as const, title: copy.value.loading, description: copy.value.description }
  : practice.state.phase === 'denied' ? { state: 'permission' as const, title: copy.value.denied, description: copy.value.deniedDescription }
    : !practice.state.setup ? { state: 'error' as const, title: copy.value.loading, description: error.value || copy.value.missing } : undefined))
const features = computed(() => ({ profileName: true, profileNameMaxLength: 120, standaloneTimezone: !editing.value, locationContactFields: false, phone: false, jobTitle: false, organizationDetails: false, mainLocation: !editing.value, businessMode: false, passwordMinLength: 12, workspaceMinLength: 1, workspaceMaxLength: 160, locationMinLength: 1, locationMaxLength: 160, locationCodeMaxLength: null, locationAddressMaxLength: null, locationPhoneMaxLength: null }))
const view = computed(() => ({ stage: 'workspace' as const, step: 1, pending: practice.state.pending, error: error.value || '', notice: practice.state.saved ? copy.value.saved : '', existingAccount: true, showVerifiedIdentity: false, nameLocked: false, hydrated: hydrated.value, submitDisabled: practice.state.pending, submitLabel: editing.value ? copy.value.save : copy.value.complete, pendingLabel: copy.value.pending, expired: false, resendDisabled: true, verified: true, canStartOver: false }))
const signupCopy = computed(() => ({ eyebrow: '', title: editing.value ? copy.value.edit : copy.value.setup, description: copy.value.description, name: copy.value.name, phone: '', jobTitle: '', email: '', password: '', passwordHint: '', workspaceName: copy.value.practice, legalName: '', businessType: '', country: '', currency: '', timezone: copy.value.timezone, fiscalMonth: '', taxIdentifier: '', optional: '', mainLocation: copy.value.location, locationName: copy.value.locationName, locationCode: '', locationAddress: '', locationPhone: '', businessMode: '', businessModeHelp: '', trialTitle: '', trialBody: '', back: '', formFooter: copy.value.boundaries, signIn: copy.value.back, recoveryTitle: '', recoveryBody: '', recover: '', startOver: '', steps: [] }))
function values() { return { displayName: form.value.name, practiceName: form.value.workspaceName, locationName: form.value.locationName, timezone: form.value.timezone } }
async function submit() {
  const succeeded = editing.value ? await practice.updateProfile(values()) : await practice.complete(values())
  if (succeeded) { await auth.refresh(); await navigateTo('/workspace') }
}
async function saveDraft() { await practice.saveDraft(values()) }
usePageExitCleanup(() => { form.value.name = ''; form.value.workspaceName = ''; form.value.locationName = ''; form.value.timezone = '' })
</script>
<template>
  <BsSignupPage v-model:form="form" v-model:otp="otp" v-model:consent="consent" :product="{ ...product, framed: true, assetPrefix: '', title: editing ? copy.edit : copy.setup, description: copy.boundaries }" :features="features" :view="view" :copy="signupCopy" :availability="availability" :draft-action="editing ? undefined : copy.draft" :verification-copy="{ title: '', description: '', codeLabel: '', expiryLabel: '', expiredLabel: '', submitLabel: '', pendingLabel: '', resendLabel: '' }" :choices="{ businessTypes: [], countries: [], currencies: [], fiscalMonths: [], businessModes: [] }" :links="{ signInTo: '/account', recoveryTo: '/account', formSignInLabel: copy.back, verificationFooter: false, legal: [] }" :legal-consent="null" @save-draft="saveDraft" @submit="submit" />
</template>
