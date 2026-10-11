import {boundedVerificationReadiness} from './bounded-verification-readiness.mjs'
import {mergeVerificationConfig} from '../lib/workstream-readiness.mjs'

// This is a reviewed declaration of tests the remaining tasks must create.
// Existing broad checks never stand in for the feature behavior described by
// an obligation. No task, run, grant, or provider is changed by this module.
const recipes = {
 'SS-LAUNCH-CASH-POLICY-001':[['database'],['browser']],
 'SS-LAUNCH-BRAND-001':[['unit'],['unit']],
 'SS-LAUNCH-SUPPORT-001':[['unit','database'],['unit'],['browser']],
 'SS-LAUNCH-SOLO-VARIANTS-001':[['database'],['browser']],
 'SS-LAUNCH-POS-CUSTOMER-001':[['unit','browser'],['quality']],
 'SS-LAUNCH-FAST-PAY-001':[['database'],['browser']],
 'SS-LAUNCH-SALE-COPY-001':[['unit'],['unit','browser']],
 'SS-LAUNCH-SINGLE-SESSION-001':[['unit'],['unit','browser'],['unit']],
 'SS-LAUNCH-REALTIME-001':[['browser'],['unit','database']],
 'SS-LAUNCH-LEGAL-AUDIT-001':[['unit','browser']],
 'SS-VAL-001':[['unit','browser'],['unit']],
 'BS-REALTIME-FOUNDATION-001':[['unit']],
 'BS-REALTIME-ADOPTION-001':[['unit']],
 'BS-CHANGELOG-VERSION-001':[['unit'],['browser']],
 'BS-SA-FUTURE-SUIT-001':[['unit'],['unit'],['unit'],['quality']],
 'SAS-M1-SHOP-ADAPTER-001':[['unit'],['browser'],['quality'],['unit']],
 'SAS-M1-INSTAPAY-001':[['unit'],['database'],['browser'],['unit'],['quality']],
 'SAS-M1-BILLING-001':[['staging-evidence'],['unit','database'],['database'],['database'],['browser'],['quality']],
 'SAS-M1-CUSTOM-OFFER-001':[['database'],['database'],['browser'],['unit'],['quality']],
 'SAS-M1-AUDIT-001':[['unit'],['unit'],['unit'],['browser'],['quality']],
 'SAS-M1-GATE-001':[['staging-evidence'],['database'],['quality'],['unit','database','browser'],['unit'],['unit']],
}
const sharedExtras = {
 'BS-REALTIME-FOUNDATION-001':['workspace-check','ledger-build','shop-build'],
 'BS-REALTIME-ADOPTION-001':['workspace-check','root-typecheck','ledger-build','inventory-build','automation-build'],
 'BS-CHANGELOG-VERSION-001':['workspace-check','ledger-build','shop-build'],
 'BS-SA-FUTURE-SUIT-001':['workspace-check','root-typecheck','root-lint','docs-build','ledger-build','shop-build','inventory-build','automation-build'],
}
export function reviewRemainingPlans(rows,{sourceRoot}) {
 const reviewed=rows.map(row=>{
  const packet=structuredClone(row.packet),task=packet.task,id=task.task_id
  if(id==='SS-LAUNCH-TEAM-001')return {...row,packet,review:{unchanged:true,reason:'Already explicitly registered role/team database and browser checks'}}
  const recipe=recipes[id]
  if(!recipe||recipe.length!==task.verification_plan.length)throw Error('explicit_obligation_review_required:'+id)
  const app=id.startsWith('SS-')?'shop-suit':id.startsWith('SAS-')?'super-admin-suit':null
  const base=app?'apps/'+app:'packages/contracts'
  const slug=id.toLowerCase(),commands=[],originalPlan=task.verification_plan
  const config=mergeVerificationConfig(packet.project?.verification_config,packet.workstream?.verification_config)
  const known=new Set(config.commands.map(c=>c.name))
  const quality=app?app==='shop-suit'?'shop-quality':'super-admin-quality':'workspace-check'
  const additions=[]
  const register=(name,program,args,capabilities)=>{if(!known.has(name)){commands.push({name,program,args,capabilities,required:true,changed_paths:['__verification-plan-only__/'+name]});known.add(name)}additions.push(name)}
  if(['SS-LAUNCH-BRAND-001','SS-LAUNCH-POS-CUSTOMER-001'].includes(id))register('review-shared-ui-ux-tests','node',['--test','packages/ui/tests/foundation.test.mjs','packages/ux/tests/export.test.mjs'],['unit'])
  if(id==='BS-REALTIME-FOUNDATION-001'||id==='BS-REALTIME-ADOPTION-001')register('review-data-access-ux-tests','node',['--test','packages/data-access/tests/scope.test.mjs','packages/ux/tests/export.test.mjs'],['unit'])
  if(id==='SAS-M1-GATE-001'){
   register('review-workspace-check','pnpm',['check'],['workspace-boundaries'])
   register('review-root-quality','pnpm',['exec','turbo','run','typecheck','lint','build','--filter=@building-suit/super-admin-suit','--filter=@building-suit/shop-suit'],['typecheck','lint','build'])
   register('review-root-lint','pnpm',['lint'],['lint'])
   register('review-root-typecheck','pnpm',['typecheck'],['typecheck'])
   register('review-shop-database-regression','pnpm',['db:test:shop'],['database'])
   register('review-admin-database-regression','pnpm',['exec','supabase','--workdir','apps/super-admin-suit','test','db','--local'],['database'])
   register('review-shared-ui-tests','node',['--test','packages/ui/tests/foundation.test.mjs','packages/ux/tests/export.test.mjs'],['unit'])
  }
  const plan=recipe.map((kinds,index)=>{
   const output=[],refs=[],description=originalPlan[index]
   for(const kind of kinds){
    if(kind==='quality'){refs.push(quality);continue}
    const name=slug+'-obligation-'+(index+1)+'-'+kind
    let command
    if(kind==='database'){
     if(!app)throw Error('product_database_owner_required')
     const file='supabase/tests/'+slug+'-'+(index+1)+'.test.sql'
     output.push(base+'/'+file)
     command={name,program:'pnpm',cwd:base,args:['exec','supabase','test','db','--local',file],capabilities:['database',...(description.includes('RLS')||/denial|Unauthorized/.test(description)?['rls-authorization']:[]),...(description.includes('Storage')?['storage-policy']:[])]}
    }else if(kind==='browser'){
     const file='tests/e2e/'+slug+'-'+(index+1)+'.spec.ts',configuration='tests/e2e/'+slug+'-'+(index+1)+'.config.ts'
     output.push(base+'/'+file,base+'/'+configuration)
     command={name,program:'pnpm',args:['exec','playwright','test','--config',base+'/'+configuration,'--workers=1','--retries=0'],capabilities:['browser',...(/network|credential|bundle/.test(description)?['browser-security']:[])]}
    }else{
     const file=base+'/tests/'+(app?'unit/':'')+slug+'-'+(index+1)+(kind==='staging-evidence'?'.staging-evidence.test.mjs':'.test.mjs')
     output.push(file)
     command={name,program:'node',args:['--test',file],capabilities:[kind==='staging-evidence'?'external-evidence':'unit',...(kind==='staging-evidence'?['browser']:[]),...(description.includes('Security review')?['security-review']:[])]}
    }
    commands.push({...command,required:true,timeout_ms:1800000,changed_paths:['__verification-plan-only__/'+name],reviewed_task_id:id,obligation_description:description})
    refs.push(name)
   }
   if(index===recipe.length-1){refs.push(quality,...(sharedExtras[id]??[]),...additions);if(app==='shop-suit'&&recipe.some(r=>r.includes('database')))refs.push('shop-database-regression')}
   for(const ref of refs)if(!known.has(ref)&&!commands.some(c=>c.name===ref))throw Error('registered_existing_command_required:'+ref)
   if(kinds.includes('staging-evidence'))return {version:2,kind:'external_gate',description,commands:refs,phase:'pre_publication',expected_outputs:output,evidence_requirement:'Collect exact independent staging receipts bound to this task/source and declared journeys; missing or stale evidence is not PASS. No provider mutation is authorized by this declaration.'}
   return {version:2,kind:output.length?'planned_test':'group',description,commands:[...new Set(refs)],...(output.length?{expected_outputs:output}:{})}
  })
  packet.workstream.verification_config={...packet.workstream.verification_config,commands:[...(packet.workstream.verification_config?.commands??[]),...commands]}
  task.verification_plan=plan
  return {...row,packet,review:{original_plan:originalPlan,declared_task_owned_outputs:plan.flatMap(o=>o.expected_outputs??[]),requirements_preserved:true,provider_changes_authorized:false}}
 })
 // Freeze the same complete workstream configuration for every task in it.
 // Per-task proposed overlays cannot become inconsistent input snapshots.
 const configurations=new Map()
 for(const row of reviewed){const key=row.packet.workstream.workstream_id??row.packet.workstream.slug;const old=configurations.get(key)??row.packet.workstream.verification_config;configurations.set(key,mergeVerificationConfig(old,row.packet.workstream.verification_config))}
 for(const row of reviewed){const key=row.packet.workstream.workstream_id??row.packet.workstream.slug;row.packet.workstream.verification_config=structuredClone(configurations.get(key))}
 const runs=[...new Set(reviewed.map(row=>row.run_id))].map(run_id=>{
  const packets=reviewed.filter(row=>row.run_id===run_id).map(row=>row.packet)
  return {run_id,...boundedVerificationReadiness(packets,packets.length,{sourceRoot,requireExecutables:true})}
 })
 return {version:1,reviewed,runs,ready:runs.every(run=>run.ready),installed:false}
}
