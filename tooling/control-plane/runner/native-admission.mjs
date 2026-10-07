import {pathInScope} from './publication-preflight.mjs'
import {evaluatePublicationReadiness} from './publication-readiness.mjs'
import {resolveVerificationPlan} from './verification-mode.mjs'
import {mergeVerificationConfig} from '../lib/workstream-readiness.mjs'
export function admissionDiagnostic(d){
 if(!d)return {state:'WAITING_ADMISSION',needs:false,why:'No admitted task; registered queue requires admission diagnostics',next:'Dot must inspect registered pending work and persist an owned recovery incident'}
 if(d.dependencies?.length)return {state:'WAITING_DEPENDENCY',needs:d.dependencies.some(p=>!p.owned),why:'Unresolved prerequisite: '+d.dependencies.map(p=>`${p.task_id} (${p.status})`).join(', '),next:d.dependencies.some(p=>!p.owned)?'Authorize or resolve the named prerequisite; dependency gates remain enforced':'Owning run must finish the named prerequisite'}
 if(d.decisions?.length)return {state:'WAITING_OPERATOR',needs:true,why:'Blocking decision: '+d.decisions.map(x=>`${x.decision_id} (${x.status})`).join(', '),next:'Approve the named registered decision'}
 const p=d.packet,b=p?.publication_boundaries??{},contract=p?.publication_contract
 const outside=(contract?.unresolved_scopes??[]).filter(scope=>!pathInScope(scope.replace(/[?*[{].*$/,''),b.workstream_paths??[]))
 if(outside.length)return {state:'WAITING_OPERATOR',needs:true,why:`Publication scope requires authorization for ${d.task_id}: ${outside.join(', ')}`,next:'Resolve the named registered cross-workstream publication scope; Dot cannot grant new scope'}
 const readiness=evaluatePublicationReadiness({contract,taskPaths:b.task_paths,sourcePaths:b.source_paths,workstreamPaths:b.workstream_paths,projectPaths:b.project_paths,ordinaryAuthorizations:p?.publication_authorizations?.ordinary,protectedAuthorizations:p?.publication_authorizations?.protected})
 if(['exact_authorization_required','protected_authorization_required','outside_project_boundary'].includes(readiness.classification))return {state:'WAITING_OPERATOR',needs:true,why:`${readiness.classification} for ${d.task_id}: ${[...readiness.exact_authorization_required,...readiness.protected_authorization_required,...readiness.outside_project_boundary].join(', ')}`,next:'Resolve the exact recorded publication authorization/boundary gate'}
 const config=mergeVerificationConfig(p?.project?.verification_config,p?.workstream?.verification_config)
 const plan=resolveVerificationPlan({entries:p?.task?.verification_plan??[],configuredCommands:config.commands,legacyMappings:config.legacy_plan_mappings,phase:'pre_implementation'})
 return {state:'WAITING_ADMISSION',needs:false,why:!d.publication_current?`Admission contract stale/unresolved for ${d.task_id}`:plan.unenforced.length||plan.blockers.length?`Executable verification bindings require reconciliation for ${d.task_id}`:`Eligible task ${d.task_id} has not been acquired`,next:'Dot must reconcile admission/configuration and acquire this task on the same run',missing_bindings:plan.unenforced,blockers:plan.blockers}
}
export const registryBindings={
 task_id:'SAS-M1-REGISTRY-001',entries:[
 'Unit tests with multiple database-driven Suit/capability fixtures including unknown/disabled records.',
 'Browser tests for two Suits, active indicator, context menu change, RTL and narrow screens.',
 'Super Admin typecheck/lint/build.',
 'Static inspection for hard-coded Suit/menu configuration.',
 'git diff --check.'
 ],commands:[
 {name:'sas-registry-unit',program:'node',args:['--test','apps/super-admin-suit/tests/unit/registry.test.mjs'],required:true,capabilities:['database']},
 {name:'sas-registry-browser',program:'pnpm',args:['--filter','@building-suit/super-admin-suit','exec','playwright','test','tests/e2e/registry.spec.ts','--workers=1','--retries=0'],required:true,capabilities:['browser']}
 ]
}
export function reviewedAdmissionBindings(d){
 if(d?.task_id!==registryBindings.task_id||JSON.stringify(d.packet?.task?.verification_plan)!==JSON.stringify(registryBindings.entries))return null
 const [unit,browser,quality,inspection]=registryBindings.entries
 return {commands:registryBindings.commands,legacy_plan_mappings:{
 [unit]:{version:2,kind:'command',command:'sas-registry-unit',requires:['database']},
 [browser]:{version:2,kind:'command',command:'sas-registry-browser',requires:['browser']},
 [quality]:{version:2,kind:'command',command:'super-admin-quality',requires:['typecheck','lint','build']},
 [inspection]:{version:2,kind:'command',command:'sas-registry-unit'}
 }}
}
