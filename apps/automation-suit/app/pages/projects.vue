<script setup lang="ts">
import type { ProjectRow, WorkstreamRow } from '../../types/operations'

const { data, error, refresh } = await useFetch<{ projects: ProjectRow[]; workstreams: WorkstreamRow[] }>('/api/projects')
const { data: operator } = await useFetch<{ writesEnabled: boolean }>('/api/operator/status')
const streamsFor = (id: string) => data.value?.workstreams.filter(row => row.project_id === id) ?? []
const showWizard = ref(false)
const saving = ref(false)
const validation = ref('')
const form = reactive({
  slug: '', display_name: '', repository_path: '', github_repository: '', integration_branch: 'stg', production_branch: 'main',
  local_repository_root: '.', worktree_root: '.local/worktrees', default_model_profile: 'standard', retry_policy_id: 'standard-five',
  allowed_publication_paths: '["apps/", "packages/"]', verification_commands: '[]',
  workstreams: '[{"slug":"frontend","display_name":"Frontend","stack_key":"frontend","application_path":"apps/web"}]', active: false,
})
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
  saving.value = true
  validation.value = ''
  try {
    const result = await $fetch<{ valid?: boolean; ok?: boolean }>(save ? '/api/operator/projects' : '/api/operator/projects/validate', { method: 'POST', body: payload() })
    validation.value = save && result.ok ? 'Saved. The project remains inactive unless Active was explicitly selected.' : 'Configuration is valid. No data was changed.'
    if (save) { await refresh(); showWizard.value = false }
  }
  catch (cause) { validation.value = cause instanceof Error ? cause.message : String(cause) }
  finally { saving.value = false }
}
</script>

<template>
  <main class="space-y-5">
    <div class="flex flex-wrap items-center justify-between gap-3"><div><p class="text-xs font-bold uppercase tracking-widest text-fg-muted">Registry</p><h1 class="mt-2 text-3xl font-black">Projects</h1><p class="mt-1 text-sm text-fg-muted">Repository, branch, policy, workstream and concurrency configuration.</p></div><div class="flex gap-2"><button class="rounded-control border border-[var(--bs-border)] px-3 py-2 text-sm font-bold" @click="showWizard = !showWizard">{{ showWizard ? 'Close wizard' : 'Register project' }}</button><button class="rounded-control border border-[var(--bs-border)] px-3 py-2 text-sm font-bold" @click="refresh()">Refresh</button></div></div>
    <section v-if="showWizard" class="rounded-card border border-[var(--bs-border)] bg-surface p-5"><h2 class="text-xl font-black">Project registration wizard</h2><p class="mt-1 text-sm text-fg-muted">Validate first. New projects default to inactive; secrets are rejected.</p><div class="mt-4 grid gap-3 md:grid-cols-2"><label v-for="field in ['display_name','slug','repository_path','github_repository','integration_branch','production_branch','local_repository_root','worktree_root','retry_policy_id']" :key="field" class="text-xs font-bold text-fg-muted">{{ field }}<input v-model="form[field as keyof typeof form]" class="mt-1 w-full rounded-control border border-[var(--bs-border)] bg-background px-3 py-2 text-sm text-fg"></label><label class="text-xs font-bold text-fg-muted">Default model profile<select v-model="form.default_model_profile" class="mt-1 w-full rounded-control border border-[var(--bs-border)] bg-background px-3 py-2 text-sm text-fg"><option v-for="profile in ['no_ai','fast','standard','deep','review']" :key="profile">{{ profile }}</option></select></label></div><label class="mt-3 block text-xs font-bold text-fg-muted">Workstreams JSON<textarea v-model="form.workstreams" rows="5" class="mt-1 w-full rounded-control border border-[var(--bs-border)] bg-background p-3 font-mono text-xs text-fg" /></label><div class="mt-3 grid gap-3 md:grid-cols-2"><label class="text-xs font-bold text-fg-muted">Allowed publication paths JSON<textarea v-model="form.allowed_publication_paths" rows="3" class="mt-1 w-full rounded-control border border-[var(--bs-border)] bg-background p-3 font-mono text-xs text-fg" /></label><label class="text-xs font-bold text-fg-muted">Verification commands JSON<textarea v-model="form.verification_commands" rows="3" class="mt-1 w-full rounded-control border border-[var(--bs-border)] bg-background p-3 font-mono text-xs text-fg" /></label></div><label class="mt-3 flex items-center gap-2 text-sm"><input v-model="form.active" type="checkbox">Activate immediately</label><div class="mt-4 flex flex-wrap items-center gap-2"><button :disabled="saving" class="rounded-control border border-[var(--bs-border)] px-3 py-2 text-sm font-bold" @click="validate(false)">Validate / dry-run</button><button :disabled="saving || !operator?.writesEnabled" class="rounded-control bg-primary px-3 py-2 text-sm font-bold text-primary-contrast disabled:opacity-50" @click="validate(true)">Save project</button><span class="text-xs text-fg-muted">{{ operator?.writesEnabled ? 'Operator writes enabled' : 'Configure NUXT_CONTROL_OPERATOR_DATABASE_URL to save' }}</span></div><p v-if="validation" class="mt-3 rounded-control bg-background p-3 text-sm">{{ validation }}</p></section>
    <p v-if="error" class="rounded-card border border-danger/40 p-4 text-danger">{{ error.message }}</p>
    <article v-for="project in data?.projects || []" :key="project.project_id" class="rounded-card border border-[var(--bs-border)] bg-surface p-5"><div class="flex flex-wrap justify-between gap-3"><div><div class="flex items-center gap-2"><h2 class="text-xl font-black">{{ project.display_name }}</h2><DashboardStatusPill :value="project.active ? 'active' : 'inactive'" /></div><p class="mt-1 font-mono text-xs text-fg-muted">{{ project.slug }} · {{ project.github_repository }}</p></div><div class="text-end text-xs text-fg-muted"><p>{{ project.integration_branch }} → {{ project.production_branch }}</p><p>{{ project.retry_policy_id || 'global retry policy' }} · {{ project.default_model_profile }}</p></div></div><div class="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3"><div v-for="stream in streamsFor(project.project_id)" :key="stream.slug" class="rounded-control border border-[var(--bs-border)] p-3"><div class="flex justify-between gap-2"><strong>{{ stream.display_name }}</strong><DashboardStatusPill :value="stream.active ? 'active' : 'inactive'" /></div><p class="mt-1 font-mono text-xs text-fg-muted">{{ stream.slug }} · {{ stream.stack_key }}</p><p class="mt-2 text-xs text-fg-muted">{{ stream.application_path || 'No application path' }}</p></div></div><details class="mt-4 text-xs"><summary class="cursor-pointer font-bold text-link">Configuration</summary><pre class="mt-2 overflow-auto rounded-control bg-background p-3">{{ JSON.stringify(project, null, 2) }}</pre></details></article>
  </main>
</template>
