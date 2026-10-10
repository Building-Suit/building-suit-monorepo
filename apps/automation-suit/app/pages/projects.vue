<script setup lang="ts">
import { automationStatusTone } from '../utils/automationStatusTone'
import type { ProjectRow, WorkstreamRow } from '../../types/operations'

const { data, error, refresh } = await useFetch<{ projects: ProjectRow[]; workstreams: WorkstreamRow[] }>('/api/projects')
const { data: operator } = await useFetch<{ writesEnabled: boolean }>('/api/operator/status')
const streamsFor = (id: string) => data.value?.workstreams.filter(row => row.project_id === id) ?? []
const validation = ref('')
const form = reactive({
  slug: '', display_name: '', repository_path: '', github_repository: '', integration_branch: 'stg', production_branch: 'main',
  local_repository_root: '.', worktree_root: '.local/worktrees', default_model_profile: 'standard', retry_policy_id: 'standard-five',
  allowed_publication_paths: '["apps/", "packages/"]', verification_commands: '[]',
  workstreams: '[{"slug":"frontend","display_name":"Frontend","stack_key":"frontend","application_path":"apps/web"}]', active: false,
})
const registrationFields = ['display_name','slug','repository_path','github_repository','integration_branch','production_branch','local_repository_root','worktree_root','retry_policy_id'] as const
const action = useRecordAction(() => form)
const { visible: showWizard, dirty, pending, error: actionError } = action
const { success } = useToasts()
function openWizard() {
  Object.assign(form, {
    slug: '', display_name: '', repository_path: '', github_repository: '', integration_branch: 'stg', production_branch: 'main',
    local_repository_root: '.', worktree_root: '.local/worktrees', default_model_profile: 'standard', retry_policy_id: 'standard-five',
    allowed_publication_paths: '["apps/", "packages/"]', verification_commands: '[]',
    workstreams: '[{"slug":"frontend","display_name":"Frontend","stack_key":"frontend","application_path":"apps/web"}]', active: false,
  })
  validation.value = ''
  action.create()
}
function payload() {
  return {
    ...form,
    allowed_publication_paths: JSON.parse(form.allowed_publication_paths),
    verification_config: { commands: JSON.parse(form.verification_commands) },
    workstreams: JSON.parse(form.workstreams),
    application_paths: {}, stack_strategy: { type: 'stacked-pr' }, local_database_strategy: { type: 'none' },
    codex_enabled: true, concurrency_policy: { max_parallel: 1, serialize_workstreams: true, max_run_tasks: 20 },
    n8n_metadata: {}, environment_routing: {}, metadata: {},
  }
}
async function validate(save = false) {
  if (pending.value) return
  pending.value = true
  validation.value = ''
  try {
    const result = await $fetch<{ valid?: boolean; ok?: boolean }>(save ? '/api/operator/projects' : '/api/operator/projects/validate', { method: 'POST', body: payload() })
    validation.value = save && result.ok ? 'Saved. The project remains inactive unless Active was explicitly selected.' : 'Configuration is valid. No data was changed.'
    if (save) { await refresh(); action.complete(); success('Project saved and audited.') }
  }
  catch { action.fail(save ? 'The project could not be saved.' : 'The project configuration is not valid.') }
  finally { pending.value = false }
}
</script>

