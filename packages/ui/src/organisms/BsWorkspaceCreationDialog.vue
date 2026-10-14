<script setup lang="ts">
import type { BsWorkspaceCreationForm, BsWorkspaceCreationView } from '../types/workspaceCreationPresentation'
defineProps<{ view: BsWorkspaceCreationView }>()
const form = defineModel<BsWorkspaceCreationForm>('form', { required: true })
defineEmits<{ close: []; submit: [] }>()
function field(key: keyof BsWorkspaceCreationForm, value: string | number | null | undefined) { form.value = { ...form.value, [key]: String(value ?? '') } }
</script>
<template>
  <BsRecordActionDialog :visible="view.visible" :title="view.copy.title" size="md" :dirty="view.dirty" :pending="view.pending" :error="view.error" :cancel-label="view.copy.cancel" :submit-label="view.copy.create" @update:visible="value => { if (!value) $emit('close') }" @submit="$emit('submit')"><BsText tone="link" emphasis="semibold">{{ view.copy.eyebrow }}</BsText><BsText tone="muted">{{ view.copy.hint }}</BsText><BsField v-slot="control" :label="view.copy.name" required><BsInput :id="control.id" :model-value="form.name" required @update:model-value="field('name', $event)"/></BsField><BsField v-slot="control" :label="view.copy.legalName" required><BsInput :id="control.id" :model-value="form.legalName" required @update:model-value="field('legalName', $event)"/></BsField><BsField :label="view.copy.currency"><BsSelect :model-value="form.currency" :label="view.copy.currency" :options="view.currencies" @update:model-value="field('currency', $event)"/></BsField><BsAlert tone="info" :title="view.copy.separateTitle" :description="view.copy.separateBody"/></BsRecordActionDialog>
</template>
