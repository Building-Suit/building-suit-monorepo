import test from 'node:test'
import assert from 'node:assert/strict'
import {execFileSync} from 'node:child_process'
import {mkdtempSync,mkdirSync,writeFileSync,readFileSync,rmSync} from 'node:fs'
import {tmpdir} from 'node:os'
import path from 'node:path'
import {fragmentTree,workspaceGraphAt} from './fragments.mjs'
import {netCandidate,validatePublicTaskCoverage} from './candidate.mjs'
import {validateSupersessions} from './supersessions.mjs'

const runtime='packages/ux/control.ts',inventoryPath='release-changes/items.json'
const copy={en:'Reviewed focus recovery',ar:'استعادة التركيز بعد المراجعة'}
const source="export const stable = true\nexport const focus = 'corrected-focus'\nexport const cancellation = true\n"
const originalMarker='original-pending-focus'
function fixture(t, narrowBeforeReview=false){
  const cwd=mkdtempSync(path.join(tmpdir(),'release-correction-'));t.after(()=>rmSync(cwd,{recursive:true,force:true}))
  const run=(...args)=>execFileSync('git',args,{cwd,encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim()
  const write=(file,value)=>{mkdirSync(path.dirname(path.join(cwd,file)),{recursive:true});writeFileSync(path.join(cwd,file),value)}
  const json=(file,value)=>write(file,JSON.stringify(value))
  const commit=()=>{run('add','.');run('commit','-qm','Disposable corrective source');return run('rev-parse','HEAD')}
  run('init','-qb','main');run('config','user.name','Disposable correction test');run('config','user.email','correction@example.test')
  for(const suit of ['shop-suit','ledger-suit'])json('apps/'+suit+'/package.json',{name:suit,dependencies:{ux:'workspace:*'}})
  json('packages/ux/package.json',{name:'ux'});write(runtime,'export const stable = true\n');json(inventoryPath,[]);const base=commit()
  const fragment=(id,task,suits,disposition='public')=>({id,task,suits,classification:disposition==='public'?'patch':'internal',disposition,paths:[runtime],reason:'Reviewed source scope',...(disposition==='public'?{notes:{title:copy,summary:copy,details:copy}}:{})})
  const old=fragment('original-focus-task','BS-ORIGINAL-001',['shop-suit','ledger-suit'])
  const correction=fragment('corrective-focus-task','BS-CORRECT-001',['shop-suit'])
  const support=fragment('private-focus-qualification','BS-CORRECT-001',['shop-suit','ledger-suit'],'internal')
  const item=(row,marker)=>({...row,sources:[row.id],...(row.disposition==='public'?{evidence:[{path:runtime,contains:marker}]}:{})})
  const oldItem=item(old,originalMarker),replacement=item(correction,'corrected-focus'),privateItem=item(support)
  run('checkout','-qb','original');write(runtime,"export const stable = true\nexport const focus = '"+originalMarker+"'\n");json('release-fragments/'+old.id+'.json',narrowBeforeReview?{...old,suits:[...old.suits,'unreviewed-consumer']}:old);json(inventoryPath,[oldItem]);const originalTaskOrigin=commit()
  let originalSource=originalTaskOrigin
  if(narrowBeforeReview){json('release-fragments/'+old.id+'.json',old);originalSource=commit()}
  run('checkout','-qb','correction',base);write(runtime,source);json('release-fragments/'+correction.id+'.json',correction);json('release-fragments/'+support.id+'.json',support);json(inventoryPath,[replacement,privateItem]);const correctiveSource=commit()
  run('checkout','original');try{run('merge','--no-ff','--no-commit','correction')}catch{/* Resolve only this disposable intentional conflict. */}
  write(runtime,source);json(inventoryPath,[oldItem,replacement,privateItem]);const integrationSource=commit()
  run('update-ref','refs/remotes/origin/stg',integrationSource)
  const record={originalFragment:old.id,originalTask:old.task,originalSource,originalTaskOrigin,integrationSource,originalItem:old.id,correctiveFragment:correction.id,correctiveTask:correction.task,correctiveSource,correctiveItem:correction.id,internalFragment:support.id,proof:[{path:runtime,contains:"export const focus = 'corrected-focus'"},{path:runtime,contains:'export const cancellation = true'}]}
  const args=()=>{
    const inventory=JSON.parse(readFileSync(path.join(cwd,inventoryPath))),graph=workspaceGraphAt('HEAD',run)
    const read=(ref,file)=>run('ls-tree','-r','--name-only',ref,'--',file)?run('show',`${ref}:${file}`):''
    const candidate={changes:netCandidate({main:base,staging:'HEAD',items:inventory,graph,read,diff:()=>run('diff','--name-only',base,'HEAD').split('\n')})}
    return {records:[record],inventory,candidate,head:'HEAD',run}
  }
  return {run,write,json,commit,base,record,args,old,correction,support}
}

test('exact two-parent correction proof replaces false whole-file survival without broadening public scope',t=>{
  const f=fixture(t),args=f.args();assert.deepEqual([...validateSupersessions(args).keys()],[f.old.id])
  const coverage={...args,fragments:fragmentTree('HEAD',f.run).map(x=>x.row),base:f.base,main:f.base,supersessions:[]}
  assert.throws(()=>validatePublicTaskCoverage(coverage),/no contributing inventory item/)
  validatePublicTaskCoverage({...coverage,supersessions:[f.record]})
  assert.deepEqual(args.candidate.changes.filter(x=>x.disposition==='public').flatMap(x=>x.suits),['shop-suit'])
})
test('exact pre-review consumer narrowing preserves original task evidence without crediting the removed consumer',t=>{
  const f=fixture(t,true)
  assert.deepEqual([...validateSupersessions(f.args()).keys()],[f.old.id])
})
for(const fault of ['unlinked-correction','unknown-consumer','broadened-public-scope','altered-copy','missing-fragment','altered-fragment','missing-runtime-guard','original-still-present','missing-private-qualification','wrong-task','wrong-integration','unaccepted-integration','preexisting-proof','metadata-proof'])test('corrective receipts reject '+fault,t=>{
  const f=fixture(t);let a=f.args()
  if(fault==='unlinked-correction')a.inventory.find(x=>x.id===f.correction.id).sources=[]
  if(fault==='unknown-consumer')a.inventory.find(x=>x.id===f.correction.id).suits=['unknown-suit']
  if(fault==='broadened-public-scope')a.inventory.find(x=>x.id===f.correction.id).suits.push('ledger-suit')
  if(fault==='altered-copy')a.inventory.find(x=>x.id===f.correction.id).notes.title.en='Unreviewed behavioral claim'
  if(fault==='missing-fragment'){f.run('rm','release-fragments/'+f.correction.id+'.json');f.commit();a=f.args()}
  if(fault==='altered-fragment'){f.json('release-fragments/'+f.correction.id+'.json',{...f.correction,reason:'Altered receipt'});f.commit();a=f.args()}
  if(fault==='missing-runtime-guard'){f.write(runtime,source.replace('export const cancellation = true',''));f.commit();a=f.args()}
  if(fault==='original-still-present'){f.write(runtime,source+"export const old = '"+originalMarker+"'\n");f.commit();a=f.args()}
  if(fault==='missing-private-qualification')a.candidate.changes=a.candidate.changes.filter(x=>x.id!==f.support.id)
  if(fault==='wrong-task')a.records=[{...f.record,correctiveTask:'BS-OTHER-001'}]
  if(fault==='wrong-integration')a.records=[{...f.record,integrationSource:f.record.correctiveSource}]
  if(fault==='unaccepted-integration')a.acceptedStaging=f.base
  if(fault==='preexisting-proof')a.records=[{...f.record,proof:[{path:runtime,contains:'export const stable = true'}]}]
  if(fault==='metadata-proof')a.records=[{...f.record,proof:[{path:'apps/shop-suit/package.json',contains:'shop-suit'}]}]
  assert.throws(()=>validateSupersessions(a))
})
