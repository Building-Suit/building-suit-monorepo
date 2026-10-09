import {readBoundArtifact} from './trusted-verifier-receipt.mjs'
import {recoveryFingerprint,canonicalFailure} from './lifecycle-policy.mjs'
import {spawnSync} from 'node:child_process'
import {createHash} from 'node:crypto'
import {readFileSync,existsSync} from 'node:fs'
import path from 'node:path'
// Preparation observations do not authorize another verification. Only the
// declared schema/prerequisite identity and outcome are executable inputs.
function stablePreparation(value){
 const observationKeys=new Set(['prepared_at','created_at','updated_at','observed_at','started_at','finished_at','duration_ms','timestamp'])
 const normalize=v=>Array.isArray(v)?v.map(normalize):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().filter(k=>!observationKeys.has(k)).map(k=>[k,normalize(v[k])])):v
 return JSON.stringify(normalize(value))
}
export function recoveryActionInput(snapshot,action,sourceRoot){
 const execution=snapshot.executions?.at(-1),verification=snapshot.verification_runs?.filter(v=>Number(v.execution_id)===Number(execution?.execution_id)).at(-1)
 const checks=(snapshot.verification_results??[]).filter(c=>Number(c.verification_run_id)===Number(verification?.verification_run_id)&&c.metadata?.required!==false&&['fail','not_run','unavailable'].includes(c.status))
 const audit=snapshot.exhaustion_audit?.entries?.find(e=>Number(e.execution_id)===Number(execution?.execution_id))
 const adoption=snapshot.authoritative_failure?.evidence
 const classification=adoption?.adoption_materialization===true&&Number(adoption.verification_run_id)===Number(verification?.verification_run_id)?'VERIFIER_INFRA':canonicalFailure({trusted:audit?.proof?.filter(p=>p.version===2)??[],legacy:snapshot.failures?.filter(f=>!f.resolved_at&&f.execution_id===execution?.execution_id).at(-1)?.failure_class})
 const command=spawnSync('git',['diff','HEAD','--binary'],{cwd:execution?.worktree_path,encoding:'utf8',maxBuffer:32*1024*1024})
 if(command.status!==0)throw Error('recovery_source_fingerprint_unavailable')
 const head=spawnSync('git',['rev-parse','HEAD'],{cwd:execution.worktree_path,encoding:'utf8'})
 const tracked=spawnSync('git',['ls-files','--others','--exclude-standard','-z'],{cwd:execution.worktree_path,encoding:'utf8'})
 if(head.status!==0||tracked.status!==0)throw Error('recovery_source_fingerprint_unavailable')
 const files=tracked.stdout.split('\0').filter(Boolean).sort().map(file=>[file,createHash('sha256').update(readFileSync(path.join(execution.worktree_path,file))).digest('hex')])
 const verifierFiles=['task-verifier.mjs','verification-command-identity.mjs','verification-mode.mjs'].map(file=>{const full=path.join(sourceRoot,'tooling/control-plane/runner',file);return [file,existsSync(full)?createHash('sha256').update(readFileSync(full)).digest('hex'):null]})
 const database=snapshot.packet.workstream?.verification_config?.database??snapshot.packet.project?.verification_config?.database
 const preparation='.local/verification-inputs/database-preparation.json'
 const prepared=database?.kind==='supabase-local'&&database.local_only===true&&existsSync(path.join(execution.worktree_path,preparation))?[preparation]:[]
 const declared=[...prepared,...(snapshot.packet.project?.verification_config?.evidence_inputs??[]),...(snapshot.packet.workstream?.verification_config?.evidence_inputs??[])]
 if(declared.length>32||declared.some(f=>typeof f!=='string'||!/^\.local\/verification-inputs\/[a-zA-Z0-9_./-]+$/.test(f)||f.split('/').includes('..')))throw Error('bounded_verification_evidence_inputs_required')
 const evidenceInputs=[...new Set(declared)].sort().map(file=>{const full=path.join(execution.worktree_path,file);if(!existsSync(full))return [file,null];const bytes=readBoundArtifact(full,execution.worktree_path);if(bytes.length>65536)throw Error('verification_evidence_input_budget_exceeded');const semantic=file===preparation?stablePreparation(JSON.parse(bytes)):bytes;return [file,createHash('sha256').update(semantic).digest('hex')]})
 const input={task_id:snapshot.packet.task.task_id,run_id:snapshot.workflow_run?.run_id,execution_id:execution.execution_id,attempt:execution.attempt,source:{head:head.stdout.trim(),diff:command.stdout,files},plan:snapshot.packet.task.verification_plan,configuration:{project:snapshot.packet.project?.verification_config,workstream:snapshot.packet.workstream?.verification_config,binding:snapshot.binding_recovery?{classification:snapshot.binding_recovery.classification,command:snapshot.binding_recovery.command,runner_sha256:snapshot.binding_recovery.runner_sha256,checks:snapshot.binding_recovery.checks}:null,evidence_inputs:evidenceInputs},verifier:verifierFiles,classification,checks:checks.map(c=>({name:c.check_name,status:c.status,command:c.command,exit_code:c.exit_code,classification:c.metadata?.failure_evidence?.classification,root_cause:c.metadata?.failure_evidence?.review?.root_cause}))}
 return {fingerprint:recoveryFingerprint(input),classification,evidence:{protocol:2,action,verification_run_id:verification?.verification_run_id,source_fingerprint:recoveryFingerprint({...input,classification:null,checks:[]}),failed_checks:input.checks,root_cause:[...new Set(input.checks.map(c=>c.root_cause).filter(Boolean))].join('; ')||null}}
}
