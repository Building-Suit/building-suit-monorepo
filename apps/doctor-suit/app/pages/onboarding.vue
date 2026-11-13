<script setup lang="ts">
import { usePageExitCleanup } from '@building-suit/ux'
import { doctorSuggestedTimezone, doctorTimezoneChoices } from '../utils/timezoneChoices'
import { doctorSetupForm } from '../utils/practiceSetup'
import { useDoctorOnboardingDraft } from '../composables/useDoctorOnboardingDraft'
import { bindDoctorRegistrationDraft, readDoctorRegistrationDraft, saveDoctorRegistrationDraft } from '../utils/registrationDraft'
definePageMeta({ layout: false, middleware: 'doctor-auth' })
const { auth, product, availability: authAvailability } = useDoctorAuthPresentation(false)
const registrationHandoff = useDoctorRegistrationHandoff()
const environment = useRuntimeConfig().public.doctorAuth.environment
const { practice, copy, error } = useDoctorPracticePresentation()
const hydrated = ref(false)
onMounted(() => { hydrated.value = true })
await practice.load()
if(practice.state.setup?.subscriptionRequired)await navigateTo('/subscription')
const initial = doctorSetupForm(practice.state.setup || { enrollment: 'owner', profile: null, practice: null, location: null, draft: null })
const form = ref({ name: initial.displayName, workspaceName: initial.practiceName, locationName: initial.locationName, timezone: initial.timezone, phone: '', jobTitle: '', email: '', password: '', legalName: '', businessType: '', country: '', currency: '', fiscalMonth: 1, taxIdentifier: '', locationCode: '', locationAddress: '', locationPhone: '', businessMode: '' })
useDoctorOnboardingDraft(auth.state, practice, form)
onMounted(async () => {
  let storage: Storage | null = null
  try { storage = window.sessionStorage } catch { /* Use the request/app-scoped fallback. */ }
  const fallback = registrationHandoff.value
  const draft = readDoctorRegistrationDraft(storage, environment) || (fallback && fallback.createdAt <= Date.now() && Date.now() - fallback.createdAt < 86400000 ? fallback : null)
  const snapshot = JSON.stringify(form.value), actor = auth.state.identity
  const capturedSetup = practice.state.setup
  let verified
  try { verified = await auth.registrationIdentity() } catch { return } // Preserve a resumable draft during verification failure.
  if (disposed || auth.state.identity !== actor || practice.state.setup !== capturedSetup || JSON.stringify(form.value) !== snapshot) return
  if (!verified) return
  if (!form.value.name) form.value.name = verified.name
  if (!form.value.timezone) form.value.timezone = doctorSuggestedTimezone()
  if (!draft) return
  const bound = verified ? bindDoctorRegistrationDraft(draft, verified) : null
  if (!bound) { registrationHandoff.value = null; saveDoctorRegistrationDraft(storage, environment, null); return }
  const setup = practice.state.setup
  if (auth.state.identity?.userId !== bound.userId || setup?.subscriptionRequired || setup?.enrollment !== 'owner' || setup.practice || setup.draft) return
  saveDoctorRegistrationDraft(storage, environment, bound)
  registrationHandoff.value = bound
  Object.assign(form.value, { name: bound.displayName, workspaceName: bound.practiceName, locationName: bound.locationName, timezone: bound.timezone })
  if (bound.displayName.trim()) step.value = 2
})
let disposed = false
onBeforeUnmount(() => { disposed = true })
watch(() => practice.state.setup?.subscriptionRequired, required => { if (required) void navigateTo('/subscription') })
const step = ref(1)
const validation = ref(false)
const otp = ref('')
const consent = ref(false)
const editing = computed(() => Boolean(practice.state.setup?.practice))
const availability = computed(() => authAvailability.value || (!hydrated.value || practice.state.phase === 'loading' || practice.state.setup?.subscriptionRequired ? { state: 'loading' as const, title: copy.value.loading, description: copy.value.description }
  : practice.state.phase === 'denied' ? { state: 'permission' as const, title: copy.value.denied, description: copy.value.deniedDescription }
    : !practice.state.setup ? { state: 'error' as const, title: copy.value.loading, description: error.value || copy.value.missing } : undefined))
