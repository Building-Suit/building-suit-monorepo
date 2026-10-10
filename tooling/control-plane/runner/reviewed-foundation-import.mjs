import {queueDraftSourcePaths} from './draft-source-policy.mjs'
// Exact owner-authorized Foundation import. This is source-only authority, not
// a protected-operation approval. Changed content requires another review.
export const foundationImport = Object.freeze({
 task_id:'SS-LAUNCH-REALTIME-001', execution_id:335, verification_run_id:380,
 parent_sha:'786b92b77a8c4b8b17be59ddeb394d851650b9ed', contract_id:17873,
 authorization_id:723, foundation_commit:'48ac8fb1ff44da62f283aa646d3fcf2753f6d4b9',
 files:Object.freeze({
  'packages/contracts/src/index.ts':'291f86a5c0667e603f049b0a8e15bab255b31f45',
  'packages/data-access/src/index.ts':'0a768c25d63217619bbcc684b216a8fb0a45e427',
  'packages/data-access/src/realtime.ts':'a4cfc2b2769c6b17fcaa8324c8e7152b501846de',
  'pnpm-lock.yaml':'5f0c8b59705707f0f72f086d679e85a1e3b4ba7f',
 })
})
export function reviewedFoundationImportPaths({task,execution,verification,objects,authorizations,contract,authority,projectPaths}) {
 const review=foundationImport, paths=Object.keys(review.files)
 if(task?.task_id!==review.task_id || Number(execution?.execution_id)!==review.execution_id || execution?.parent_sha!==review.parent_sha || Number(verification?.verification_run_id)!==review.verification_run_id || Number(contract?.contract_id)!==review.contract_id) return []
 const approval=(authorizations??[]).find(a=>Number(a.authorization_id)===review.authorization_id && Number(a.contract_id)===review.contract_id && a.authorization_kind==='ordinary' && a.source==='human' && !a.revoked_at)
 if(!approval || paths.some(file=>!approval.authorized_paths?.includes(file) || !contract.required_paths?.includes(file) || objects?.[file]!==review.files[file] || !verification?.verified_state?.files?.some(f=>f.file===file && f.object===review.files[file]))) return []
 // Reuse authenticated current frozen-queue policy, exact verification/parent/
 // fingerprint binding and Draft-only restrictions. No task scope is widened.
 const imports=paths.filter(file=>file.startsWith('packages/'))
 const current=queueDraftSourcePaths({authority,task,execution,verification,taskPaths:imports,projectPaths})
 return imports.every(file=>current.includes(file)) ? imports : []
}
