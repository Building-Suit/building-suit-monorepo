<script setup lang="ts">
defineProps<{
  primaryAction?: { label: string; to: string; description: string }
  settings?: { title: string; description: string; loading: boolean; loadingLabel: string; error: string|null; saved: string|null; canEdit: boolean; needsReauthentication: boolean; summary: { label: string; value: string }[]; copy: { name: string; phone: string; phoneHint: string; confirmations: string; preference: string; edit: string; save: string; cancel: string; retry: string; signIn: string; unavailable: string }; editor: { dirty: boolean; pending: boolean; error: string|null; submitDisabled: boolean } }
  product: { name: string; homeLabel: string; title: string; description: string }
  title: string
  description: string
  status: string
  statusDescription: string
  signOut: string
  pending?: boolean
  links?: { label: string; to: string }[]
  error?: string | null
  availability?: { state: 'loading' | 'error' | 'permission'; title: string; description: string }
}>()
const form = defineModel<{ personalName: string; contactPhone: string; inAppConfirmations: boolean }>('accountForm', { default: () => ({ personalName: '',contactPhone: '',inAppConfirmations: false }) })
const editorOpen = defineModel<boolean>('accountEditorOpen', { default: false })
const emit = defineEmits<{ signOut: []; editAccount: []; saveAccount: []; reloadAccount: []; reauthenticate: [] }>()
</script>
<template>
  <BsProductAuthFrame :product="product">
    <BsStateSurface v-if="availability" :title-level="1" :state="availability.state" :title="availability.title" :description="availability.description" />
    <BsStack v-else>
      <BsHeading :level="1">{{ title }}</BsHeading>
      <BsText as="p">{{ description }}</BsText>
      <BsStateSurface state="success" :title="status" :description="statusDescription" />
      <BsActionTile v-if="primaryAction" :to="primaryAction.to" :title="primaryAction.label" :aria-label="primaryAction.label" :description="primaryAction.description" tone="accent" />
      <BsAlert v-if="error" tone="error" :description="error" />
      <BsStack v-if="settings">
        <BsHeading :level="2">{{ settings.title }}</BsHeading>
        <BsText as="p">{{ settings.description }}</BsText>
        <BsStateSurface v-if="settings.loading" state="loading" :title="settings.loadingLabel" />
        <BsAlert v-if="settings.error" tone="error" :description="settings.error" />
        <BsAlert v-if="settings.saved" tone="success" :description="settings.saved" />
        <BsDescriptionList><BsDescriptionItem v-for="item in settings.summary" :key="item.label" :term="item.label">{{ item.value }}</BsDescriptionItem></BsDescriptionList>
        <BsText as="p">{{ settings.copy.preference }}</BsText>
        <BsButton v-if="settings.canEdit" @click="emit('editAccount')">{{ settings.copy.edit }}</BsButton>
        <BsButton v-if="settings.error" @click="emit('reloadAccount')">{{ settings.copy.retry }}</BsButton>
        <BsButton v-if="settings.needsReauthentication" @click="emit('reauthenticate')">{{ settings.copy.signIn }}</BsButton>
        <BsText as="p">{{ settings.copy.unavailable }}</BsText>
        <BsRecordActionDialog v-model:visible="editorOpen" :title="settings.copy.edit" :dirty="settings.editor.dirty" :pending="settings.editor.pending" :error="settings.editor.error" :submit-label="settings.copy.save" :cancel-label="settings.copy.cancel" :submit-disabled="settings.editor.submitDisabled" @submit="emit('saveAccount')">
          <BsField v-slot="field" :label="settings.copy.name"><BsInput :id="field.id" :model-value="form.personalName" :maxlength="120" @update:model-value="form = { ...form,personalName: String($event ?? '') }" /></BsField>
          <BsField v-slot="field" :label="settings.copy.phone" :hint="settings.copy.phoneHint"><BsInput :id="field.id" :model-value="form.contactPhone" :maxlength="16" dir="ltr" @update:model-value="form = { ...form,contactPhone: String($event ?? '') }" /></BsField>
          <BsCheckbox :model-value="form.inAppConfirmations" :label="settings.copy.confirmations" @update:model-value="form = { ...form,inAppConfirmations: $event === true }" />
          <BsButton v-if="settings.needsReauthentication" @click="emit('reauthenticate')">{{ settings.copy.signIn }}</BsButton>
        </BsRecordActionDialog>
      </BsStack>
      <BsLink v-for="link in links" :key="link.to" :to="link.to">{{ link.label }}</BsLink>
      <BsButton :pending="pending" :disabled="pending" @click="emit('signOut')">{{ signOut }}</BsButton>
    </BsStack>
  </BsProductAuthFrame>
</template>
