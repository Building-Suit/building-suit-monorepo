<script setup lang="ts">
/**
 * Renders integer minor units through the exact decimal formatter.
 * Components do not convert financial values through floating-point arithmetic.
 */
const props = withDefaults(defineProps<{
  amountMinor: number | string | null | undefined
  /** Falls back to the organization base currency when absent. */
  currency?: string | null
  /** Colour positive green and negative red. Off by default: most figures are
   *  neutral, and colouring everything makes nothing stand out. */
  signed?: boolean
  /** Show a + in front of positive values. Only meaningful with `signed`. */
  explicitSign?: boolean
}>(), {
  currency: undefined,
  signed: false,
  explicitSign: false,
})

const { baseCurrency } = useTenant()
const { locale } = useI18n()

const value = computed(() => props.amountMinor ?? 0)
const code = computed(() => props.currency ?? baseCurrency.value)

const formatted = computed(() => {
  const text = formatMoney(value.value, code.value, locale.value)
  return props.explicitSign && BigInt(value.value) > 0n ? `+${text}` : text
})

const tone = computed(() => {
  if (!props.signed || BigInt(value.value) === 0n) return ''
  return BigInt(value.value) > 0n ? 'text-[var(--bs-status-success)]' : 'text-[var(--bs-status-error)]'
})
</script>

<template>
  <!-- Amounts stay left-to-right even in Arabic: a currency figure is a single
       LTR run, and letting it reorder would put the minus sign or currency
       symbol on the wrong end. -->
  <span class="tabular-nums" :class="tone" dir="ltr">{{ formatted }}</span>
</template>
