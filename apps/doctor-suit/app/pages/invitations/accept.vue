<script setup lang="ts">
import { doctorDelegationCopy, doctorDelegationError } from '../../utils/delegationPresentation'
import { doctorInvitationCredential } from '../../utils/delegation'
definePageMeta({ layout: false, middleware: 'doctor-auth' })
const route = useRoute()
if (Object.keys(route.query).length || route.hash) await navigateTo('/invitations/accept', { replace: true })
const { auth, product } = useDoctorAuthPresentation(false)
const context = useDoctorContext(); const invitation = useDoctorInvitation()
const { locale } = useI18n(); const ar = computed(() => locale.value==='ar'); const words = computed(() => doctorDelegationCopy(ar.value))
const code = ref(''); const hydrated = ref(false)
const form = ref({ email: '', password: '', confirmation: '', name: '', phone: '', jobTitle: '' })
onMounted(() => { hydrated.value = true })
const reset = () => { code.value = ''; form.value = { email: '', password: '', confirmation: '', name: '', phone: '', jobTitle: '' }; invitation.clear() }
const unregister = context.registerClear(reset)
onBeforeUnmount(() => { unregister(); reset() })
watch(code, value => { if (!invitation.state.accepted) invitation.changed(value) })
const complete = computed(() => invitation.state.accepted || invitation.state.details?.status==='accepted')
const copy = computed(() => {
  const value = words.value; const details = invitation.state.details
  const description = details ? `${details.doctorName} · ${details.practiceName} · ${details.grants.map(item => `${item.locationName} (${item.timezone}): ${item.capabilities.map(key => value.capabilityLabels[key]).join(', ')}`).join(' · ')}` : value.initialDescription
  return { title: value.acceptTitle,description,submit: complete.value ? value.continue : details ? value.accept : value.review,pending: value.working,invalid: value.errors.denied,backToLogin: value.account,email: value.email,password: '',switchAccount: value.switchAccount,security: invitation.state.accepted ? value.acceptedNotice : details?.status==='accepted' ? value.alreadyAccepted : value.initialDescription,login: value.account,verification: { title: '', description: '', code: '', submit: '', pending: '', resend: '', expired: '' } }
})
async function submit() {
  if (!hydrated.value) return
  if (complete.value) { await context.refresh(); await navigateTo('/workspace'); return }
  if (!invitation.state.details) { await invitation.review(code.value); return }
  if (await invitation.accept(code.value)) code.value = ''
}
async function switchAccount() { reset(); await auth.signOut(); await navigateTo('/sign-in?returnTo=%2Finvitations%2Faccept') }
watch(() => auth.state.phase, phase => { if (phase==='signed-out' || phase==='unavailable') { reset(); void navigateTo('/sign-in') } })
</script>
<template>
  <BsInvitationAcceptancePage v-model:form="form" v-model:code="code" :product="product" stage="accept" :copy="copy" :email="words.verifiedAccount" :pending="invitation.state.pending || invitation.state.loading || !hydrated" :error="doctorDelegationError(invitation.state.error, ar) || ''" :submit-disabled="!hydrated || (!complete && !doctorInvitationCredential(code))" :acceptance-code="complete ? undefined : { label: words.codeLabel, hint: words.codeHint, maxLength: 101 }" login-to="/account" :verification="{ resendDisabled: true }" @submit="submit" @switch-account="switchAccount" />
</template>
