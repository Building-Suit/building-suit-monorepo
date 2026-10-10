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
  <BsRouteLayout v-if="state === 'success'" name="default">
    <BsContentSection :title="t('welcome')" :description="t('description')" padding="lg">
      <BsStateSurface state="success" :title="t('auth.authorized')" />
      <BsStateSurface state="empty" :title="t('auth.empty')" />
      <BsButton :pending="pending" @click="signOut">{{ t('auth.signOut') }}</BsButton>
      <BsStateSurface v-if="actionError" state="error" :title="t('auth.actionError')" />
    </BsContentSection>
  </BsRouteLayout>
  <BsAuthLayout v-else :product-name="t('product.name')" :home-label="t('product.name')" :title="t('product.name')" :description="t('auth.description')">
    <template #logo="{ tone }"><BsProductLogo :name="t('product.name')" :tone="tone" /></template>
    <BsAuthForm v-if="state === 'signed-out'" :title="t('auth.signIn')" :description="t('auth.description')" :pending="pending" :error="actionError ? t('auth.signInError') : null" :submit-label="t('auth.signIn')" :pending-label="t('auth.pending')" @submit="submit">
      <BsField for="admin-email" :label="t('auth.email')" required>
        <BsInput id="admin-email" v-model="email" type="email" autocomplete="username" required />
      </BsField>
      <BsField for="admin-password" :label="t('auth.password')" required>
        <BsInput id="admin-password" v-model="password" type="password" autocomplete="current-password" required />
      </BsField>
    </BsAuthForm>
    <BsStack v-else gap="lg">
      <BsStateSurface :state="state" :title="t(`auth.${state}`)" :description="state === 'denied' ? t('auth.deniedDescription') : undefined" :action-label="state === 'loading' ? undefined : t('auth.retry')" @action="recheck" />
      <BsButton v-if="state !== 'loading'" :pending="pending" @click="signOut">{{ t('auth.signOut') }}</BsButton>
      <BsStateSurface v-if="actionError" state="error" :title="t('auth.actionError')" />
    </BsStack>
  </BsAuthLayout>
</template>
