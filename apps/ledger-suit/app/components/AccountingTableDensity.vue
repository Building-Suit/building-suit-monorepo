<script setup lang="ts">
import type { AccountingTableDensity } from '~/utils/accountingTablePreferences'

defineProps<{ modelValue: AccountingTableDensity, disabled?: boolean }>()
const emit = defineEmits<{ 'update:modelValue': [value: AccountingTableDensity] }>()
const { t } = useI18n()
</script>

<template>
  <BsTableDensity
    :model-value="modelValue"
    :label="t('accountingTable.density')"
    :compact-label="t('accountingTable.compact')"
    :comfortable-label="t('accountingTable.comfortable')"
    :disabled="disabled"
    @update:model-value="emit('update:modelValue', $event)"
  />
</template>
