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
 if(entry.regression_version!==context.regression_version||!entry.runtime_release)return false
 if(!entry.required_preconditions?.length||!entry.required_evidence?.length)return false
 return entry.required_preconditions.every(p=>context.preconditions?.[p]===true)&&entry.required_evidence.every(p=>context.evidence?.[p]===true)
}
