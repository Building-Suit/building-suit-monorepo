<script setup lang="ts">
import type { BsRoutingPolicyView, BsRoutingPolicyForm, BsRoutingPolicyCopy } from '../types/routingPolicyPresentation'
const form = defineModel<BsRoutingPolicyForm>('form', { required: true })
const visible = defineModel<boolean>('visible', { required: true })
defineProps<{
  policies: BsRoutingPolicyView[]
  copy: BsRoutingPolicyCopy
  error?: string | null
  editor: { editing: boolean; dirty: boolean; pending: boolean; error: string | null; canSubmit: boolean }
}>()
const emit = defineEmits<{ create: []; edit: [id: string]; submit: [] }>()
function change<K extends keyof BsRoutingPolicyForm>(key: K, value: BsRoutingPolicyForm[K]) { form.value = { ...form.value, [key]: value } }
</script>
<template>
  <BsPage padding="none" width="full">
    <BsInline justify="between" align="start"><BsStack gap="sm"><BsText size="xs" tone="muted" emphasis="semibold">{{ copy.eyebrow }}</BsText><BsHeading :level="1">{{ copy.title }}</BsHeading><BsText size="sm" tone="muted">{{ copy.description }}</BsText></BsStack><BsButton variant="primary" @click="emit('create')">{{ copy.create }}</BsButton></BsInline>
    <BsAlert v-if="error" tone="error" :description="error" />
    <BsGrid columns="auto"><BsCard v-for="policy in policies" :key="policy.id"><BsStack gap="sm"><BsInline justify="between"><BsStack gap="sm"><BsHeading :level="2">{{ policy.name }}</BsHeading><BsText size="xs" tone="muted">{{ policy.id }}</BsText></BsStack><BsInline align="start"><BsStatusBadge :status="policy.status" :label="policy.statusLabel" :tone="policy.statusTone" /><BsButton size="sm" @click="emit('edit', policy.id)">{{ copy.edit }}</BsButton></BsInline></BsInline><BsList ordered><BsListItem v-for="attempt in policy.attempts" :key="attempt.id"><BsText as="span" tone="muted">{{ attempt.label }}</BsText><BsText as="strong" emphasis="semibold">{{ attempt.profile }}</BsText></BsListItem></BsList></BsStack></BsCard></BsGrid>
    <BsRecordActionDialog v-model:visible="visible" :title="editor.editing ? copy.editTitle : copy.createTitle" :dirty="editor.dirty" :pending="editor.pending" :error="editor.error" :submit-disabled="!editor.canSubmit" :submit-label="copy.submit" @submit="emit('submit')">
      <BsGrid columns="auto"><BsField v-slot="{ id, describedby }" :label="copy.id"><BsInput :id="id" :model-value="form.id" :aria-describedby="describedby" required @update:model-value="change('id', String($event))" /></BsField><BsField v-slot="{ id, describedby }" :label="copy.name"><BsInput :id="id" :model-value="form.name" :aria-describedby="describedby" required @update:model-value="change('name', String($event))" /></BsField><BsField v-slot="{ id, describedby }" :label="copy.maximumAttempts"><BsInput :id="id" :model-value="form.maximumAttempts" :aria-describedby="describedby" type="number" min="1" max="20" required @update:model-value="change('maximumAttempts', Number($event))" /></BsField></BsGrid>
      <BsField v-slot="{ id, describedby }" :label="copy.profiles"><BsInput :id="id" :model-value="form.profiles" :aria-describedby="describedby" required @update:model-value="change('profiles', String($event))" /></BsField>
      <BsCheckbox :model-value="form.active" :label="copy.active" @update:model-value="change('active', Boolean($event))" /><BsText size="xs" tone="muted">{{ copy.writeStatus }}</BsText>
    </BsRecordActionDialog>
  </BsPage>
</template>
