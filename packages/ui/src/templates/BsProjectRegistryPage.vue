<script setup lang="ts">
import type { BsProjectRegistryView, BsProjectRegistrationForm, BsProjectRegistryCopy } from '../types/projectRegistryPresentation'
const form = defineModel<BsProjectRegistrationForm>('form', { required: true })
const visible = defineModel<boolean>('visible', { required: true })
defineProps<{ projects: BsProjectRegistryView[]; modelProfiles: string[]; copy: BsProjectRegistryCopy; error?: string | null; editor: { dirty: boolean; pending: boolean; error: string | null; canSubmit: boolean; validation: string } }>()
const emit = defineEmits<{ register: []; refresh: []; validate: []; submit: [] }>()
const registrationFields = ['name', 'slug', 'repositoryPath', 'repository', 'integrationBranch', 'productionBranch', 'localRoot', 'worktreeRoot', 'retryPolicy'] as const
function change<K extends keyof BsProjectRegistrationForm>(key: K, value: BsProjectRegistrationForm[K]) { form.value = { ...form.value, [key]: value } }
</script>
<template>
  <BsPage padding="none" width="full">
    <BsInline justify="between">
      <BsStack gap="sm">
        <BsText size="xs" tone="muted" emphasis="semibold">
          {{ copy.eyebrow }}
        </BsText>
        <BsHeading :level="1">
          {{ copy.title }}
        </BsHeading>
        <BsText size="sm" tone="muted">
          {{ copy.description }}
        </BsText>
      </BsStack>
      <BsInline>
        <BsButton variant="primary" @click="emit('register')">
          {{ copy.register }}
        </BsButton>
        <BsButton @click="emit('refresh')">
          {{ copy.refresh }}
        </BsButton>
      </BsInline>
    </BsInline>
    <BsAlert v-if="error" tone="error" :description="error" />
    <BsCard v-for="project in projects" :key="project.id">
      <BsStack gap="sm">
        <BsInline justify="between">
          <BsStack gap="sm">
            <BsInline>
              <BsHeading :level="2">
                {{ project.name }}
              </BsHeading>
              <BsStatusBadge :status="project.status" :label="project.statusLabel" :tone="project.statusTone" />
            </BsInline>
            <BsText size="xs" tone="muted">
              {{ project.subtitle }}
            </BsText>
          </BsStack>
          <BsStack gap="sm">
            <BsText>
              {{ project.branchSummary }}
            </BsText>
            <BsText>
              {{ project.policySummary }}
            </BsText>
          </BsStack>
        </BsInline>
        <BsGrid columns="auto">
          <BsCard v-for="stream in project.workstreams" :key="stream.id" variant="flat" padding="sm">
            <BsStack gap="sm">
              <BsInline justify="between">
                <BsText as="strong" emphasis="semibold">
                  {{ stream.name }}
                </BsText>
                <BsStatusBadge :status="stream.status" :label="stream.statusLabel" :tone="stream.statusTone" />
              </BsInline>
              <BsText size="xs" tone="muted">
                {{ stream.subtitle }}
              </BsText>
              <BsText size="xs" tone="muted">
                {{ stream.application }}
              </BsText>
            </BsStack>
          </BsCard>
        </BsGrid>
        <BsDisclosure :summary="copy.configuration">
          <BsCodeBlock>
            {{ project.configuration }}
          </BsCodeBlock>
        </BsDisclosure>
      </BsStack>
    </BsCard>
    <BsRecordActionDialog v-model:visible="visible" :title="copy.editorTitle" size="lg" :dirty="editor.dirty" :pending="editor.pending" :error="editor.error" :submit-disabled="!editor.canSubmit" :submit-label="copy.submit" @submit="emit('submit')">
      <BsText size="sm" tone="muted">
        {{ copy.editorDescription }}
      </BsText>
      <BsGrid columns="auto">
        <BsField v-for="field in registrationFields" :key="field" v-slot="{ id, describedby }" :label="copy.fields[field]">
          <BsInput :id="id" :model-value="form[field]" :aria-describedby="describedby" @update:model-value="change(field, String($event))" />
        </BsField>
        <BsField v-slot="{ id, describedby }" :label="copy.fields.modelProfile">
          <BsSelect :id="id" :model-value="form.modelProfile" :aria-describedby="describedby" :label="copy.fields.modelProfile" :options="modelProfiles" @update:model-value="change('modelProfile', String($event))" />
        </BsField>
      </BsGrid>
      <BsField v-slot="{ id, describedby }" :label="copy.fields.workstreams">
        <BsTextarea :id="id" :model-value="form.workstreams" :aria-describedby="describedby" :rows="5" @update:model-value="change('workstreams', String($event))" />
      </BsField>
      <BsGrid columns="auto">
        <BsField v-slot="{ id, describedby }" :label="copy.fields.publicationPaths">
          <BsTextarea :id="id" :model-value="form.publicationPaths" :aria-describedby="describedby" :rows="3" @update:model-value="change('publicationPaths', String($event))" />
        </BsField>
        <BsField v-slot="{ id, describedby }" :label="copy.fields.verificationCommands">
          <BsTextarea :id="id" :model-value="form.verificationCommands" :aria-describedby="describedby" :rows="3" @update:model-value="change('verificationCommands', String($event))" />
        </BsField>
      </BsGrid>
      <BsCheckbox :model-value="form.active" :label="copy.activate" @update:model-value="change('active', Boolean($event))" />
      <BsInline>
        <BsButton :pending="editor.pending" @click="emit('validate')">
          {{ copy.validate }}
        </BsButton>
        <BsText as="span" size="xs" tone="muted">
          {{ copy.writeStatus }}
        </BsText>
      </BsInline>
      <BsText v-if="editor.validation" role="status" size="sm">
        {{ editor.validation }}
      </BsText>
    </BsRecordActionDialog>
  </BsPage>
</template>
