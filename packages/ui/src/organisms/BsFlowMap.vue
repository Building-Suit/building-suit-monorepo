<script setup lang="ts">
import type { BsFlowStage, BsChartSeries } from '@building-suit/contracts'
defineProps<{ stages: BsFlowStage[]; label: string; legend?: BsChartSeries[] }>()
const emit = defineEmits<{ action: [id: string] }>()
</script>

<template>
  <section :aria-label="label">
    <BsChartLegend v-if="legend?.length" :series="legend" />
    <ol class="bs-flow-map">
      <li v-for="(stage, index) in stages" :key="stage.id">
        <div v-if="index > 0" class="bs-flow-map__connector">
          <BsIcon name="arrowDown" aria-hidden="true" />
          <BsText v-if="stage.connectorLabel" tone="muted">{{ stage.connectorLabel }}</BsText>
        </div>
        <BsSectionHeader :title="stage.title" :description="stage.description" />
        <ol class="bs-flow-map__nodes">
          <BsSetupStep v-for="node in stage.nodes" :key="node.id" :step="node" @action="emit('action', $event)" />
        </ol>
      </li>
    </ol>
  </section>
</template>
