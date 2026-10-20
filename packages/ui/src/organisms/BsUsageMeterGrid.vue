<script setup lang="ts">
import type { BsUsageItem } from '@building-suit/contracts'
withDefaults(defineProps<{ items: BsUsageItem[]; columns?: 2 | 3 | 4; compact?: boolean }>(), { columns: 3 })
</script>

<template>
  <BsMetricGrid :columns="columns" variant="neutral">
    <BsUsageMeter v-for="item in items" :key="item.id" :item="item" :compact="compact" />
  </BsMetricGrid>
</template>
