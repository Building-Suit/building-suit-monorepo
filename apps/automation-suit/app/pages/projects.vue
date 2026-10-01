<script setup lang="ts">
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
</script>

<template>
  <main class="space-y-5">
    <div class="flex flex-wrap items-center justify-between gap-3"><div><p class="text-xs font-bold uppercase tracking-widest text-fg-muted">Registry</p><h1 class="mt-2 text-3xl font-black">Projects</h1><p class="mt-1 text-sm text-fg-muted">Repository, branch, policy, workstream and concurrency configuration.</p></div><div class="flex gap-2"><BsButton variant="primary" @click="openWizard">Register project</BsButton><BsButton @click="refresh()">Refresh</BsButton></div></div>
    <BsCard v-if="error" padding="sm" class="border-danger/40 text-danger">{{ error.message }}</BsCard>
    <BsCard v-for="project in data?.projects || []" :key="project.project_id"><div class="flex flex-wrap justify-between gap-3"><div><div class="flex items-center gap-2"><h2 class="text-xl font-black">{{ project.display_name }}</h2><DashboardStatusPill :value="project.active ? 'active' : 'inactive'" /></div><p class="mt-1 font-mono text-xs text-fg-muted">{{ project.slug }} · {{ project.github_repository }}</p></div><div class="text-end text-xs text-fg-muted"><p>{{ project.integration_branch }} → {{ project.production_branch }}</p><p>{{ project.retry_policy_id || 'global retry policy' }} · {{ project.default_model_profile }}</p></div></div><div class="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3"><BsCard v-for="stream in streamsFor(project.project_id)" :key="stream.slug" variant="flat" padding="sm"><div class="flex justify-between gap-2"><strong>{{ stream.display_name }}</strong><DashboardStatusPill :value="stream.active ? 'active' : 'inactive'" /></div><p class="mt-1 font-mono text-xs text-fg-muted">{{ stream.slug }} · {{ stream.stack_key }}</p><p class="mt-2 text-xs text-fg-muted">{{ stream.application_path || 'No application path' }}</p></BsCard></div><details class="mt-4 text-xs"><summary class="cursor-pointer font-bold text-link">Configuration</summary><pre class="mt-2 overflow-auto rounded-control bg-background p-3">{{ JSON.stringify(project, null, 2) }}</pre></details></BsCard>
    <BsRecordActionDialog v-model:visible="showWizard" title="Project registration wizard" size="lg" :dirty="dirty" :pending="pending" :error="actionError" :submit-disabled="!operator?.writesEnabled" submit-label="Save project" @submit="validate(true)">
      <p class="text-sm text-fg-muted">Validate first. New projects default to inactive; secrets are rejected.</p>
      <div class="grid gap-3 md:grid-cols-2"><FloatingField v-for="field in ['display_name','slug','repository_path','github_repository','integration_branch','production_branch','local_repository_root','worktree_root','retry_policy_id']" :key="field" :label="field"><input v-model="form[field as keyof typeof form]" class="ls-input"></FloatingField><FloatingField label="Default model profile"><BsSelect v-model="form.default_model_profile" label="Default model profile" :options="['no_ai','fast','standard','deep','review']" /></FloatingField></div>
      <FloatingField label="Workstreams JSON"><textarea v-model="form.workstreams" rows="5" class="ls-input font-mono text-xs" /></FloatingField>
      <div class="grid gap-3 md:grid-cols-2"><FloatingField label="Allowed publication paths JSON"><textarea v-model="form.allowed_publication_paths" rows="3" class="ls-input font-mono text-xs" /></FloatingField><FloatingField label="Verification commands JSON"><textarea v-model="form.verification_commands" rows="3" class="ls-input font-mono text-xs" /></FloatingField></div>
      <label class="flex items-center gap-2 text-sm"><input v-model="form.active" type="checkbox">Activate immediately</label>
      <div class="flex flex-wrap items-center gap-2"><BsButton :pending="pending" @click="validate(false)">Validate / dry-run</BsButton><span class="text-xs text-fg-muted">{{ operator?.writesEnabled ? 'Operator writes enabled' : 'Configure NUXT_CONTROL_OPERATOR_DATABASE_URL to save' }}</span></div>
      <p v-if="validation" role="status" class="rounded-control bg-background p-3 text-sm">{{ validation }}</p>
    </BsRecordActionDialog>
  </main>
</template>
