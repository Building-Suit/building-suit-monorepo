<script setup lang="ts">
import { doctorReturnPath } from '../utils/authConfiguration'
import { createEmailStepController, emailStepState, emailStepDelay, normalizedAuthEmail } from '@building-suit/ux'
definePageMeta({ layout: false })
const route = useRoute()
const { auth, copy, product, availability, error } = useDoctorAuthPresentation()
const email = ref('')
const password = ref('')
const hydrated = ref(false)
let disposed = false
const emailState = reactive(emailStepState())
const emailStep = createEmailStepController(emailState, () => email.value, async (address, signal) => {
  const result = await $fetch<{ canContinue: boolean }>('/api/auth/email-step', { method: 'POST', body: { email: address, intent: 'sign-in' }, signal })
  return result.canContinue
}, emailStepDelay)
const emailError = computed(() => emailState.error === 'invalid' ? copy.value.invalidEmail : emailState.error === 'rejected' ? copy.value.unknownEmail : emailState.error ? copy.value.errors[emailState.error] : null)
watch(email, () => emailStep.reset())
onMounted(() => { hydrated.value = true })
async function submit() {
  if (auth.state.pending || !emailState.approved || emailState.email !== normalizedAuthEmail(email.value)) return
  const secret = password.value
  password.value = ''
  if (await auth.signIn(email.value.trim(), secret) && !disposed) await navigateTo(doctorReturnPath(route.query.next))
}
onBeforeUnmount(() => { disposed = true; emailStep.reset(); password.value = ''; email.value = '' })
</script>
<template>
  <BsSignInPage v-model:email="email" v-model:password="password" :product="product" :copy="{ ...copy, title: copy.signIn, description: copy.description, submit: copy.signIn, signup: copy.signUp }" :availability="availability" :session-action="auth.state.error === 'sign-out' ? { label: copy.signOut, pending: auth.state.pending } : undefined" :pending="auth.state.pending" :hydrated="hydrated" :error="error" email-step-required :email-step-pending="emailState.pending" :email-step-approved="emailState.approved" :email-step-error="emailError" signup-to="/sign-up" :forgot="{ to: '/recover', label: copy.forgot }" @validate-email="emailStep.check()" @edit-email="emailStep.reset()" @submit="submit" @end-session="auth.signOut()" />
</template>
