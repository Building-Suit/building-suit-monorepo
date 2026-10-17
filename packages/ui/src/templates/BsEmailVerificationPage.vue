<script setup lang="ts">
const code = defineModel<string>({ required: true })
defineProps<{
  availability?: { state: 'loading' | 'error' | 'permission'; title: string; description: string }
  product: { name: string; assetPrefix?: string; homeLabel: string }
  email: string
  copy: { eyebrow: string; title: string; description: string; code: string; expiry: string; expired: string; attempts: string; submit: string; pending: string; resendPrompt: string; resend: string; securityTitle: string; securityBody: string }
  pending?: boolean
  error?: string | null
  expired?: boolean
  verified?: boolean
  resendDisabled?: boolean
}>()
const emit = defineEmits<{ submit: []; resend: [] }>()
</script>
<template>
  <BsAuthLayout presentation="glass" :product-name="product.name" :home-label="product.homeLabel" :title="copy.title" :description="copy.description">
    <template #logo="{ tone }"><BsProductLogo :name="product.name" :asset-prefix="product.assetPrefix" kind="mark" :tone="tone" size="auth" /></template>
    <BsStateSurface v-if="availability" :title-level="1" :state="availability.state" :title="availability.title" :description="availability.description" />
    <BsVerificationForm v-else v-model="code" :eyebrow="copy.eyebrow" :title="copy.title" :description="copy.description" :email="email" :code-label="copy.code" :pending="pending" :error="error" :expired="expired" :verified="verified" :expiry-label="copy.expiry" :expired-label="copy.expired" :attempts-label="copy.attempts" :submit-label="copy.submit" :pending-label="copy.pending" :resend-prompt="copy.resendPrompt" :resend-label="copy.resend" :resend-disabled="resendDisabled" :security-title="copy.securityTitle" :security-body="copy.securityBody" @submit="emit('submit')" @resend="emit('resend')" />
  </BsAuthLayout>
</template>
