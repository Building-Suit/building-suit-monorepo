<script setup lang="ts">
const email = defineModel<string>('email', { required: true })
const password = defineModel<string>('password', { required: true })
defineProps<{
  state: 'success' | 'signed-out' | 'loading' | 'denied' | 'error'
  pending: boolean
  actionError: boolean
  productName: string
  copy: { welcome: string; description: string; authDescription: string; authorized: string; empty: string; signOut: string; actionError: string; signIn: string; signInError: string; pending: string; email: string; password: string; stateTitle: string; deniedDescription: string; retry: string }
}>()
const emit = defineEmits<{ signIn: []; signOut: []; retry: [] }>()
</script>
<template>
  <NuxtLayout v-if="state === 'success'" name="default">
    <BsContentSection :title="copy.welcome" :description="copy.description" padding="lg"><BsStateSurface state="success" :title="copy.authorized" /><BsStateSurface state="empty" :title="copy.empty" /><BsButton :pending="pending" @click="emit('signOut')">{{ copy.signOut }}</BsButton><BsStateSurface v-if="actionError" state="error" :title="copy.actionError" /></BsContentSection>
  </NuxtLayout>
  <BsSignInPage v-else-if="state === 'signed-out'" v-model:email="email" v-model:password="password" :product="{ name: productName, homeLabel: productName, title: productName, description: copy.authDescription }" :copy="{ title: copy.signIn, description: copy.authDescription, email: copy.email, password: copy.password, submit: copy.signIn, pending: copy.pending }" email-autocomplete="username" :pending="pending" :error="actionError ? copy.signInError : null" @submit="emit('signIn')" />
  <BsAuthLayout v-else :product-name="productName" :home-label="productName" :title="productName" :description="copy.authDescription">
    <template #logo="{ tone }"><BsProductLogo :name="productName" :tone="tone" /></template>
    <BsStack gap="lg"><BsStateSurface :state="state" :title="copy.stateTitle" :description="state === 'denied' ? copy.deniedDescription : undefined" :action-label="state === 'loading' ? undefined : copy.retry" @action="emit('retry')" /><BsButton v-if="state !== 'loading'" :pending="pending" @click="emit('signOut')">{{ copy.signOut }}</BsButton><BsStateSurface v-if="actionError" state="error" :title="copy.actionError" /></BsStack>
  </BsAuthLayout>
</template>
