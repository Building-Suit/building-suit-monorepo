import test from 'node:test'
import assert from 'node:assert/strict'
import {execFileSync} from 'node:child_process'
import {mkdtempSync,mkdirSync,writeFileSync,rmSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {netCandidate,promotionCandidate,loadInventory,workspaceGraphAt} from './candidate.mjs'
const copy={en:'A reviewed change',ar:'تغيير تمت مراجعته'}
const graph=[{name:'shop',dir:'apps/shop-suit',suit:'shop-suit',dependencies:[]}]
const file='apps/shop-suit/work.ts'
const item=(id,marker,classification='minor',absent=false)=>({id,task:'BS-TEST-001',suits:['shop-suit'],classification,disposition:'public',paths:['apps/shop-suit'],reason:'Reviewed change',notes:{title:copy,summary:copy,details:copy},evidence:[{path:file,contains:marker,absent}]})
test('actual branch trees handle repeated PRs, overlapping edits, full/partial reverts, cherry-picks and divergent main advancement',()=>{
  const root=mkdtempSync(join(tmpdir(),'bs-net-release-'))
  const git=(...args)=>execFileSync('git',['-C',root,...args],{encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim()
  const write=text=>{writeFileSync(join(root,file),text);git('add','.');git('commit','-m','Disposable semantic change')}
  try {
    git('init','-b','main');git('config','user.name','Disposable candidate test');git('config','user.email','candidate@invalid.example')
    mkdirSync(join(root,'apps/shop-suit'),{recursive:true});writeFileSync(join(root,'apps/shop-suit/package.json'),JSON.stringify({name:'shop',dependencies:{}}));write('original\n');git('branch','stg');git('checkout','stg');write('original\ncapability\n')
    const capability=git('rev-parse','HEAD')
    const items=[item('capability-note','capability'),item('fix-note','fixed-result','patch'),item('remove-main-only','main-only-feature','major',true)]
    const read=(ref,path)=>git('ls-tree','-r','--name-only',ref,'--',path).includes(path)?git('show',`${ref}:${path}`):''
    const check=()=>netCandidate({main:'main',staging:'stg',items,graph,read,diff:(a,b)=>git('diff','--name-only',a,b).split('\n').filter(Boolean)}).map(row=>row.id)
    assert.deepEqual(check(),['capability-note'])
    write('original\ncapability\nfixed-result\n');assert.deepEqual(check(),['capability-note','fix-note'])
    write('original\nfixed-result\n');assert.deepEqual(check(),['fix-note'],'Overlapping file retains only the contributing semantic item')
    write('original\n');assert.deepEqual(check(),[],'Full revert is net zero despite many commits')
    git('checkout','main');git('cherry-pick',capability);git('checkout','stg');write('original\ncapability\n')
    assert.deepEqual(check(),[],'Equivalent cherry-pick on main is already delivered')
    git('checkout','main');write('original\ncapability\nmain-only-feature\n');git('checkout','stg');write('original\ncapability\nfixed-result\n')
    assert.deepEqual(check(),['fix-note','remove-main-only'],'Direct tree comparison includes divergence/removal, not only merge-base additions')
    assert.throws(()=>netCandidate({main:'main',staging:'stg',items:[],graph,read,diff:()=>[file]}),/Unreviewed/)
    assert.throws(()=>netCandidate({main:'main',staging:'stg',items:[{...items[0],notes:{title:{en:'missing Arabic'}}}],graph,read,diff:()=>[file]}))
    mkdirSync(join(root,'packages/shared-ui'),{recursive:true})
    writeFileSync(join(root,'packages/shared-ui/package.json'),JSON.stringify({name:'shared-ui'}))
    writeFileSync(join(root,'apps/shop-suit/package.json'),JSON.stringify({name:'shop',dependencies:{'shared-ui':'workspace:*'}}))
    git('add','.');git('commit','-m','Disposable staging dependency change');git('checkout','main')
    assert.deepEqual(workspaceGraphAt('stg',git).find(row=>row.name==='shop').dependencies,['shared-ui'],'Dependency graph comes from actual staging tree, even while main is checked out')

  } finally {rmSync(root,{recursive:true,force:true})}
})
test('production freezes only an exact ready staging tree at the actual current main parent',()=>{
  const row={readyAt:'time',manifest:{mainSha:'main',stagingTree:'tree',stagingSha:'stg'}}
  const args={mainParent:'main',tree:'tree',ancestor:()=>true}
  assert.equal(promotionCandidate([row],args),row)
  for(const patch of [{mainParent:'advanced-main'},{tree:'conflict-resolution-tree'},{ancestor:()=>false}]) assert.throws(()=>promotionCandidate([row],{...args,...patch}))
  assert.throws(()=>promotionCandidate([{...row,readyAt:null}],args))
})
test('reviewed inventory contains truthful bilingual service, taxes, commissions and ETA preparation items',()=>{
  const inventory=loadInventory()
  for(const id of ['shop-service-recipes','shop-configurable-taxes','shop-staff-commissions','shop-eta-preparation']) {
    const row=inventory.find(x=>x.id===id);assert.ok(row);assert.match(row.notes.title.ar,/[؀-ۿ]/);assert.ok(row.evidence.length)
  }
  const eta=inventory.find(x=>x.id==='shop-eta-preparation')
  assert.match(eta.notes.details.en,/not an activated or certified compliant integration/)
})

test('net coverage expands shared changes through actual consumers without activating unrelated products',()=>{
  const consumers=[{name:'ui',dir:'packages/shared-ui',dependencies:[]},...graph,{name:'ledger',dir:'apps/ledger-suit',suit:'ledger-suit',dependencies:['ui']}]
  consumers.find(row=>row.name==='shop').dependencies=['ui']
  const support={...item('private-shared-support','unused'),suits:['shop-suit'],classification:'internal',disposition:'internal',paths:['packages/shared-ui']}
  delete support.notes;delete support.evidence
  const args={main:'main',staging:'stg',items:[support],graph:consumers,diff:()=>['packages/shared-ui/src/layout.ts']}
  assert.throws(()=>netCandidate(args),/Unclassified net consumer/)
  assert.deepEqual(netCandidate({...args,items:[{...support,suits:['shop-suit','ledger-suit']} ]})[0].suits,['shop-suit','ledger-suit'])
})
