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

const projectViews = computed(() => (data.value?.projects ?? []).map(project => ({
  id: project.project_id, name: project.display_name, subtitle: `${project.slug} · ${project.github_repository}`,
  status: project.active ? 'active' : 'inactive', statusLabel: project.active ? 'active' : 'inactive', statusTone: automationStatusTone(project.active ? 'active' : 'inactive'),
  branchSummary: `${project.integration_branch} → ${project.production_branch}`, policySummary: `${project.retry_policy_id || 'global retry policy'} · ${project.default_model_profile}`,
  configuration: JSON.stringify(project, null, 2),
  workstreams: streamsFor(project.project_id).map(stream => ({ id: stream.slug, name: stream.display_name, subtitle: `${stream.slug} · ${stream.stack_key}`, application: stream.application_path || 'No application path', status: stream.active ? 'active' : 'inactive', statusLabel: stream.active ? 'active' : 'inactive', statusTone: automationStatusTone(stream.active ? 'active' : 'inactive') })),
})))
const editorForm = computed({
  get: () => ({ name: form.display_name, slug: form.slug, repositoryPath: form.repository_path, repository: form.github_repository, integrationBranch: form.integration_branch, productionBranch: form.production_branch, localRoot: form.local_repository_root, worktreeRoot: form.worktree_root, retryPolicy: form.retry_policy_id, modelProfile: form.default_model_profile, workstreams: form.workstreams, publicationPaths: form.allowed_publication_paths, verificationCommands: form.verification_commands, active: form.active }),
  set: (value: import('@building-suit/ui/types/projectRegistryPresentation').BsProjectRegistrationForm) => Object.assign(form, { display_name: value.name, slug: value.slug, repository_path: value.repositoryPath, github_repository: value.repository, integration_branch: value.integrationBranch, production_branch: value.productionBranch, local_repository_root: value.localRoot, worktree_root: value.worktreeRoot, retry_policy_id: value.retryPolicy, default_model_profile: value.modelProfile, workstreams: value.workstreams, allowed_publication_paths: value.publicationPaths, verification_commands: value.verificationCommands, active: value.active }),
})
const copy = computed(() => ({
  eyebrow: 'Registry', title: 'Projects', description: 'Repository, branch, policy, workstream and concurrency configuration.', register: 'Register project', refresh: 'Refresh', configuration: 'Configuration', editorTitle: 'Project registration wizard', editorDescription: 'Validate first. New projects default to inactive; secrets are rejected.', submit: 'Save project', validate: 'Validate / dry-run', activate: 'Activate immediately',
  writeStatus: operator.value?.writesEnabled ? 'Operator writes enabled' : 'Configure NUXT_CONTROL_OPERATOR_DATABASE_URL to save',
  fields: { name: 'display_name', slug: 'slug', repositoryPath: 'repository_path', repository: 'github_repository', integrationBranch: 'integration_branch', productionBranch: 'production_branch', localRoot: 'local_repository_root', worktreeRoot: 'worktree_root', retryPolicy: 'retry_policy_id', modelProfile: 'Default model profile', workstreams: 'Workstreams JSON', publicationPaths: 'Allowed publication paths JSON', verificationCommands: 'Verification commands JSON' },
}))
</script>
<template>
  <BsProjectRegistryPage v-model:form="editorForm" v-model:visible="showWizard" :projects="projectViews" :model-profiles="['no_ai', 'fast', 'standard', 'deep', 'review']" :copy="copy" :error="error?.message" :editor="{ dirty, pending, error: actionError, canSubmit: Boolean(operator?.writesEnabled), validation }" @register="openWizard" @refresh="refresh()" @validate="validate(false)" @submit="validate(true)" />
</template>
