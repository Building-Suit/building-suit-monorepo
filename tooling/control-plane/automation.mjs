#!/usr/bin/env node

import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { redact } from './lib/redaction.mjs'
import { validateProjectConfig } from './lib/project-config.mjs'
import { validateRetryPolicy } from './lib/retry-policy.mjs'

const repoRoot = fileURLToPath(new URL('../../', import.meta.url))
const [resource, action, ...positionals] = process.argv.slice(2)
const db = {
  host: process.env.AUTOMATION_CONTROL_DB_HOST ?? process.env.BS_CONTROL_DB_HOST ?? '127.0.0.1',
  port: process.env.AUTOMATION_CONTROL_DB_PORT ?? process.env.BS_CONTROL_DB_PORT ?? '54329',
  name: process.env.AUTOMATION_CONTROL_DB_NAME ?? process.env.BS_CONTROL_DB_NAME ?? 'building_suit_control',
  user: process.env.AUTOMATION_CONTROL_DB_USER ?? process.env.BS_CONTROL_DB_USER ?? 'bs_control_app',
  sslmode: process.env.AUTOMATION_CONTROL_DB_SSLMODE ?? process.env.BS_CONTROL_DB_SSLMODE ?? 'prefer',
}

function output(value, code = 0) {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`)
  process.exitCode = code
}

function run(program, args, options = {}) {
  const result = spawnSync(program, args, {
    cwd: options.cwd ?? repoRoot,
    input: options.input,
    encoding: 'utf8',
    env: { ...process.env, NO_COLOR: '1', FORCE_COLOR: '0', ...(options.env ?? {}) },
    timeout: options.timeout ?? 20 * 60 * 1000,
    maxBuffer: 50 * 1024 * 1024,
  })
  return { code: result.status ?? 1, stdout: (result.stdout ?? '').trim(), stderr: (result.stderr ?? '').trim(), error: result.error?.message }
}

function query(sql, variables = {}) {
  const variableArgs = Object.entries(variables).flatMap(([name, value]) => ['--set', `${name}=${value}`])
  const result = run('psql', ['-X', '-q', '-A', '-t', '-v', 'ON_ERROR_STOP=1', '-h', db.host, '-p', db.port, '-U', db.user, '-d', db.name, ...variableArgs], {
    input: `${sql.trim()}\n`, env: { PGSSLMODE: db.sslmode },
  })
  if (result.code !== 0 || result.error) throw new Error(result.stderr || result.error || 'control_database_query_failed')
  return result.stdout ? JSON.parse(result.stdout) : null
}

function flag(name, fallback = null) {
  const index = positionals.indexOf(`--${name}`)
  return index >= 0 ? (positionals[index + 1] ?? true) : fallback
}

function positional(index = 0) {
  return positionals.filter(value => !value.startsWith('--') && (positionals[positionals.indexOf(value) - 1]?.startsWith('--') !== true))[index]
}

function loadJson(file) {
  if (!file || !existsSync(path.resolve(file))) throw new Error('json_file_not_found')
  return JSON.parse(readFileSync(path.resolve(file), 'utf8'))
}

function delegate(command, id) {
  const delegatedArgs = Array.isArray(id) ? id : (id ? [id] : [])
  const result = run(process.execPath, ['tooling/control-plane/runner/bs-agent.mjs', command, ...delegatedArgs], { timeout: 75 * 60 * 1000 })
  process.stdout.write(`${result.stdout || JSON.stringify({ ok: false, error: result.stderr || result.error })}\n`)
  process.exitCode = result.code
}

function resolveWorkstreamRef(reference) {
  const [projectSlug, workstreamSlug] = String(reference ?? '').includes('/')
    ? String(reference).split('/', 2)
    : ['', String(reference ?? '')]
  const matches = query(`SELECT COALESCE(jsonb_agg(jsonb_build_object('project',p.slug,'workstream',w.slug,'suit_slug',w.suit_slug)),'[]') FROM control.workstreams w JOIN control.projects p USING(project_id) WHERE w.active=true AND (:'project'='' OR p.slug=:'project') AND w.slug=:'workstream';`, { project:projectSlug,workstream:workstreamSlug })
  if (matches.length !== 1) throw new Error(matches.length ? 'ambiguous_workstream_use_project_slash_workstream' : 'workstream_not_found')
  return matches[0].suit_slug
}

function projectList() {
  return query(`SELECT COALESCE(jsonb_agg(to_jsonb(p) ORDER BY p.display_name),'[]') FROM control.projects p;`)
}

function projectShow(slug) {
  return query(`SELECT jsonb_build_object('project',to_jsonb(p),'workstreams',COALESCE((SELECT jsonb_agg(to_jsonb(w) ORDER BY w.slug) FROM control.workstreams w WHERE w.project_id=p.project_id),'[]')) FROM control.projects p WHERE p.slug=:'slug';`, { slug })
}

function saveProject(config, dryRun) {
  const validated = validateProjectConfig(config)
  if (dryRun) return { ok: true, dry_run: true, project: validated }
  return query(`
    WITH input AS (SELECT :'config'::jsonb AS c),
    upsert_project AS (
      INSERT INTO control.projects (
        slug,display_name,repository_path,github_repository,integration_branch,production_branch,
        local_repository_root,worktree_root,application_paths,stack_strategy,allowed_publication_paths,
        verification_config,local_database_strategy,codex_enabled,default_model_profile,retry_policy_id,
        concurrency_policy,n8n_metadata,environment_routing,active,metadata
      ) SELECT
        c->>'slug',c->>'display_name',COALESCE(c->>'repository_path',c->>'github_repository'),c->>'github_repository',
        c->>'integration_branch',c->>'production_branch',c->>'local_repository_root',c->>'worktree_root',
        COALESCE(c->'application_paths','{}'),COALESCE(c->'stack_strategy','{}'),COALESCE(c->'allowed_publication_paths','[]'),
        COALESCE(c->'verification_config','{}'),COALESCE(c->'local_database_strategy','{}'),COALESCE((c->>'codex_enabled')::boolean,true),
        c->>'default_model_profile',c->>'retry_policy_id',COALESCE(c->'concurrency_policy','{}'),COALESCE(c->'n8n_metadata','{}'),
        COALESCE(c->'environment_routing','{}'),COALESCE((c->>'active')::boolean,false),COALESCE(c->'metadata','{}')
      FROM input
      ON CONFLICT (slug) DO UPDATE SET
        display_name=EXCLUDED.display_name,repository_path=EXCLUDED.repository_path,github_repository=EXCLUDED.github_repository,
        integration_branch=EXCLUDED.integration_branch,production_branch=EXCLUDED.production_branch,
        local_repository_root=EXCLUDED.local_repository_root,worktree_root=EXCLUDED.worktree_root,
        application_paths=EXCLUDED.application_paths,stack_strategy=EXCLUDED.stack_strategy,
        allowed_publication_paths=EXCLUDED.allowed_publication_paths,verification_config=EXCLUDED.verification_config,
        local_database_strategy=EXCLUDED.local_database_strategy,codex_enabled=EXCLUDED.codex_enabled,
        default_model_profile=EXCLUDED.default_model_profile,retry_policy_id=EXCLUDED.retry_policy_id,
        concurrency_policy=EXCLUDED.concurrency_policy,n8n_metadata=EXCLUDED.n8n_metadata,
        environment_routing=EXCLUDED.environment_routing,active=EXCLUDED.active,metadata=EXCLUDED.metadata
      RETURNING *
    ), compatibility_suits AS (
      INSERT INTO control.suits(slug,display_name,stack_key,app_path,status,metadata)
      SELECT CASE WHEN p.slug='building-suit' THEN w->>'slug' ELSE p.slug||'-'||(w->>'slug') END,
        COALESCE(w->>'display_name',w->>'slug'),w->>'stack_key',w->>'application_path','active',
        jsonb_build_object('compatibility_project',p.slug,'compatibility_workstream',w->>'slug')
      FROM upsert_project p, input, jsonb_array_elements(input.c->'workstreams') w
      ON CONFLICT (slug) DO UPDATE SET display_name=EXCLUDED.display_name,stack_key=EXCLUDED.stack_key,app_path=EXCLUDED.app_path
      RETURNING slug
    ), upsert_workstreams AS (
      INSERT INTO control.workstreams(project_id,slug,display_name,stack_key,application_path,suit_slug,retry_policy_id,model_profile,concurrency_policy,verification_config,publication_config,active,metadata)
      SELECT p.project_id,w->>'slug',COALESCE(w->>'display_name',w->>'slug'),w->>'stack_key',w->>'application_path',
        CASE WHEN p.slug='building-suit' THEN w->>'slug' ELSE p.slug||'-'||(w->>'slug') END,
        w->>'retry_policy_id',w->>'model_profile',COALESCE(w->'concurrency_policy','{"serialized":true}'),
        COALESCE(w->'verification_config','{}'),COALESCE(w->'publication_config','{}'),COALESCE((w->>'active')::boolean,true),COALESCE(w->'metadata','{}')
      FROM upsert_project p, input, jsonb_array_elements(input.c->'workstreams') w
      ON CONFLICT (project_id,slug) DO UPDATE SET display_name=EXCLUDED.display_name,stack_key=EXCLUDED.stack_key,
        application_path=EXCLUDED.application_path,retry_policy_id=EXCLUDED.retry_policy_id,model_profile=EXCLUDED.model_profile,
        concurrency_policy=EXCLUDED.concurrency_policy,verification_config=EXCLUDED.verification_config,
        publication_config=EXCLUDED.publication_config,active=EXCLUDED.active,metadata=EXCLUDED.metadata
      RETURNING *
    ), audit AS (
      INSERT INTO control.audit_events(project_id,action,source,new_value)
      SELECT project_id,'project_saved','human',to_jsonb(upsert_project) FROM upsert_project
      RETURNING audit_id
    )
    SELECT jsonb_build_object('ok',true,'project',(SELECT to_jsonb(p) FROM upsert_project p),
      'workstreams',(SELECT jsonb_agg(to_jsonb(w) ORDER BY w.slug) FROM upsert_workstreams w));
  `, { config: JSON.stringify(validated) })
}

function taskBundle(taskId) {
  return query(`SELECT jsonb_build_object(
    'task',control.generic_task_packet(:'task_id'),
    'executions',COALESCE((SELECT jsonb_agg(to_jsonb(e) ORDER BY e.attempt) FROM control.executions e WHERE e.task_id=:'task_id'),'[]'),
    'verification',COALESCE((SELECT jsonb_agg(to_jsonb(v) ORDER BY v.verification_id) FROM control.verification_results v JOIN control.executions e USING(execution_id) WHERE e.task_id=:'task_id'),'[]'),
    'failures',COALESCE((SELECT jsonb_agg(to_jsonb(f) ORDER BY f.created_at) FROM control.failures f WHERE f.task_id=:'task_id'),'[]'),
    'events',COALESCE((SELECT jsonb_agg(to_jsonb(ev) ORDER BY ev.event_id) FROM control.task_events ev WHERE ev.task_id=:'task_id'),'[]'));
  `, { task_id: taskId })
}

function diagnosticPrompt(bundle, mode = 'chatgpt') {
  const safe = redact(bundle)
  const task = safe.task?.task ?? {}
  const executions = safe.executions ?? []
  const latest = executions.at(-1) ?? {}
  const failures = (safe.verification ?? []).filter(item => ['fail', 'not_run'].includes(item.status))
  const common = [
    `Project: ${safe.task?.project?.display_name ?? safe.task?.project?.slug ?? 'unknown'}`,
    `Workstream: ${safe.task?.workstream?.slug ?? task.suit_slug ?? 'unknown'}`,
    `Task: ${task.task_id} — ${task.title}`,
    `Status: ${task.status}; attempt: ${latest.attempt ?? 0}/${safe.task?.retry_policy?.max_attempts ?? 'unknown'}`,
    `Profile/model/reasoning: ${latest.model_profile ?? 'unresolved'} / ${latest.model_name ?? 'unresolved'} / ${latest.reasoning_effort ?? 'unresolved'}`,
    `Retry policy: ${JSON.stringify(safe.task?.retry_policy ?? {})}`,
    `Branch/worktree/parent: ${latest.branch_name ?? 'none'} / ${latest.worktree_path ?? 'none'} / ${latest.parent_branch ?? 'none'}@${latest.parent_sha ?? 'none'}`,
    `Verification failures: ${JSON.stringify(failures.slice(-10))}`,
    `Previous attempts: ${JSON.stringify(executions.map(item => ({ attempt:item.attempt,status:item.status,profile:item.model_profile,model:item.model_name,reasoning:item.reasoning_effort })))}`,
  ]
  if (mode === 'chatgpt') return `${common.join('\n')}\n\nExplain the failure and recommend the safest next action without restarting completed work.`
  const purpose = mode.replaceAll('-', ' ')
  return `${common.join('\n')}\n\nPerform ${purpose} for this task in the existing worktree. Preserve already-correct work and fix recorded failures only. Do not expand scope. Do not create a branch or worktree. Do not commit, push, merge, deploy, or modify a hosted database. Run only focused local checks and leave final verification to the control plane.`
}

async function main() {
  if (resource === 'project' && action === 'list') return output({ ok: true, projects: projectList() })
  if (resource === 'project' && action === 'show') return output({ ok: true, ...projectShow(positional()) })
  if (resource === 'project' && ['add','edit'].includes(action)) return output(saveProject(loadJson(positional()), positionals.includes('--dry-run')))
  if (resource === 'project' && action === 'disable') return output({ ok: true, project: query(`UPDATE control.projects SET active=false WHERE slug=:'slug' RETURNING to_jsonb(control.projects);`, { slug: positional() }) })
  if (resource === 'workstream' && action === 'list') return output({ ok: true, workstreams: query(`SELECT COALESCE(jsonb_agg(to_jsonb(w) ORDER BY w.slug),'[]') FROM control.workstreams w JOIN control.projects p USING(project_id) WHERE p.slug=:'slug';`, { slug: positional() }) })

  if (resource === 'policy' && action === 'list') return output({ ok: true, policies: query(`SELECT COALESCE(jsonb_agg(to_jsonb(r) ORDER BY policy_id),'[]') FROM control.retry_policies r;`) })
  if (resource === 'policy' && action === 'show') return output({ ok: true, policy: query(`SELECT to_jsonb(r) FROM control.retry_policies r WHERE policy_id=:'id';`, { id: positional() }) })
  if (resource === 'policy' && ['create','edit'].includes(action)) {
    const policy = validateRetryPolicy(loadJson(positional()))
    if (positionals.includes('--dry-run')) return output({ ok: true, dry_run: true, policy })
    return output({ ok: true, policy: query(`INSERT INTO control.retry_policies(policy_id,display_name,max_attempts,attempt_profiles,metadata) VALUES(:'id',:'name',:'max'::int,:'profiles'::jsonb,:'metadata'::jsonb) ON CONFLICT(policy_id) DO UPDATE SET display_name=EXCLUDED.display_name,max_attempts=EXCLUDED.max_attempts,attempt_profiles=EXCLUDED.attempt_profiles,metadata=EXCLUDED.metadata RETURNING to_jsonb(control.retry_policies);`, { id:policy.policy_id,name:loadJson(positional()).display_name ?? policy.policy_id,max:String(policy.max_attempts),profiles:JSON.stringify(policy.attempt_profiles),metadata:JSON.stringify(loadJson(positional()).metadata ?? {}) }) })
  }
  if (resource === 'policy' && action === 'assign') {
    const policyId = positional(0); const scope = flag('scope'); const target = flag('target')
    const statements = {
      global: `UPDATE control.platform_settings SET value=to_jsonb(:'policy'::text),updated_at=now() WHERE setting_key='global_retry_policy' RETURNING value`,
      project: `UPDATE control.projects SET retry_policy_id=:'policy' WHERE slug=:'target' RETURNING to_jsonb(control.projects)`,
      workstream: `UPDATE control.workstreams w SET retry_policy_id=:'policy' FROM control.projects p WHERE w.project_id=p.project_id AND (p.slug||'/'||w.slug)=:'target' RETURNING to_jsonb(w)`,
      task: `UPDATE control.tasks SET retry_policy_id=:'policy' WHERE task_id=:'target' RETURNING to_jsonb(control.tasks)`,
    }
    if (!statements[scope]) throw new Error('scope_must_be_global_project_workstream_or_task')
    return output({ ok: true, assignment: query(statements[scope], { policy:policyId,target:target ?? '' }) })
  }

  if (resource === 'task' && action === 'list') return output({ ok: true, tasks: query(`SELECT COALESCE(jsonb_agg(to_jsonb(x) ORDER BY x.priority,x.sequence,x.task_id),'[]') FROM (SELECT t.*,p.slug project_slug FROM control.tasks t LEFT JOIN control.projects p USING(project_id) WHERE (:'project'='' OR p.slug=:'project') AND (:'workstream'='' OR t.workstream_slug=:'workstream') AND (:'status'='' OR t.status=:'status')) x;`, { project:flag('project',''),workstream:flag('workstream',''),status:flag('status','') }) })
  if (resource === 'task' && ['show','inspect'].includes(action)) return output({ ok: true, bundle: redact(taskBundle(positional())) })
  if (resource === 'task' && action === 'next') return delegate('task-next', resolveWorkstreamRef(positional()))
  if (resource === 'task' && action === 'claim') return delegate('task-claim', resolveWorkstreamRef(positional()))
  if (resource === 'task' && action === 'create') {
    const task = loadJson(positional())
    if (!/^[A-Z][A-Z0-9-]{2,63}$/.test(String(task.task_id ?? ''))) throw new Error('invalid_task_id')
    const [projectSlug, workstreamSlug] = String(task.workstream ?? '').split('/',2)
    if (!projectSlug || !workstreamSlug) throw new Error('workstream_must_be_project_slash_workstream')
    return output({ ok:true,task:query(`
      WITH target AS (SELECT p.project_id,w.slug workstream_slug,w.suit_slug FROM control.projects p JOIN control.workstreams w USING(project_id) WHERE p.slug=:'project' AND w.slug=:'workstream' AND p.active=true AND w.active=true),
      inserted AS (
        INSERT INTO control.tasks(task_id,suit_slug,project_id,workstream_slug,sequence,priority,title,description,task_type,risk_level,model_profile,status,acceptance_criteria,verification_plan,retry_policy_id,metadata)
        SELECT :'task_id',suit_slug,project_id,workstream_slug,:'sequence'::int,:'priority'::int,:'title',:'description',:'task_type',:'risk_level',:'model_profile','planned',:'acceptance'::jsonb,:'verification'::jsonb,NULLIF(:'retry_policy',''),:'metadata'::jsonb FROM target
        RETURNING *
      )
      SELECT to_jsonb(inserted) FROM inserted;
    `,{project:projectSlug,workstream:workstreamSlug,task_id:task.task_id,sequence:String(task.sequence??1000),priority:String(task.priority??100),title:String(task.title??''),description:String(task.description??''),task_type:task.task_type??'feature',risk_level:task.risk_level??'normal',model_profile:task.model_profile??'standard',acceptance:JSON.stringify(task.acceptance_criteria??[]),verification:JSON.stringify(task.verification_plan??[]),retry_policy:task.retry_policy_id??'',metadata:JSON.stringify(task.metadata??{})}) })
  }
  if (resource === 'task' && action === 'release') return delegate('task-release', positional())
  if (resource === 'task' && ['prepare','run','verify','retry','publish','engine'].includes(action)) return delegate(`task-${action}`, positional())
  if (resource === 'task' && action === 'resume') return delegate('task-engine', positional())
  if (resource === 'task' && ['reverify','reopen-verification'].includes(action)) {
    const id = positional(); query(`SELECT control.reopen_verification(:'task','human',:'reason');`, { task:id,reason:String(flag('reason','operator requested reverification')) })
    return action === 'reverify' ? delegate('task-verify', id) : output({ ok:true,task_id:id,status:'verification' })
  }
  if (resource === 'task' && action === 'cancel') return output({ ok:true,result:query(`SELECT control.cancel_task(:'task','human',:'reason');`,{ task:positional(),reason:String(flag('reason','operator requested cancellation')) }) })
  if (resource === 'task' && action === 'reparent') {
    const result = run(process.execPath, ['tooling/control-plane/runner/task-reparent.mjs', positional(), ...(positionals.includes('--to-current-parent') ? ['--to-current-parent'] : []), ...(positionals.includes('--dry-run') ? ['--dry-run'] : [])], { timeout: 20*60*1000 })
    process.stdout.write(`${result.stdout || JSON.stringify({ok:false,error:result.stderr||result.error})}\n`); process.exitCode=result.code; return
  }

  if (resource === 'execution' && action === 'list') return output({ ok:true,executions:query(`SELECT COALESCE(jsonb_agg(to_jsonb(e) ORDER BY e.attempt),'[]') FROM control.executions e WHERE e.task_id=:'task';`,{task:positional()}) })
  if (resource === 'execution' && action === 'show') return output({ ok:true,execution:query(`SELECT to_jsonb(e) FROM control.executions e WHERE execution_id=:'id'::bigint;`,{id:positional()}) })
  if (resource === 'verification' && action === 'show') return output({ok:true,checks:query(`SELECT COALESCE(jsonb_agg(to_jsonb(v) ORDER BY v.verification_id),'[]') FROM control.verification_results v WHERE execution_id=:'id'::bigint;`,{id:positional()})})
  if (resource === 'verification' && action === 'failures') return output({ok:true,checks:query(`SELECT COALESCE(jsonb_agg(to_jsonb(v) ORDER BY v.verification_id),'[]') FROM control.verification_results v WHERE execution_id=:'id'::bigint AND status IN('fail','not_run');`,{id:positional()})})
  if (resource === 'run' && action === 'start') return delegate('run-start', [resolveWorkstreamRef(positional(0)), positional(1)])
  if (resource === 'run' && action === 'inspect') return delegate('run-check', positional())
  if (resource === 'run' && action === 'stop') return delegate('run-stop', resolveWorkstreamRef(positional()))
  if (resource === 'run' && action === 'finish') return delegate('run-finish', [positional(0), positional(1)])
  if (resource === 'error' && action === 'bundle') return output({ ok:true,bundle:redact(taskBundle(positional())) })
  if (resource === 'prompt' && ['implementation','repair','inspection','verification-diagnosis','publication-diagnosis','chatgpt'].includes(action)) return output({ ok:true,prompt:diagnosticPrompt(taskBundle(positional()),action) })

  if (resource === 'n8n' && action === 'export') return delegateN8nExport()
  if (resource === 'n8n' && action === 'inspect') {
    const file = path.resolve(repoRoot,'.local/automation/n8n/workflows.normalized.json')
    if (!existsSync(file)) throw new Error('run automation n8n export first')
    return output({ok:true,snapshot:JSON.parse(readFileSync(file,'utf8'))})
  }
  if (resource === 'n8n' && action === 'diff') {
    const file = path.resolve(repoRoot,'.local/automation/n8n/recommended-changes.json')
    if (!existsSync(file)) throw new Error('run automation n8n export first')
    return output({ok:true,inspection:JSON.parse(readFileSync(file,'utf8')),running_workflows_modified:false})
  }
  throw new Error('unknown_command')
}

function delegateN8nExport() {
  const result = run(process.execPath,['tooling/control-plane/n8n/export.mjs',...positionals],{timeout:5*60*1000})
  process.stdout.write(`${result.stdout || JSON.stringify({ok:false,error:result.stderr||result.error})}\n`)
  process.exitCode=result.code
}

main().catch(error => output({ ok:false,command:[resource,action].filter(Boolean).join(' '),error:error.message },1))
