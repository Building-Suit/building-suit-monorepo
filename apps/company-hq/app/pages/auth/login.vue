<script setup lang="ts">
definePageMeta({ layout: false })
const { t, locale } = useI18n()
const password = ref(''), pending = ref(false), error = ref<string | null>(null)
useHead({ title: 'Sign in · Building Suit HQ', htmlAttrs: { dir: () => locale.value === 'ar' ? 'rtl' : 'ltr' } })
async function submit() {
  pending.value = true; error.value = null
  try { await $fetch('/api/hq/auth/login', { method: 'POST', body: { password: password.value } }); password.value = ''; await navigateTo('/') }
  catch { error.value = t('hq.denied') }
  finally { pending.value = false }
}
</script>
<template><BsWorkspaceAccessPage v-model:password="password" :title="t('hq.loginTitle')" :description="t('hq.loginDescription')" logo-src="/brand/building-suit-logo-light.png" logo-alt="Building Suit" :password-label="t('hq.password')" :submit-label="t('hq.signIn')" :pending="pending" :error="error" @submit="submit" /></template>
