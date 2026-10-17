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
  grantOptions?: { key: string; label: string }[]
}>()
const emit = defineEmits<{ close: []; submit: [] }>()
function updateGrant(locationId: string, capabilities: string[]) {
  const values = (form.value.grants || []).filter(item => item.locationId !== locationId)
  form.value = { ...form.value, grants: [...values, { locationId, capabilities: [...capabilities] }] }
}
</script>
<template>
  <BsRecordActionDialog v-if="state.visible" :visible="true" :title="state.title" :dirty="state.dirty" :pending="state.pending" :error="state.error" :submit-label="state.submitLabel" :cancel-label="state.cancelLabel" :submit-disabled="Boolean(link) || state.submitDisabled" @update:visible="value => { if (!value) emit('close') }" @submit="emit('submit')">
    <BsText v-if="copy.help" size="sm" tone="muted">{{ copy.help }}</BsText>
    <BsUsageMeter v-if="usage" compact :item="usage" />
    <BsField v-if="copy.name" v-slot="field" :label="copy.name"><BsInput :id="field.id" :model-value="form.name" :disabled="Boolean(link)" :aria-describedby="field.describedby" minlength="2" maxlength="160" required @update:model-value="form = { ...form, name: String($event ?? '') }" /></BsField>
    <BsField v-if="copy.jobTitle" v-slot="field" :label="copy.jobTitle"><BsInput :id="field.id" :model-value="form.jobTitle" :disabled="Boolean(link)" maxlength="160" @update:model-value="form = { ...form, jobTitle: String($event ?? '') }" /></BsField>
    <BsField v-slot="field" :label="copy.email"><BsInput :id="field.id" :model-value="form.email" type="email" dir="ltr" autocomplete="email" :readonly="emailReadonly" :disabled="Boolean(link)" :required="!emailReadonly" :maxlength="copy.emailMaxLength" @update:model-value="form = { ...form, email: String($event ?? '') }" /></BsField>
    <BsField v-slot="field" :label="copy.role"><BsSelect :model-value="form.role" :input-id="field.id" :aria-describedby="field.describedby" :label="copy.role" :options="roles" option-value="value" option-label="label" option-disabled="disabled" :disabled="roleDisabled || Boolean(link)" @update:model-value="form = { ...form, role: String($event ?? '') }"><template #option="{ option }"><BsStack gap="xs"><BsText>{{ option.label }}</BsText><BsText v-if="option.description" size="xs" tone="muted">{{ option.description }}</BsText></BsStack></template></BsSelect></BsField>
    <BsFieldGroup v-if="locations && copy.locations" :legend="copy.locations"><BsCheckbox v-for="location in locations" :key="location.id" :model-value="form.locationIds" :value="location.id" :label="location.name" :disabled="Boolean(link)" @update:model-value="form = { ...form, locationIds: $event as string[] }" /></BsFieldGroup>
    <BsFieldGroup v-for="location in grantOptions ? locations?.filter(item => form.locationIds.includes(item.id)) : []" :key="`permissions-${location.id}`" :legend="`${copy.permissions || ''}: ${location.name}`"><BsCheckbox v-for="option in grantOptions" :key="option.key" :model-value="form.grants?.find(item => item.locationId === location.id)?.capabilities || []" :value="option.key" :label="option.label" :disabled="state.pending || Boolean(link)" @update:model-value="updateGrant(location.id, $event as string[])" /></BsFieldGroup>
    <BsAlert v-if="copy.deliveryTitle" tone="info"><BsText emphasis="bold">{{ copy.deliveryTitle }}</BsText><BsText size="xs">{{ copy.deliveryHint }}</BsText></BsAlert>
    <BsField v-if="link && copy.credentialLabel" v-slot="field" :label="copy.credentialLabel" :hint="copy.ready"><BsInput :id="field.id" :model-value="link" readonly autocomplete="off" :aria-describedby="field.describedby" @focus="($event.target as HTMLInputElement).select()" /></BsField>
    <BsText v-else-if="link" role="status"><BsText as="strong">{{ copy.ready }}</BsText><BsInput :model-value="link" readonly @focus="($event.target as HTMLInputElement).select()" /></BsText>
  </BsRecordActionDialog>
</template>