<template>
  <BsPage padding="none" width="full">
    <BsInline justify="between">
      <BsStack gap="sm">
        <BsText size="xs" tone="muted" emphasis="semibold">
          Registry
        </BsText>
        <BsHeading :level="1">
          Projects
        </BsHeading>
        <BsText size="sm" tone="muted">
          Repository, branch, policy, workstream and concurrency configuration.
        </BsText>
      </BsStack>
      <BsInline>
        <BsButton variant="primary" @click="openWizard">
          Register project
        </BsButton>
        <BsButton @click="refresh()">
          Refresh
        </BsButton>
      </BsInline>
    </BsInline>
    <BsAlert v-if="error" tone="error" :description="error.message" />
    <BsCard v-for="project in data?.projects || []" :key="project.project_id">
      <BsStack gap="sm">
        <BsInline justify="between">
          <BsStack gap="sm">
            <BsInline>
              <BsHeading :level="2">
                {{ project.display_name }}
              </BsHeading>
              <BsStatusBadge :status="project.active ? 'active' : 'inactive'" :label="project.active ? 'active' : 'inactive'" :tone="automationStatusTone(project.active ? 'active' : 'inactive')" />
            </BsInline>
            <BsText size="xs" tone="muted">
              {{ project.slug }} · {{ project.github_repository }}
            </BsText>
          </BsStack>
          <BsStack gap="sm">
            <BsText>
              {{ project.integration_branch }} → {{ project.production_branch }}
            </BsText>
            <BsText>
              {{ project.retry_policy_id || 'global retry policy' }} · {{ project.default_model_profile }}
            </BsText>
          </BsStack>
        </BsInline>
        <BsGrid columns="auto">
          <BsCard v-for="stream in streamsFor(project.project_id)" :key="stream.slug" variant="flat" padding="sm">
            <BsStack gap="sm">
              <BsInline justify="between">
                <BsText as="strong" emphasis="semibold">
                  {{ stream.display_name }}
                </BsText>
                <BsStatusBadge :status="stream.active ? 'active' : 'inactive'" :label="stream.active ? 'active' : 'inactive'" :tone="automationStatusTone(stream.active ? 'active' : 'inactive')" />
              </BsInline>
              <BsText size="xs" tone="muted">
                {{ stream.slug }} · {{ stream.stack_key }}
              </BsText>
              <BsText size="xs" tone="muted">
                {{ stream.application_path || 'No application path' }}
              </BsText>
            </BsStack>
          </BsCard>
        </BsGrid>
        <BsDisclosure summary="Configuration">
          <BsCodeBlock>
            {{ JSON.stringify(project, null, 2) }}
          </BsCodeBlock>
        </BsDisclosure>
      </BsStack>
    </BsCard>
    <BsRecordActionDialog v-model:visible="showWizard" title="Project registration wizard" size="lg" :dirty="dirty" :pending="pending" :error="actionError" :submit-disabled="!operator?.writesEnabled" submit-label="Save project" @submit="validate(true)">
      <BsText size="sm" tone="muted">
        Validate first. New projects default to inactive; secrets are rejected.
      </BsText>
      <BsGrid columns="auto">
        <BsField v-for="field in registrationFields" :key="field" v-slot="{ id, describedby }" :label="field">
          <BsInput :id="id" v-model="form[field]" :aria-describedby="describedby" />
        </BsField>
        <BsField v-slot="{ id, describedby }" label="Default model profile">
          <BsSelect :id="id" v-model="form.default_model_profile" :aria-describedby="describedby" label="Default model profile" :options="['no_ai','fast','standard','deep','review']" />
        </BsField>
      </BsGrid>
      <BsField v-slot="{ id, describedby }" label="Workstreams JSON">
        <BsTextarea :id="id" v-model="form.workstreams" :aria-describedby="describedby" :rows="5" />
      </BsField>
      <BsGrid columns="auto">
        <BsField v-slot="{ id, describedby }" label="Allowed publication paths JSON">
          <BsTextarea :id="id" v-model="form.allowed_publication_paths" :aria-describedby="describedby" :rows="3" />
        </BsField>
        <BsField v-slot="{ id, describedby }" label="Verification commands JSON">
          <BsTextarea :id="id" v-model="form.verification_commands" :aria-describedby="describedby" :rows="3" />
        </BsField>
      </BsGrid>
      <BsCheckbox v-model="form.active" label="Activate immediately" />
      <BsInline>
        <BsButton :pending="pending" @click="validate(false)">
          Validate / dry-run
        </BsButton>
        <BsText as="span" size="xs" tone="muted">
          {{ operator?.writesEnabled ? 'Operator writes enabled' : 'Configure NUXT_CONTROL_OPERATOR_DATABASE_URL to save' }}
        </BsText>
      </BsInline>
      <BsText v-if="validation" role="status" size="sm">
        {{ validation }}
      </BsText>
    </BsRecordActionDialog>
  </BsPage>
</template>
