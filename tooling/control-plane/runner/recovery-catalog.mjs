import {createHash} from 'node:crypto'
export function semanticRecoveryCause(rootFamily,snapshot={}) {
 snapshot??={}
 const last=snapshot.executions?.at(-1),verification=snapshot.verification_runs?.at(-1)
 const failures=(snapshot.failed_checks??snapshot.checks??[]).filter(c=>['fail','not_run','unavailable'].includes(c.status))
 const semantic={version:1,root_family:rootFamily,component:snapshot.recovery?.component??null,
 failure_phase:snapshot.recovery?.failure_phase??null,error_code:snapshot.recovery?.error_code??null,
 task_phase:snapshot.packet?.task?.engine_stage??null,execution_status:last?.status??null,
 verification_status:verification?.status??null,configuration_fingerprint:snapshot.configuration_fingerprint??null,
 contract_fingerprint:snapshot.packet?.publication_contract?.contract_fingerprint??null,
 checks:failures.map(c=>({name:c.check_name??c.name,command_version:c.trusted_receipt?.command_version??null,status:c.status,category:c.failure_evidence?.classification??null})).sort((a,b)=>a.name.localeCompare(b.name))}
 return {semantic,cause_fingerprint:createHash('sha256').update(JSON.stringify(semantic)).digest('hex')}
}
export function catalogApplies(entry,context) {
 if(!entry||entry.root_family!==context.root_family||entry.cause_fingerprint!==context.cause_fingerprint)return false
 if(entry.handler_id!=='run-recover'||entry.handler_version!==1||entry.safety_boundary!=='existing-bounded-run')return false
 if(context.protocol!==entry.protocol||context.schema_version<entry.schema_min||context.schema_version>entry.schema_max)return false
 if(entry.regression_version!==context.regression_version||!entry.runtime_release||entry.runtime_release!==context.runtime_release)return false
 if(!entry.required_preconditions?.length||!entry.required_evidence?.length)return false
 return entry.required_preconditions.every(p=>context.preconditions?.[p]===true)&&entry.required_evidence.every(p=>context.evidence?.[p]===true)
}
export function recoveryOwner(persistedOwner,entry,context) {
 // Native handlers keep their guarded deterministic path. An exact learned
 // handler converts an unknown incident to Dot; mismatches never do so.
 const nativeFamilies=['publication-handoff','completion-credit','controller-acquisition','worker-transport','verifier-configuration','verifier-infrastructure','repository-reconciliation','transient-infrastructure','product-repair','timer-reconciliation','lease-reconciliation']
 // Legacy settlement can persist a coarse learned family as owner=Dot. That
 // row cannot turn an unknown semantic cause into a native handler.
 return catalogApplies(entry,context)||(persistedOwner==='Dot'&&nativeFamilies.includes(context.root_family))?'Dot':'Codex'
}
