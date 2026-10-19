<script setup lang="ts">
import { doctorReturnPath } from '../utils/authConfiguration'
definePageMeta({ layout: false })
const route = useRoute()
const { auth, copy, product, availability, error } = useDoctorAuthPresentation()
const email = ref('')
const password = ref('')
const hydrated = ref(false)
onMounted(() => { hydrated.value = true })
async function submit() {
  const secret = password.value
  password.value = ''
  if (await auth.signIn(email.value.trim(), secret)) await navigateTo(doctorReturnPath(route.query.next))
}
onBeforeUnmount(() => { password.value = ''; email.value = '' })
</script>
<template>
  <BsSignInPage v-model:email="email" v-model:password="password" :product="product" :copy="{ ...copy, title: copy.signIn, description: copy.description, submit: copy.signIn, signup: copy.signUp }" :availability="availability" :session-action="auth.state.error === 'sign-out' ? { label: copy.signOut, pending: auth.state.pending } : undefined" :pending="auth.state.pending" :hydrated="hydrated" :error="error" signup-to="/sign-up" :forgot="{ to: '/recover', label: copy.forgot }" @submit="submit" @end-session="auth.signOut()" />
</template>
