#!/usr/bin/env node
import assert from 'node:assert/strict'
import {readFileSync,writeFileSync,mkdirSync,symlinkSync,readlinkSync} from 'node:fs'
import {spawnSync} from 'node:child_process'
import path from 'node:path'
import {prepareRuntimeRelease,activateRuntimeRelease,verifyRuntimeRelease} from '../../runner/runtime-release.mjs'

// Only owned fixture pointers change. The previous real immutable release is
// read and verified; neither its pointer nor any actual service is touched.
const [fixtureOutput,previousDirectory]=process.argv.slice(2)
assert.ok(path.isAbsolute(fixtureOutput)&&path.isAbsolute(previousDirectory))
const source=path.join(fixtureOutput,'isolated-runtime'),releaseHome=path.join(fixtureOutput,'cutover-runtime'),repository=path.join(fixtureOutput,'repository')
const run=(program,args,options={})=>{const r=spawnSync(program,args,{encoding:'utf8',timeout:60000,maxBuffer:16*1024*1024,...options});assert.equal(r.status,0,r.stderr||r.stdout);return r.stdout.trim()}
const previous=verifyRuntimeRelease(previousDirectory);assert.equal(previous.schema_version,108)
mkdirSync(releaseHome,{recursive:true});symlinkSync(previousDirectory,path.join(releaseHome,'current'))
const commit=run('git',['rev-parse','HEAD'],{cwd:source}),files=run('git',['ls-files','tooling/control-plane','tooling/git'],{cwd:source}).split('\n')
const candidate=prepareRuntimeRelease({sourceRoot:source,releaseHome,commit,files,schemaVersion:111,acceptance:{disposable_queue_acceptance:true}})
let restarts=0
const bootstrap=path.join(previousDirectory,'tooling/control-plane/runner/runtime-bootstrap.mjs')
const smoke=()=>{
 const env={...process.env,BS_CONTROL_RELEASE_HOME:releaseHome,BS_CONTROL_REPOSITORY_ROOT:repository}
 delete env.BS_CONTROL_PINNED_RUNTIME_ROOT
 const result=JSON.parse(run(process.execPath,[bootstrap,'runner','ping'],{env,cwd:repository}))
 assert.equal(result.ok,true);assert.equal(result.repo_root,repository)
 return true
}
const callbacks={restart:async()=>{restarts++;smoke()},preReadiness:async()=>verifyRuntimeRelease(candidate.directory).schema_version===111,readiness:async()=>smoke()}
const activated=await activateRuntimeRelease({releaseHome,candidate:candidate.directory,expectedCurrent:previousDirectory,requiredChecks:['disposable_queue_acceptance'],...callbacks})
assert.equal(readlinkSync(path.join(releaseHome,'current')),candidate.directory)
await assert.rejects(activateRuntimeRelease({releaseHome,candidate:candidate.directory,expectedCurrent:previousDirectory,requiredChecks:['disposable_queue_acceptance'],...callbacks}),/compare_and_swap/)
// The real helper must restore pointer and callback on readiness failure.
await assert.rejects(activateRuntimeRelease({releaseHome,candidate:previousDirectory,expectedCurrent:candidate.directory,requiredChecks:[],restart:callbacks.restart,readiness:async()=>false}),/readiness_failed/)
assert.equal(readlinkSync(path.join(releaseHome,'current')),candidate.directory)
const rolledBack=await activateRuntimeRelease({releaseHome,candidate:previousDirectory,expectedCurrent:candidate.directory,requiredChecks:[],restart:callbacks.restart,readiness:async()=>smoke()})
assert.equal(readlinkSync(path.join(releaseHome,'current')),previousDirectory)
const proof={passed:true,scenario:'actual-consumer-bootstrap-cutover',actual_installed_bootstrap:true,previous_release:previous.release_id,candidate_release:candidate.release_id,candidate_schema:111,clean_disposable_committed_source:true,activation:activated,rollback:rolledBack,compare_and_swap_rejected:true,failed_readiness_restored_pointer:true,restarts,live_pointer_unchanged:true,live_service_mutation:false}
writeFileSync(path.join(fixtureOutput,'consumer-cutover-proof.json'),JSON.stringify(proof,null,2)+'\n')
process.stdout.write(JSON.stringify(proof)+'\n')
