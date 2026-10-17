<script setup lang="ts">
import { doctorHomePath,doctorPkceCallback } from '../utils/authConfiguration'
definePageMeta({ layout: false })
const route = useRoute()
const { auth, copy, product, availability, error } = useDoctorAuthPresentation(false)
const code = ref('')
const invalid = ref(false)
onMounted(async () => {
  const callback = doctorPkceCallback(route.query)
  await navigateTo('/verify', { replace: true })
  if (!callback || !await auth.exchange(callback.code, callback.flowId)) { await auth.refresh(); invalid.value = true }
  else await navigateTo(doctorHomePath, { replace: true })
})
const gate = computed(() => availability.value || (invalid.value ? { state: 'error' as const, title: copy.value.expired, description: error.value || copy.value.verifyDescription } : { state: 'loading' as const, title: copy.value.pending, description: copy.value.verifyDescription }))
</script>
<template>
  <BsEmailVerificationPage v-model="code" :product="product" email="" :availability="gate" :copy="{ eyebrow: '', title: copy.verify, description: copy.verifyDescription, code: copy.code, expiry: '', expired: copy.expired, attempts: '', submit: copy.verify, pending: copy.pending, resendPrompt: '', resend: copy.resend, securityTitle: '', securityBody: copy.description }" />
</template>
