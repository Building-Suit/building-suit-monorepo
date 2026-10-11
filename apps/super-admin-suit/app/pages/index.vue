<script setup lang="ts">
definePageMeta({ layout: false })
const { t } = useI18n()
const { ready, state, pending, actionError, recheck, signIn, signOut } = useAdminSession()
await ready
const email = ref('')
const password = ref('')
useHead({ title: () => t('product.name') })
async function submit() {
  const credential = password.value
  password.value = ''
  await signIn(email.value.trim(), credential)
}
</script>

<template>
  <BsAdministrationEntryPage
    v-model:email="email" v-model:password="password" :state="state" :pending="pending" :action-error="actionError" :product-name="t('product.name')"
    :copy="{ welcome: t('welcome'), description: t('description'), authDescription: t('auth.description'), authorized: t('auth.authorized'), empty: t('auth.empty'), signOut: t('auth.signOut'), actionError: t('auth.actionError'), signIn: t('auth.signIn'), signInError: t('auth.signInError'), pending: t('auth.pending'), email: t('auth.email'), password: t('auth.password'), stateTitle: t(`auth.${state}`), deniedDescription: t('auth.deniedDescription'), retry: t('auth.retry') }"
    @sign-in="submit" @sign-out="signOut" @retry="recheck"
  />
</template>