const features = computed(() => ({ accountEmail: false, profileName: editing.value, profileNameMaxLength: 120, standaloneTimezone: !editing.value, locationContactFields: false, phone: false, jobTitle: false, organizationDetails: false, mainLocation: !editing.value, businessMode: false, passwordMinLength: 12, workspaceMinLength: 1, workspaceMaxLength: 160, locationMinLength: 1, locationMaxLength: 160, locationCodeMaxLength: null, locationAddressMaxLength: null, locationPhoneMaxLength: null }))
const view = computed(() => ({ stage: editing.value || step.value === 2 ? 'workspace' as const : 'account' as const, step: editing.value ? 1 : step.value, pending: practice.state.pending, error: validation.value ? copy.value.errors.invalid : error.value || '', notice: practice.state.saved ? copy.value.saved : '', existingAccount: true, showVerifiedIdentity: false, nameLocked: false, hydrated: hydrated.value, submitDisabled: practice.state.pending, submitLabel: editing.value ? copy.value.save : step.value === 1 ? copy.value.continue : copy.value.complete, pendingLabel: copy.value.pending, expired: false, resendDisabled: true, verified: true, canStartOver: false }))
const signupCopy = computed(() => ({ eyebrow: '', title: editing.value ? copy.value.edit : copy.value.setup, description: copy.value.description, name: copy.value.name, phone: '', jobTitle: '', email: '', password: '', passwordHint: '', workspaceName: copy.value.practice, legalName: '', businessType: '', country: '', currency: '', timezone: copy.value.timezone, fiscalMonth: '', taxIdentifier: '', optional: '', mainLocation: copy.value.location, locationName: copy.value.locationName, locationCode: '', locationAddress: '', locationPhone: '', businessMode: '', businessModeHelp: '', trialTitle: '', trialBody: '', back: copy.value.previous, formFooter: copy.value.boundaries, signIn: copy.value.back, recoveryTitle: '', recoveryBody: '', recover: '', startOver: '', steps: editing.value ? [] : [{ id: 'doctor', title: copy.value.doctorStep, body: '' }, { id: 'practice', title: copy.value.practiceStep, body: '' }] }))
function values() { return { displayName: form.value.name, practiceName: form.value.workspaceName, locationName: form.value.locationName, timezone: form.value.timezone } }
function back() { if (!practice.state.pending) { step.value = 1; validation.value = false } }
async function submit() {
  validation.value = false
  if (!editing.value && step.value === 1) {
    if (!form.value.name.trim() || form.value.name.length > 120) { validation.value = true; return }
    step.value = 2; return
  }
  const succeeded = editing.value ? await practice.updateProfile(values()) : await practice.complete(values())
  if (succeeded) {
    registrationHandoff.value = null
    try { saveDoctorRegistrationDraft(window.sessionStorage, environment, null) } catch { /* Storage may be denied. */ }
    await auth.refresh(); await navigateTo('/workspace')
  }
}
async function saveDraft() { await practice.saveDraft(values()) }
usePageExitCleanup(() => { form.value.name = ''; form.value.workspaceName = ''; form.value.locationName = ''; form.value.timezone = '' })
</script>
<template>
  <BsSignupPage v-model:form="form" v-model:otp="otp" v-model:consent="consent" :product="{ ...product, framed: true, title: editing ? copy.edit : copy.setup, description: copy.boundaries }" :features="features" :view="view" :copy="signupCopy" :availability="availability" :draft-action="editing ? undefined : copy.draft" :verification-copy="{ title: '', description: '', codeLabel: '', expiryLabel: '', expiredLabel: '', submitLabel: '', pendingLabel: '', resendLabel: '' }" :choices="{ timezones: doctorTimezoneChoices(), businessTypes: [], countries: [], currencies: [], fiscalMonths: [], businessModes: [] }" :links="{ signInTo: '/account', recoveryTo: '/account', formSignInLabel: copy.back, verificationFooter: false, legal: [] }" :legal-consent="null" @back="back" @save-draft="saveDraft" @submit="submit" />
</template>
