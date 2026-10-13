<script setup lang="ts">
import type { BsBillingCopy, BsBillingView } from '../types/billingPresentation'
const visible = defineModel<boolean>('visible', { default: false })
defineProps<{ checkout: NonNullable<BsBillingView['checkout']>; copy: BsBillingCopy }>()
defineEmits<{ submit: []; refresh: [] }>()
</script>
<template>
  <BsRecordActionDialog v-model:visible="visible" :title="checkout.title" :pending="checkout.pending" :error="checkout.error" :submit-label="checkout.action" :cancel-label="copy.cancel" :submit-disabled="checkout.disabled" pinned-actions @submit="$emit('submit')">
    <BsStack data-testid="hosted-checkout">
      <span role="img" :aria-label="checkout.logoAlt" class="bs-hosted-checkout-logo"><BsImage class="bs-hosted-checkout-logo__light" :src="checkout.logoLight" alt="" :width="147" :height="24" fit="contain"/><BsImage class="bs-hosted-checkout-logo__dark" :src="checkout.logoDark" alt="" :width="147" :height="24" fit="contain"/></span>
      <BsText>{{ checkout.description }}</BsText>
      <BsText v-if="checkout.quote" emphasis="semibold">{{ checkout.quote }}</BsText>
      <BsText v-if="checkout.notice" role="note">{{ checkout.notice }}</BsText>
      <BsList v-if="checkout.consequences?.length"><BsListItem v-for="item in checkout.consequences" :key="item">{{ item }}</BsListItem></BsList>
      <BsPlanStatus v-if="checkout.restrictions" :notice="checkout.restrictions"/>
      <BsText v-if="checkout.disabled && checkout.unavailable" role="status" tone="muted">{{ checkout.unavailable }}</BsText>
      <BsText v-if="checkout.statusMessage" data-testid="checkout-state" role="status">{{ checkout.statusMessage }}</BsText>
      <BsButton v-if="checkout.refreshLabel" variant="text" :disabled="checkout.refreshDisabled" @click="$emit('refresh')">{{ checkout.refreshLabel }}</BsButton>
      <BsText size="sm" tone="muted">{{ copy.policyPrefix }} <BsLink to="/terms">{{ copy.terms }}</BsLink> · <BsLink to="/privacy">{{ copy.privacy }}</BsLink> · <BsLink to="/refund-cancellation">{{ copy.refund }}</BsLink>.</BsText>
    </BsStack>
  </BsRecordActionDialog>
</template>
<style scoped>
.bs-hosted-checkout-logo { display: inline-flex; }
.bs-hosted-checkout-logo__dark { display: none; }
:global(.dark .bs-hosted-checkout-logo__light) { display: none; }
:global(.dark .bs-hosted-checkout-logo__dark) { display: block; }
</style>
