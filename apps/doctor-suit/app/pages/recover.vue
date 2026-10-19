<script setup lang="ts">
import { doctorPkceCallback } from '../utils/authConfiguration'
definePageMeta({ layout: 'auth' })
const route = useRoute()
const { auth, copy, availability, error } = useDoctorAuthPresentation(false)
const email = ref('')
const password = ref('')
const confirmation = ref('')
const mode = ref<'request' | 'reset'>('request')
const valid = ref(false)
const complete = ref(false)
const validation = ref(false)
onMounted(async () => {
  const callback = doctorPkceCallback(route.query)
  const hasCallback = Object.keys(route.query).length > 0 || Boolean(route.hash)
  if (hasCallback) await navigateTo('/recover', { replace: true })
  if (hasCallback) {
    mode.value = 'reset'
    valid.value = Boolean(callback && await auth.exchange(callback.code, callback.flowId))
    if (!callback) await auth.refresh()
  } else if (auth.state.phase === 'checking') await auth.refresh()
})
async function submit() {
  validation.value = mode.value === 'reset' ? password.value.length < 12 || password.value !== confirmation.value : !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.value)
  if (validation.value) return
  if (mode.value === 'request') complete.value = await auth.recover(email.value.trim())
  else {
    const secret = password.value
    password.value = ''; confirmation.value = ''
    complete.value = valid.value && await auth.password(secret)
    if (!complete.value && !auth.state.identity) valid.value = false
  }
}
function retry() { mode.value = 'request'; valid.value = false; complete.value = false; validation.value = false }
onBeforeUnmount(() => { email.value = ''; password.value = ''; confirmation.value = '' })
</script>
<template>
  <BsPasswordRecoveryPage v-model:email="email" v-model:password="password" v-model:confirmation="confirmation" :mode="mode" :availability="availability" :copy="{ eyebrow: '', title: mode === 'request' ? copy.recovery : copy.reset, description: copy.recoveryDescription, submit: mode === 'request' ? copy.forgot : copy.reset, pending: copy.pending, success: mode === 'request' ? copy.sent : copy.changed, successDescription: mode === 'request' ? copy.sentDescription : copy.changedDescription, email: copy.email, password: copy.password, confirmation: copy.confirmation, reveal: copy.reveal, invalid: copy.invalidRecovery, invalidAction: copy.forgot, successAction: mode === 'request' ? copy.signIn : copy.continue, back: copy.signIn }" :pending="auth.state.pending" :complete="complete" :valid="valid" :error="validation ? copy.invalid : error" back-to="/sign-in" @submit="submit" @invalid-action="retry" @success-action="navigateTo(mode === 'request' ? '/sign-in' : '/account')" />
</template>
