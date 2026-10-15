<script setup lang="ts">
import type { BsShopTaxRuleForm, BsShopTaxCopy } from '../types/shopTaxPresentation'
const props = defineProps<{ copy: BsShopTaxCopy }>()
const rule = defineModel<BsShopTaxRuleForm>({ required: true })
const treatments = computed(() => (['vat','zero_rated','exempt','non_taxable'] as const).map(value => ({ value, label: props.copy[value] })))
const modes = computed(() => (['inclusive','exclusive'] as const).map(value => ({ value, label: props.copy[value] })))
</script>
<template>
 <BsStack>
  <BsSelect v-model="rule.treatment" :label="copy.treatment" :options="treatments" option-label="label" option-value="value" />
  <BsSelect v-model="rule.priceMode" :label="copy.priceMode" :options="modes" option-label="label" option-value="value" />
  <BsField :label="copy.rate"><BsInput v-model="rule.rate" type="number" min="0" max="100" step="0.00001" required :aria-label="copy.rate" /></BsField>
  <BsField :label="copy.subtype"><BsInput v-model="rule.subtype" required pattern="V00[1-9]|V010" :aria-label="copy.subtype" /></BsField>
 </BsStack>
</template>
