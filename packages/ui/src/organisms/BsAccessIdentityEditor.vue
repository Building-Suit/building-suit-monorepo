<script setup lang="ts">
import type { BsAccessEditorState, BsAccessIdentityForm, BsAccessIdentityCopy } from '../types/accessPresentation'
import type { BsUsageItem } from '@building-suit/contracts'
const form = defineModel<BsAccessIdentityForm>({ required: true })
defineProps<{
  state: BsAccessEditorState
  copy: BsAccessIdentityCopy
  roles: { value: string; label: string; description?: string; disabled?: boolean }[]
  locations?: { id: string; name: string }[]
  roleDisabled?: boolean
  emailReadonly?: boolean
  link?: string
  usage?: BsUsageItem
}>()
const emit = defineEmits<{ close: []; submit: [] }>()
</script>
<template>
  <BsRecordActionDialog v-if="state.visible" :visible="true" :title="state.title" :dirty="state.dirty" :pending="state.pending" :error="state.error" :submit-label="state.submitLabel" :cancel-label="state.cancelLabel" :submit-disabled="Boolean(link)" @update:visible="value => { if (!value) emit('close') }" @submit="emit('submit')">
    <BsText v-if="copy.help" size="sm" tone="muted">{{ copy.help }}</BsText>
    <BsUsageMeter v-if="usage" compact :item="usage" />
    <BsField v-if="copy.name" v-slot="field" :label="copy.name"><BsInput :id="field.id" :model-value="form.name" @update:model-value="form = { ...form, name: String($event ?? '') }" :disabled="Boolean(link)" :aria-describedby="field.describedby" minlength="2" maxlength="160" required /></BsField>
    <BsField v-if="copy.jobTitle" v-slot="field" :label="copy.jobTitle"><BsInput :id="field.id" :model-value="form.jobTitle" @update:model-value="form = { ...form, jobTitle: String($event ?? '') }" :disabled="Boolean(link)" maxlength="160" /></BsField>
    <BsField v-slot="field" :label="copy.email"><BsInput :id="field.id" :model-value="form.email" @update:model-value="form = { ...form, email: String($event ?? '') }" type="email" dir="ltr" autocomplete="email" :readonly="emailReadonly" :disabled="Boolean(link)" :required="!emailReadonly" maxlength="254" /></BsField>
    <BsField v-slot="field" :label="copy.role"><BsSelect :model-value="form.role" @update:model-value="form = { ...form, role: String($event ?? '') }" :input-id="field.id" :aria-describedby="field.describedby" :label="copy.role" :options="roles" option-value="value" option-label="label" option-disabled="disabled" :disabled="roleDisabled || Boolean(link)" /></BsField>
    <BsFieldGroup v-if="locations && copy.locations" :legend="copy.locations"><BsCheckbox v-for="location in locations" :key="location.id" :model-value="form.locationIds" @update:model-value="form = { ...form, locationIds: $event as string[] }" :value="location.id" :label="location.name" :disabled="Boolean(link)" /></BsFieldGroup>
    <BsAlert v-if="copy.deliveryTitle" tone="info"><BsText emphasis="bold">{{ copy.deliveryTitle }}</BsText><BsText size="xs">{{ copy.deliveryHint }}</BsText></BsAlert>
    <BsText v-if="link" role="status"><BsText as="strong">{{ copy.ready }}</BsText><BsInput :model-value="link" readonly @focus="($event.target as HTMLInputElement).select()" /></BsText>
  </BsRecordActionDialog>
</template>
