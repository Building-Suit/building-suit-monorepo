<script setup lang="ts">
import type { BsDocumentTotal } from '@building-suit/contracts'
defineProps<{ totals: BsDocumentTotal[]; label: string }>()
</script>

<template>
  <dl class="bs-document-totals" :aria-label="label">
    <div v-for="total in totals" :key="total.id" :data-emphasis="total.emphasis || undefined">
      <dt>{{ total.label }}</dt>
      <dd dir="auto">{{ total.value }}</dd>
    </div>
  </dl>
</template>
