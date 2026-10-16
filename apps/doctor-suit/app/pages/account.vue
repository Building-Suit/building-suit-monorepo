<script setup lang="ts">
definePageMeta({ layout: false, middleware: 'doctor-auth' })
const { auth, copy, product, error } = useDoctorAuthPresentation()
const hydrated = ref(false)
onMounted(() => { hydrated.value = true })
const availability = computed(() => auth.state.phase !== 'authenticated' || !auth.state.identity ? { state: 'loading' as const, title: copy.value.checking, description: copy.value.checkingDescription } : undefined)
async function signOut() { await auth.signOut(); await navigateTo('/sign-in') }
watch(() => auth.state.phase, phase => { if (phase === 'signed-out' || phase === 'unavailable') void navigateTo('/sign-in') })
</script>
<template>
  <BsAccountSessionPage :availability="availability" :product="product" :title="copy.account" :description="copy.accountDescription" :status="copy.status" :status-description="copy.statusDescription" :sign-out="copy.signOut" :pending="auth.state.pending || !hydrated" :error="error" @sign-out="signOut" />
</template>
