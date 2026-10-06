import {reconcileFailureEvidence} from './failure-evidence.mjs'
import {redactText} from '../lib/redaction.mjs'
import {existsSync,readFileSync,mkdirSync,realpathSync,readdirSync} from 'node:fs'
import path from 'node:path'
import {createHash} from 'node:crypto'
const digest=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex')
export function emptyComponentFixture(root,check,create=false){
 if(check.name!=='ledger-shared-ui-tests'||!/ENOENT/.test(check.summary??'')||!/app\/components/.test(check.summary??''))return null
 const testFile=path.join(root,'apps/ledger-suit/tests/unit/shared-ui-migration.test.mjs'),directory=path.join(root,'apps/ledger-suit/app/components'),manifestFile=path.join(root,'docs/shared/ui-ownership-manifest.json')
 if(!existsSync(testFile)||!existsSync(manifestFile))return null
 const source=readFileSync(testFile,'utf8'),manifest=JSON.parse(readFileSync(manifestFile,'utf8'))
 if(!source.includes('readdirSync(directory')||!source.includes("assert.deepEqual(actual, []")||manifest.components.some(c=>c.path.startsWith('apps/ledger-suit/')))return null
 if(existsSync(directory)&&readdirSync(directory).length)return null
 const app=path.join(root,'apps/ledger-suit/app')
 if(!realpathSync(app).startsWith(realpathSync(root)+path.sep))return null
 if(create&&!existsSync(directory))mkdirSync(directory,{mode:0o700})
 return {kind:'optional-empty-component-scan-fixture',directory:'apps/ledger-suit/app/components',test_sha:digest(source),manifest_sha:digest(manifest),assertions_preserved:true}
}
function correctedLocaleSelector(root,check){
 if(check.name!=='shared-catalogue-browser'||!String(check.summary).includes("name: 'العربية'"))return null
 const file=path.join(root,'packages/testing/e2e/shared-ui.spec.ts')
 if(!existsSync(file))return null
 const source=readFileSync(file,'utf8')
 if(!source.includes("name: 'ar', exact: true")||!source.includes("toHaveAttribute('dir', 'rtl')"))return null
 return {kind:'corrected-verifier-locale-selector',test_sha:digest(source),rtl_assertion_preserved:true}
}
export function auditAttempts(snapshot){
 const executions=snapshot.executions??[],failures=snapshot.failures??[],results=snapshot.verification_results??[]
 const entries=executions.filter(e=>e.status!=='running').flatMap(e=>{
  const fs=failures.filter(f=>Number(f.execution_id)===Number(e.execution_id));const latest=fs.at(-1)
  let checks=latest?.metadata?.verification_probe?.checks??latest?.metadata?.checks??e.metadata?.verification_probe_failures
  if(!checks?.length)checks=results.filter(r=>Number(r.execution_id)===Number(e.execution_id)).map(r=>({...r,...r.metadata}))
  const verification=(snapshot.verification_runs??[]).filter(v=>Number(v.execution_id)===Number(e.execution_id)&&!['running','passed'].includes(v.status)).at(-1)
  const structured=results.filter(r=>Number(r.execution_id)===Number(e.execution_id)&&r.verification_run_id===verification?.verification_run_id&&r.metadata?.failure_evidence)
  if(structured.length)checks=structured.map(r=>({...r,...r.metadata,name:r.check_name}))
  checks=(checks??[]).filter(c=>c.required!==false&&['fail','not_run','unavailable'].includes(c.status))
  if(!latest&&!checks.length&&e.status==='succeeded')return []
  let classification='UNKNOWN',proof=null
  const text=checks.map(c=>c.summary??'').join('\n')+'\n'+(latest?.error_code??'')
  const bound=checks.map(c=>reconcileFailureEvidence(c,e,verification??{verification_run_id:c.verification_run_id}))
  if(bound.length&&bound.every(b=>b.evidence&&b.classification!=='UNKNOWN')){classification=bound.some(b=>b.classification==='PRODUCT_DEFECT')?'PRODUCT_DEFECT':bound[0].classification;proof=bound.map(b=>b.evidence)}
  else if(bound.some(b=>b.evidence&&b.classification==='UNKNOWN'))classification='UNKNOWN'
  else if(checks.length&&checks.every(c=>emptyComponentFixture(e.worktree_path,c)||correctedLocaleSelector(e.worktree_path,c))){classification='VERIFIER_INFRA';proof=checks.map(c=>emptyComponentFixture(e.worktree_path,c)||correctedLocaleSelector(e.worktree_path,c))}
  else if(/E2BIG|worker_spawn|ECONNREFUSED|EADDRINUSE/.test(text))classification='TRANSIENT_INFRASTRUCTURE'
  else if(checks.length&&checks.every(c=>['verification-configuration','CONFIGURATION'].includes(c.failure_class)||c.status==='not_run'&&/binding|unenforced|configuration/.test(c.selection_reason??'')))classification='CONFIGURATION'
  else if(checks.length&&checks.every(c=>['verification-infrastructure','verification-lifecycle','VERIFIER_INFRA'].includes(c.failure_class)))classification='VERIFIER_INFRA'
  else if(latest?.failure_class==='repository-state')classification='REPOSITORY_WORKTREE'
  else if(latest?.failure_class==='publication-reconciliation')classification='PUBLICATION_INFRA'
  else if(checks.some(c=>c.status==='fail'&&/AssertionError|assertion failed|Error: expect\(|ERR_ASSERTION|✖.*assert/i.test(c.summary??''))&&!/ENOENT|EACCES|spawn|ECONN|EADDR/.test(text))classification='PRODUCT_DEFECT'
  const blocking_checks=checks.map(c=>({name:c.name,status:c.status,summary:redactText(c.summary??'').slice(0,2500),failure_class:c.failure_class,failure_evidence:c.metadata?.failure_evidence??c.failure_evidence??null}))
  return [{execution_id:e.execution_id,attempt:e.attempt,classification,charged:classification==='PRODUCT_DEFECT',blocking_checks,proof,root_cause:proof?.some(p=>p.version===2)?proof.map(p=>p.review?.root_cause).filter(Boolean).join('; '):proof?'Legacy migration test scans a removed optional components directory without provisioning its empty fixture.':blocking_checks[0]?.summary??latest?.error_code??'Failure evidence requires investigation'}]
 })
 const max=snapshot.packet?.retry_policy?.max_attempts??snapshot.policy?.max_attempts??5,consumed=entries.filter(e=>e.charged).length
 const unknown=entries.some(e=>e.classification==='UNKNOWN'),nonproduct=entries.some(e=>!e.charged&&e.classification!=='UNKNOWN')
 const action=unknown?'investigate':entries.at(-1)?.charged&&consumed>=max?'operator-gate':nonproduct?'same-attempt-recovery':'product-repair'
 const latest=entries.at(-1),task=snapshot.packet?.task?.task_id??snapshot.task?.task_id
 return {version:1,entries,consumed,max_attempts:max,all_attempts_audited:true,action,root_cause:latest?.root_cause??'No failed evidence',failed_check:latest?.blocking_checks[0]?.name??'Implementation failure',remaining_product_defect:entries.filter(e=>e.charged).at(-1)?.root_cause??null,automatic_repair_blocker:action==='operator-gate'?'All configured product repair slots have demonstrated product failures.':null,required_authorization:action==='operator-gate'?`Authorize one additional bounded product-repair attempt for ${task} only, with a task-specific maximum of ${max+1}, preserving the existing run and all history; no merge or deployment.`:null,fingerprint:digest(entries)}
}
export function exhaustionHealth(a){
 if(!a?.all_attempts_audited)return {needs:false,why:'Retry exhaustion requires automatic evidence audit',next:'Dot must audit every consumed attempt'}
 return {needs:a.action==='operator-gate',why:a.root_cause,next:a.required_authorization??(a.action==='investigate'?'Codex must investigate the unknown failure':'Dot must recover and reverify the same execution')}
}
