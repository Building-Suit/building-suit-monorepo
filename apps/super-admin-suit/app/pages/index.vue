<script setup lang="ts">
definePageMeta({ layout: false })
const { t } = useI18n()
const { ready, state, pending, actionError, recheck, signIn, signOut } = useAdminSession()
await ready
const { registry, selection, state: registryState, label } = useAdminRegistry()
if (state.value === 'success') await registry.refresh()
watch(state, (value) => {
  registry.clear()
  if (value === 'success') void registry.refresh()
})
onMounted(() => {
  // Periodically re-resolve configuration and manifest expiry without a rebuild.
  const timer = setInterval(() => {
    if (state.value === 'success' && document.visibilityState === 'visible') void registry.refresh()
  }, 30_000)
  onScopeDispose(() => { clearInterval(timer); registry.clear() })
})
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
  <NuxtLayout v-if="state === 'success'" name="default">
    <BsContentSection :title="t('welcome')" :description="t('description')" padding="lg">
      <BsStateSurface state="success" :title="t('auth.authorized')" />
      <BsStateSurface v-if="registryState !== 'success'" :state="registryState" :title="t(`registry.${registryState}`)" :action-label="registryState === 'loading' ? undefined : t('registry.retry')" @action="registry.refresh()" />
      <BsContentSection v-else :title="selection.item ? label(selection.item.label) : label(selection.suit!.label)" :description="label(selection.item?.description || selection.suit!.description)">
        <BsStateSurface v-if="selection.item?.module === 'capabilities'" state="empty" data-registry-pending :title="t('registry.pending')" />
      </BsContentSection>
      <BsButton :pending="pending" @click="signOut">{{ t('auth.signOut') }}</BsButton>
      <BsStateSurface v-if="actionError" state="error" :title="t('auth.actionError')" />
    </BsContentSection>
  </NuxtLayout>
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
    <div v-else class="w-full space-y-5">
      <BsStateSurface :state="state" :title="t(`auth.${state}`)" :description="state === 'denied' ? t('auth.deniedDescription') : undefined" :action-label="state === 'loading' ? undefined : t('auth.retry')" @action="recheck" />
      <BsButton v-if="state !== 'loading'" :pending="pending" @click="signOut">{{ t('auth.signOut') }}</BsButton>
      <BsStateSurface v-if="actionError" state="error" :title="t('auth.actionError')" />
    </div>
  </BsAuthLayout>
</template>
