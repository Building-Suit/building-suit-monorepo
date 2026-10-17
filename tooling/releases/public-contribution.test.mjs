import test from 'node:test'
import assert from 'node:assert/strict'
import {execFileSync} from 'node:child_process'
import {mkdtempSync,mkdirSync,writeFileSync,rmSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {netCandidate,validatePublicTaskCoverage} from './candidate.mjs'

test('existing receipt creation marker cannot hide a surviving behavior patch under blanket internal coverage; net-zero and already-main remain valid',()=>{
  const root=mkdtempSync(join(tmpdir(),'bs-public-contribution-'))
  const run=(...args)=>execFileSync('git',['-C',root,...args],{encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim()
  const file='apps/shop-suit/app/utils/receipt.ts',copy={en:'Better receipts',ar:'إيصالات أفضل'}
  const write=(text,message)=>{writeFileSync(join(root,file),text);run('add','.');run('commit','-m',message)}
  const original='export function receipt() {\n  return "old"\n}\n'+Array.from({length:8},(_,n)=>`// unchanged ${n}\n`).join('')
  try {
    run('init','-b','main');run('config','user.name','Disposable review test');run('config','user.email','review@invalid.example')
    mkdirSync(join(root,'apps/shop-suit/app/utils'),{recursive:true});write(original,'Original receipt')
    run('checkout','-b','stg');write(original+'const unrelatedPendingFeature = true\n','Unrelated earlier staging work')
    const base=run('rev-parse','HEAD')
    write((original+'const unrelatedPendingFeature = true\n').replace('"old"','"fixed"'),'Public receipt behavior patch')
    const patch=run('rev-parse','HEAD')
    const fragment={id:'receipt-behavior-patch',task:'BS-TEST-001',suits:['shop-suit'],classification:'patch',disposition:'public',paths:['apps/shop-suit/app/utils/receipt.ts'],reason:'Receipt correction',notes:{title:copy,summary:copy,details:copy}}
    const inactive={...fragment,id:'receipt-note',sources:[fragment.id],evidence:[{path:file,contains:'export function receipt()'}]}
    const support={...fragment,id:'blanket-internal',classification:'internal',disposition:'internal',paths:['apps'],notes:undefined}
    const graph=[{name:'shop',dir:'apps/shop-suit',suit:'shop-suit',dependencies:[]}]
    const read=(ref,path)=>run('show',`${ref}:${path}`)
    const validate=inventory=>{
      const changes=netCandidate({main:'main',staging:'stg',items:inventory,graph,read,diff:(a,b)=>run('diff','--name-only',a,b).split('\n').filter(Boolean)})
      validatePublicTaskCoverage({fragments:[fragment],inventory,candidate:{changes},base,main:'main',head:'stg',run})
      return changes
    }
    assert.throws(()=>validate([inactive,support]),/surviving net edits but no contributing inventory item/)
    const corrected={...inactive,evidence:[{path:file,contains:'return "fixed"'}]}
    validate([corrected,support])
    const approved={...fragment,id:'previously-approved-task'}
    const promotion={fragments:[approved,fragment],inventory:[{...inactive,id:'approved-note',sources:[approved.id]},corrected,support],candidate:{changes:[corrected]},base,main:'main',head:'stg',run}
    assert.throws(()=>validatePublicTaskCoverage(promotion),/previously-approved-task/)
    validatePublicTaskCoverage({...promotion,reviewed:new Set([approved.id])})

    // The same file still has an unrelated staging-only feature after the patch reaches main.
    run('checkout','main');run('cherry-pick',patch);run('checkout','stg')
    assert.ok(validate([inactive,support]).every(row=>row.disposition==='internal'))
    // A full revert before reaching main leaves no public task edits, despite staging's unrelated delta.
    run('checkout','main');run('revert','--no-edit','HEAD');run('checkout','stg')
    write(original+'const unrelatedPendingFeature = true\n','Revert public behavior; keep private fragment history')
    assert.ok(validate([inactive,support]).every(row=>row.disposition==='internal'))
    write((original+'const unrelatedPendingFeature = true\n').replace('  return "old"\n',''),'Remove receipt behavior')
    const removal=run('rev-parse','HEAD')
    assert.throws(()=>validate([inactive,support]),/surviving net edits but no contributing inventory item/)
    validate([{...inactive,evidence:[{path:file,contains:'return "old"',absent:true}]},support])
    run('checkout','main');run('cherry-pick',removal);run('checkout','stg')
    assert.ok(validate([inactive,support]).every(row=>row.disposition==='internal'),'Already-main removal does not fabricate a new public item')
  } finally {rmSync(root,{recursive:true,force:true})}
})
