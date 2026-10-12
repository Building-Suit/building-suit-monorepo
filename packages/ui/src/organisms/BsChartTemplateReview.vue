<script setup lang="ts">
import type { BsChartTemplateView } from '../types/financialAccountsPresentation'
defineProps<{ view: BsChartTemplateView; codeLabel: string; accountLabel: string; roleLabel: string }>()
const selected = defineModel<string>({ required: true })
const emit = defineEmits<{ close: [] }>()
</script>
<template>
 <BsCard v-if="view.visible" aria-labelledby="chart-template-heading" data-chart-template-review padding="md"><BsStack gap="md"><BsInline wrap align="start" justify="between"><BsBox><BsHeading id="chart-template-heading" :level="2" size="h2">{{ view.title }}</BsHeading><BsText size="sm" tone="muted">{{ view.hint }}</BsText></BsBox><BsButton size="sm" @click="emit('close')">{{ view.close }}</BsButton></BsInline><BsBox role="note" padding="lg" border radius="control"><BsText emphasis="semibold">{{ view.review }}</BsText><BsText>{{ view.noApply }}</BsText></BsBox><BsInline role="group" :aria-label="view.choose" wrap><BsButton v-for="choice in view.choices" :key="choice.value" variant="chip" :aria-pressed="selected === choice.value" @click="selected = choice.value">{{ choice.label }}</BsButton></BsInline><BsText size="sm" tone="muted">{{ view.description }}</BsText><BsDataTable :value="view.rows" data-key="id" :label="view.preview" :columns="[{ key: 'code', field: 'code', header: codeLabel }, { key: 'name', field: 'name', header: accountLabel }, { key: 'parent', field: 'parent', header: view.parent }, { key: 'role', field: 'role', header: roleLabel }, { key: 'line', field: 'line', header: view.presentation }]"/></BsStack></BsCard>
</template>
