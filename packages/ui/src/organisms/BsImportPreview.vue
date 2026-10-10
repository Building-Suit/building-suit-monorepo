<script setup lang="ts">
import type { BsDataTableColumn } from '@building-suit/ux'
defineProps<{ rows: Record<string, unknown>[]; columns: BsDataTableColumn<Record<string, unknown>>[]; label: string; loading?: boolean; error?: string | null }>()
const emit = defineEmits<{ retry: [] }>()
</script>

<template>
  <BsDataTable :value="rows" :columns="columns" :label="label" :loading="loading" :error="error" density="compact" @retry="emit('retry')" />
</template>
