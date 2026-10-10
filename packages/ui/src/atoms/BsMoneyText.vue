<script setup lang="ts">
import { formatPresentationMoney } from '@building-suit/ux'
const props = withDefaults(defineProps<{ amount: number | bigint | string | null | undefined; currency: string; locale?: string; unit?: 'minor' | 'major'; signed?: boolean; explicitSign?: boolean; accounting?: boolean; numberingSystem?: string }>(), { locale: 'en', unit: 'minor', signed: false, explicitSign: false, accounting: false, numberingSystem: 'latn' })
const formatted = computed(() => formatPresentationMoney(props.amount ?? 0, { currency: props.currency, locale: props.locale, unit: props.unit, currencySign: props.accounting ? 'accounting' : 'standard', signDisplay: props.explicitSign ? 'exceptZero' : 'auto', numberingSystem: props.numberingSystem }))
const tone = computed(() => !props.signed || /^-?0(?:\.0+)?$/.test(String(props.amount ?? 0)) ? 'neutral' : String(props.amount).startsWith('-') ? 'danger' : 'success')
</script>

<template>
  <span class="bs-money-text" :data-tone="tone" dir="ltr">{{ formatted }}</span>
</template>
