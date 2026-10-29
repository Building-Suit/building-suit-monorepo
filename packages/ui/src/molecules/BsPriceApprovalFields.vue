<script setup lang="ts">
import type { BsPriceApproval } from '../types/priceApprovalPresentation'
defineProps<{ approval: BsPriceApproval; recordId: string; disabled?: boolean }>()
const emit = defineEmits<{ price: [value: string]; reason: [value: string] }>()
</script>
<template>
 <BsStack gap="sm">
  <BsText v-if="approval.source" as="p" size="sm" tone="muted">{{ approval.source }}</BsText>
  <template v-if="approval.canOverride">
   <BsField v-slot="field" :for="`price-approval-${recordId}`" :label="approval.priceLabel" :hint="approval.help"><BsInput :id="field.id" :aria-describedby="field.describedby" :model-value="approval.value" inputmode="decimal" :disabled="disabled" @update:model-value="emit('price', String($event))" /></BsField>
   <BsField v-if="approval.value !== ''" v-slot="field" :for="`price-approval-reason-${recordId}`" :label="approval.reasonLabel"><BsInput :id="field.id" :model-value="approval.reason" :disabled="disabled" :minlength="3" :maxlength="1000" required @update:model-value="emit('reason', String($event))" /></BsField>
  </template>
 </BsStack>
</template>
