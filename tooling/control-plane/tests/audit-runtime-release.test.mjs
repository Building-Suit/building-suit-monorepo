import test from 'node:test'
import assert from 'node:assert/strict'
import {mkdtempSync,mkdirSync,writeFileSync,readlinkSync,symlinkSync,rmSync,chmodSync,readdirSync,statSync,existsSync} from 'node:fs'
import {spawnSync} from 'node:child_process'
import os from 'node:os'
import path from 'node:path'
import {prepareRuntimeRelease,verifyRuntimeRelease,activateRuntimeRelease} from '../runner/runtime-release.mjs'
function unseal(directory){chmodSync(directory,0o755);for(const entry of readdirSync(directory,{withFileTypes:true}))if(entry.isDirectory())unseal(path.join(directory,entry.name))}
function fixture(){const root=mkdtempSync(path.join(os.tmpdir(),'cp-release-')),source=path.join(root,'source'),home=path.join(root,'runtime');mkdirSync(source);mkdirSync(home);mkdirSync(path.join(source,'tooling/control-plane'),{recursive:true});writeFileSync(path.join(source,'tooling/control-plane/test.mjs'),'export const version=1\n');for(const args of [['init','-q'],['add','.'],['-c','user.name=Fixture','-c','user.email=fixture@example.test','commit','-qm','fixture']])assert.equal(spawnSync('git',args,{cwd:source}).status,0);const commit=spawnSync('git',['rev-parse','HEAD'],{cwd:source,encoding:'utf8'}).stdout.trim();const candidate=prepareRuntimeRelease({sourceRoot:source,releaseHome:home,commit,files:['tooling/control-plane/test.mjs'],acceptance:{tested:true},schemaVersion:64});return {root,home,source,candidate,cleanup:()=>{unseal(candidate.directory);rmSync(root,{recursive:true,force:true})}}}
test('content addressed release rejects artifact mutation',()=>{const f=fixture();try{assert.equal(verifyRuntimeRelease(f.candidate.directory).commit.length,40);chmodSync(path.join(f.candidate.directory,'tooling/control-plane/test.mjs'),0o644);writeFileSync(path.join(f.candidate.directory,'tooling/control-plane/test.mjs'),'mutated');assert.throws(()=>verifyRuntimeRelease(f.candidate.directory),/component_mismatch/)}finally{f.cleanup()}})
test('one pointer activates all components and CAS refuses competing installer',async()=>{const f=fixture();try{symlinkSync('/previous',path.join(f.home,'current'));const options={releaseHome:f.home,candidate:f.candidate.directory,expectedCurrent:'/previous',requiredChecks:['tested'],restart:async()=>{},readiness:async()=>true};assert.equal((await activateRuntimeRelease(options)).release_id,f.candidate.release_id);assert.equal(readlinkSync(path.join(f.home,'current')),f.candidate.directory);await assert.rejects(activateRuntimeRelease(options),/compare_and_swap/)}finally{f.cleanup()}})
test('failed readiness rolls pointer and services back together',async()=>{const f=fixture();try{symlinkSync('/previous',path.join(f.home,'current'));let restarts=0;await assert.rejects(activateRuntimeRelease({releaseHome:f.home,candidate:f.candidate.directory,expectedCurrent:'/previous',requiredChecks:['tested'],restart:async()=>{restarts++},readiness:async()=>false}),/readiness_failed/);assert.equal(readlinkSync(path.join(f.home,'current')),'/previous');assert.equal(restarts,2)}finally{f.cleanup()}})
test('acceptance gaps prevent switching any component',async()=>{const f=fixture();try{symlinkSync('/previous',path.join(f.home,'current'));await assert.rejects(activateRuntimeRelease({releaseHome:f.home,candidate:f.candidate.directory,expectedCurrent:'/previous',requiredChecks:['n8n_restart_proved']}),/acceptance_incomplete/);assert.equal(readlinkSync(path.join(f.home,'current')),'/previous')}finally{f.cleanup()}})

test('release seals nested component directories against replacement',()=>{const f=fixture();try{for(const component of ['', 'tooling', 'tooling/control-plane'])assert.equal(statSync(path.join(f.candidate.directory,component)).mode&0o222,0)}finally{f.cleanup()}})

test('incident installer registers tested semantic release before swapping one pointer',async()=>{
 const {installIncidentRelease}=await import('../runner/incident-release-installer.mjs')
 const f=fixture(),events=[],tap='# tests 1\n# pass 1\n# fail 0\n# skipped 0\n'
 try {
  symlinkSync(f.candidate.directory,path.join(f.home,'current'))
  const installed=await installIncidentRelease({releaseHome:f.home,sourceRoot:f.source,commit:f.candidate.manifest.commit,newFiles:[],testResult:{code:0,stdout:tap},focusedResult:{code:0,stdout:tap},
   registerPreparedRelease:async manifest=>{assert.equal(readlinkSync(path.join(f.home,'current')),f.candidate.directory);assert.equal(manifest.metadata.focused_regression.tests,1);events.push('registered')},
   preReadiness:async()=>{events.push('candidate-ready');return true},restart:async()=>events.push('restart'),readiness:async()=>{events.push('ready');return true},
   recordActivation:async identity=>{assert.notEqual(identity.release_id,f.candidate.release_id);events.push('activation-recorded')}})
  assert.deepEqual(events,['registered','candidate-ready','restart','ready','activation-recorded'])
  assert.equal(readlinkSync(path.join(f.home,'current')),installed.directory)
  unseal(installed.directory)
 }finally{f.cleanup()}
})
test('lost activation ledger response restores previous runtime pointer',async()=>{
 const {installIncidentRelease}=await import('../runner/incident-release-installer.mjs')
 const f=fixture(),tap='# tests 1\n# pass 1\n# fail 0\n# skipped 0\n';let restarts=0
 try {
  symlinkSync(f.candidate.directory,path.join(f.home,'current'))
  await assert.rejects(installIncidentRelease({releaseHome:f.home,sourceRoot:f.source,commit:f.candidate.manifest.commit,newFiles:[],testResult:{code:0,stdout:tap},focusedResult:{code:0,stdout:tap},
   registerPreparedRelease:async()=>{},preReadiness:async()=>true,restart:async()=>restarts++,readiness:async()=>true,recordActivation:async()=>{throw Error('synthetic_ledger_transport')}}),/synthetic_ledger_transport/)
  assert.equal(readlinkSync(path.join(f.home,'current')),f.candidate.directory);assert.equal(restarts,2)
  for(const release of readdirSync(path.join(f.home,'releases')))unseal(path.join(f.home,'releases',release))
 }finally{f.cleanup()}
})

test('first immutable activation failure removes its pointer and restores the previous service configuration',async()=>{
 const f=fixture(),events=[]
 try{
  await assert.rejects(activateRuntimeRelease({releaseHome:f.home,candidate:f.candidate.directory,expectedCurrent:null,requiredChecks:['tested'],restart:async()=>events.push('candidate-services'),readiness:async()=>false,restorePrevious:async()=>events.push('previous-services')}),/readiness_failed/)
  assert.equal(existsSync(path.join(f.home,'current')),false)
  assert.deepEqual(events,['candidate-services','previous-services'])
 }finally{f.cleanup()}
})
