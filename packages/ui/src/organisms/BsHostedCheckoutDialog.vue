<script setup lang="ts">
import type { BsBillingCopy, BsBillingView } from '../types/billingPresentation'
const visible = defineModel<boolean>('visible', { default: false })
defineProps<{ checkout: NonNullable<BsBillingView['checkout']>; copy: BsBillingCopy }>()
defineEmits<{ submit: []; refresh: []; restart: [] }>()
</script>
<template>
  <BsRecordActionDialog v-model:visible="visible" :title="checkout.title" :pending="checkout.pending" :error="checkout.error" :submit-label="checkout.action" :cancel-label="copy.cancel" :submit-disabled="checkout.disabled" :submit-visible="checkout.actionVisible !== false" pinned-actions @submit="$emit('submit')">
    <BsStack data-testid="hosted-checkout">
      <span v-if="checkout.showProviderLogo !== false" role="img" :aria-label="checkout.logoAlt" class="bs-hosted-checkout-logo"><BsImage class="bs-hosted-checkout-logo__light" :src="checkout.logoLight" alt="" :width="147" :height="24" fit="contain"/><BsImage class="bs-hosted-checkout-logo__dark" :src="checkout.logoDark" alt="" :width="147" :height="24" fit="contain"/></span>
      <BsText>{{ checkout.description }}</BsText>
      <BsText v-if="checkout.quote" emphasis="semibold">{{ checkout.quote }}</BsText>
      <BsStack v-if="checkout.breakdown" data-testid="proration-breakdown">
        <BsHeading :level="3">{{ checkout.breakdown.title }}</BsHeading>
        <BsDescriptionList density="compact" divided><BsDescriptionItem v-for="item in checkout.breakdown.items" :key="item.label" :term="item.label" orientation="inline"><BsText>{{ item.value }}</BsText></BsDescriptionItem></BsDescriptionList>
        <BsText role="note">{{ checkout.breakdown.policy }}</BsText><BsText role="status">{{ checkout.breakdown.expiry }}</BsText>
      </BsStack>
      <BsText v-if="checkout.notice" role="note">{{ checkout.notice }}</BsText>
      <BsList v-if="checkout.consequences?.length"><BsListItem v-for="item in checkout.consequences" :key="item">{{ item }}</BsListItem></BsList>
      <BsPlanStatus v-if="checkout.restrictions" :notice="checkout.restrictions"/>
      <BsText v-if="checkout.disabled && checkout.unavailable" role="status" tone="muted">{{ checkout.unavailable }}</BsText>
      <BsText v-if="checkout.statusMessage" data-testid="checkout-state" role="status">{{ checkout.statusMessage }}</BsText>
      <BsLink v-if="checkout.error && checkout.helpTo && checkout.helpLabel" :to="checkout.helpTo">{{ checkout.helpLabel }}</BsLink>
      <BsButton v-if="checkout.restartLabel" variant="text" :disabled="checkout.restartDisabled" @click="$emit('restart')">{{ checkout.restartLabel }}</BsButton>
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
