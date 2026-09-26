<script setup lang="ts">
import type { AccountingTableDensity } from '~/utils/accountingTablePreferences'

defineProps<{ modelValue: AccountingTableDensity, disabled?: boolean }>()
const emit = defineEmits<{ 'update:modelValue': [value: AccountingTableDensity] }>()
const { t } = useI18n()
</script>

<template>
  <div class="flex flex-wrap items-center gap-2" role="group" :aria-label="t('accountingTable.density')">
    <span class="text-xs font-semibold text-fg-muted">{{ t('accountingTable.density') }}</span>
    <button
      v-for="value in (['compact', 'comfortable'] as const)"
      :key="value"
      type="button"
      class="ls-btn ls-btn-sm"
      :class="{ 'ls-btn-primary': modelValue === value }"
      :aria-pressed="modelValue === value"
      :disabled="disabled"
      @click="emit('update:modelValue', value)"
    >
      {{ t(`accountingTable.${value}`) }}
    </button>
  </div>
</template>
