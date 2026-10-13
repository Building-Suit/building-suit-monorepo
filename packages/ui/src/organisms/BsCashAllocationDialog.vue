<script setup lang="ts">
import type { BsCashAllocationCopy, BsCashAllocationForm, BsCashAllocationView } from '../types/accountActivityPresentation'
defineProps<{ copy: BsCashAllocationCopy; view: BsCashAllocationView }>()
const form = defineModel<BsCashAllocationForm>('form', { required: true })
const emit = defineEmits<{ close: []; save: [] }>()
</script>
<template>
 <BsRecordActionDialog :visible="view.visible" :title="copy.title" size="md" :dirty="view.dirty" :pending="view.pending" :error="view.error" :submit-label="copy.save" :cancel-label="copy.cancel" :submit-disabled="!view.valid || view.loading" @update:visible="value => { if (!value) emit('close') }" @submit="emit('save')"><BsText>{{ view.name }}</BsText><BsSectionSkeleton v-if="view.loading" variant="table" :rows="3"/><template v-else-if="view.source"><BsText>{{ copy.source }}: {{ view.source }}</BsText><BsBox v-if="view.previous.length"><BsText>{{ copy.previous }}</BsText><BsText v-for="item in view.previous" :key="item.label">{{ item.label }}: {{ item.value }}</BsText></BsBox><BsStack gap="md"><BsFloatingField v-for="key in (['operating', 'investing', 'financing'] as const)" :key="key" :label="copy[key]"><BsInput :model-value="form[key]" inputmode="decimal" :disabled="view.pending" @update:model-value="form = { ...form, [key]: String($event ?? '') }"/></BsFloatingField><BsFloatingField :label="copy.reason"><BsTextarea :model-value="form.reason" required :maxlength="1000" :disabled="view.pending" @update:model-value="form = { ...form, reason: String($event ?? '') }"/></BsFloatingField><BsText v-if="view.mismatch" role="alert" tone="danger">{{ copy.mismatch }}</BsText></BsStack></template></BsRecordActionDialog>
</template>
