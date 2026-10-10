<script setup lang="ts">
import type { BsUsageItem } from '@building-suit/contracts'
import { usagePercentage } from '@building-suit/ux'
const props = defineProps<{ item: BsUsageItem; compact?: boolean }>()
const ratio = computed(() => usagePercentage(props.item.used, props.item.limit))
</script>

<template>
  <article class="bs-usage-meter" :data-compact="compact || undefined" :data-tone="item.tone || 'neutral'">
    <div class="bs-pattern-heading">
      <div>
        <h3>{{ item.label }}</h3>
        <p v-if="item.description">{{ item.description }}</p>
      </div>
      <BsStatusBadge v-if="item.status" :status="item.status" :tone="item.tone" />
    </div>
    <p class="bs-usage-meter__value" dir="auto">{{ item.valueLabel }}</p>
    <div v-if="ratio !== null" class="bs-usage-meter__track" role="progressbar" :aria-label="item.label" aria-valuemin="0" aria-valuemax="100" :aria-valuenow="ratio" :aria-valuetext="item.valueLabel">
      <span :style="{ width: `${ratio}%` }" />
    </div>
    <p v-if="item.nextAllowance">{{ item.nextAllowance }}</p>
    <BsLink v-if="item.action" :to="item.action.to">{{ item.action.label }}</BsLink>
  </article>
</template>
