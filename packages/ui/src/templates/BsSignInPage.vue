<script setup lang="ts">
const email = defineModel<string>('email', { required: true })
const password = defineModel<string>('password', { required: true })
defineProps<{
  availability?: { state: 'loading' | 'error' | 'permission'; title: string; description: string }
  product: { name: string; presentation?: 'default' | 'flat'; assetPrefix?: string; homeLabel: string; title: string; description: string }
  copy: { eyebrow?: string; title: string; description: string; email: string; password: string; submit: string; pending: string; accountPrompt?: string; signup?: string }
  signupTo?: string
  forgot?: { to: string; label: string }
  legal?: { to: string; label: string }[]
  emailAutocomplete?: 'email' | 'username'
  pending?: boolean
  error?: string | null
  hydrated?: boolean
  sessionAction?: { label: string; pending: boolean }
}>()
const emit = defineEmits<{ submit: []; endSession: [] }>()
</script>
<template>
  <BsAuthLayout :presentation="product.presentation" :product-name="product.name" :home-label="product.homeLabel" :title="product.title" :description="product.description">
    <template #logo="{ tone }"><BsProductLogo :name="product.name" :asset-prefix="product.assetPrefix" :tone="tone" size="auth" /></template>
    <BsStateSurface v-if="availability" :title-level="1" :state="availability.state" :title="availability.title" :description="availability.description" />
    <BsAuthForm v-else :eyebrow="copy.eyebrow" :title="copy.title" :description="copy.description" :pending="pending" :error="error" :submit-label="copy.submit" :pending-label="copy.pending" :data-hydrated="hydrated" :data-client-ready="hydrated ? 'true' : 'false'" @submit="emit('submit')">
      <BsField v-slot="field" :label="copy.email" required><BsInput :id="field.id" v-model="email" type="email" :autocomplete="emailAutocomplete ?? 'email'" required dir="ltr" /></BsField>
      <BsField v-slot="field" :label="copy.password" required><BsInput :id="field.id" v-model="password" type="password" autocomplete="current-password" required dir="ltr" /></BsField>
      <BsLink v-if="forgot" :to="forgot.to" variant="muted">{{ forgot.label }}</BsLink>
      <template v-if="signupTo" #footer>{{ copy.accountPrompt }} <BsLink :to="signupTo" variant="standalone">{{ copy.signup }}</BsLink></template>
    </BsAuthForm>
    <BsButton v-if="sessionAction" :pending="sessionAction.pending" :disabled="sessionAction.pending" @click="emit('endSession')">{{ sessionAction.label }}</BsButton>
    <BsInline v-if="legal" as="nav" justify="center"><BsLink v-for="link in legal" :key="link.to" :to="link.to" variant="muted">{{ link.label }}</BsLink></BsInline>
  </BsAuthLayout>
</template>
