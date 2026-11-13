import test from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { collectBatch, historicalFragmentScope, workspaceGraphAt, validateCoverage } from './fragments.mjs'

const file = 'release-fragments/historical-scope-test.json'
const row = { id:'historical-scope-test',task:'BS-SCOPE-001',suits:['ledger-suit','shop-suit'],classification:'internal',disposition:'internal',paths:['apps/shop-suit','.github/workflows/retired.yml'],reason:'Task originally affected both consumers through its workflow.' }
function fixture(t, shared = true) {
  const cwd=mkdtempSync(path.join(tmpdir(),'release-scope-')); t.after(()=>rmSync(cwd,{recursive:true,force:true}))
  const run=(...args)=>execFileSync('git',args,{cwd,encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim()
  const write=(name,value)=>{mkdirSync(path.dirname(path.join(cwd,name)),{recursive:true});writeFileSync(path.join(cwd,name),value)}
  const commit=()=>{run('add','.');run('-c','user.name=Disposable test','-c','user.email=scope@example.test','commit','-qm','Disposable source')}
  run('init','-q')
  for(const suit of ['ledger-suit','shop-suit'])write(`apps/${suit}/package.json`,JSON.stringify({name:suit}))
  write('apps/shop-suit/app.ts','before\n');commit();const base=run('rev-parse','HEAD')
  write('apps/shop-suit/app.ts','after\n');write(file,JSON.stringify(row))
  if(shared)write('.github/workflows/retired.yml','name: originally shared workflow\n')
  commit();const original=run('rev-parse','HEAD')
  if(shared){rmSync(path.join(cwd,'.github/workflows/retired.yml'));commit()}
  return {run,write,commit,base,original,graph:workspaceGraphAt('HEAD',run)}
}

test('actual Git history proves a valid original shared consumer after that path is reverted',t=>{
  const f=fixture(t)
  const files=f.run('diff','--name-only',f.base,'HEAD').split('\n')
  assert.throws(()=>validateCoverage([row],files,f.graph),/Unrelated Suit/)
  assert.deepEqual(historicalFragmentScope('HEAD',file,row,f.run),['ledger-suit','shop-suit'])
  assert.deepEqual(collectBatch('HEAD',f.base,f.graph,f.run),[row])
})
test('listing an unchanged shared path cannot justify a newly broadened consumer',t=>{
  const f=fixture(t,false)
  assert.throws(()=>collectBatch('HEAD',f.base,f.graph,f.run),/Unrelated Suit in historical fragment origin/)
})
test('historical provenance cannot conceal a missing current path classification',t=>{
  const f=fixture(t);f.write('apps/ledger-suit/new.ts','unclassified\n');f.commit()
  assert.throws(()=>collectBatch('HEAD',f.base,f.graph,f.run),/Unclassified changed path/)
})
test('unknown consumers remain rejected even with a genuine original shared path',t=>{
  const f=fixture(t);const changed={...row,suits:[...row.suits,'unknown-suit']};f.write(file,JSON.stringify(changed));f.commit()
  assert.throws(()=>collectBatch('HEAD',f.base,f.graph,f.run),/Invalid release fragment/)
})
test('a rewritten origin row cannot borrow another task original scope',t=>{
  const f=fixture(t);const changed={...row,reason:'Rewritten historical scope claim'};f.write(file,JSON.stringify(changed));f.commit()
  assert.throws(()=>collectBatch('HEAD',f.base,f.graph,f.run),/Historical fragment differs from its origin/)
})
test('accepted fragments stay append-only independently of historical scope',t=>{
  const f=fixture(t);f.write(file,JSON.stringify({...row,reason:'Changed accepted receipt'}));f.commit()
  assert.throws(()=>collectBatch('HEAD',f.original,f.graph,f.run),/Accepted fragments are append-only/)
})
