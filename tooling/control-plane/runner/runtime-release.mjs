import {readBoundArtifact} from './trusted-verifier-receipt.mjs'
import {createHash} from 'node:crypto'
import {mkdirSync,readFileSync,writeFileSync,renameSync,symlinkSync,readlinkSync,existsSync,lstatSync,chmodSync,readdirSync,unlinkSync} from 'node:fs'
import {spawn,spawnSync} from 'node:child_process'
import path from 'node:path'
import {fileURLToPath} from 'node:url'
const hash=value=>createHash('sha256').update(value).digest('hex')
const relative=file=>!path.isAbsolute(file)&&!file.split('/').includes('..')
function sealDirectories(directory) {
 for(const entry of readdirSync(directory,{withFileTypes:true}))if(entry.isDirectory())sealDirectories(path.join(directory,entry.name))
 chmodSync(directory,0o555)
}
export function prepareRuntimeRelease({sourceRoot,releaseHome,commit,files,acceptance,schemaVersion,metadata={}}) {
 if(!/^[a-f0-9]{40}$/.test(commit)||!Number.isSafeInteger(schemaVersion))throw Error('release_provenance_required')
 const checked=spawnSync('git',['diff','--exit-code',commit,'--','tooling/control-plane'],{cwd:sourceRoot,encoding:'utf8'})
 if(checked.status!==0)throw Error('clean_committed_release_required')
 if(!files.length||files.some(f=>!relative(f)||lstatSync(path.join(sourceRoot,f)).isSymbolicLink()))throw Error('release_file_boundary_required')
 const status=spawnSync('git',['status','--porcelain','--',...files],{cwd:sourceRoot,encoding:'utf8'})
 if(status.status!==0||status.stdout.trim())throw Error('clean_committed_release_required')
 for(const file of files){const tracked=spawnSync('git',['show',commit+':'+file],{cwd:sourceRoot,maxBuffer:64*1024*1024});if(tracked.status!==0||hash(tracked.stdout)!==hash(readBoundArtifact(path.join(sourceRoot,file),sourceRoot)))throw Error('release_commit_content_mismatch')}
 const hashes=Object.fromEntries([...new Set(files)].sort().map(f=>[f,hash(readFileSync(path.join(sourceRoot,f)))]))
 const manifest={protocol:1,commit,schema_version:schemaVersion,files:hashes,acceptance,metadata}
 const id=hash(JSON.stringify(manifest)),directory=path.join(releaseHome,'releases',id)
 if(!existsSync(directory)){
  const temporary=directory+'.'+process.pid+'.prepared';mkdirSync(temporary,{recursive:true,mode:0o700})
  for(const f of Object.keys(hashes)){const target=path.join(temporary,f);mkdirSync(path.dirname(target),{recursive:true});writeFileSync(target,readFileSync(path.join(sourceRoot,f)),{mode:0o444})}
  writeFileSync(path.join(temporary,'release.json'),JSON.stringify({...manifest,release_id:id}),{mode:0o444})
  sealDirectories(temporary);renameSync(temporary,directory)
 }
 verifyRuntimeRelease(directory)
 return {directory,release_id:id,manifest}
}
export function verifyRuntimeRelease(directory) {
 const {release_id,...manifest}=JSON.parse(readFileSync(path.join(directory,'release.json'),'utf8'))
 if(hash(JSON.stringify(manifest))!==release_id)throw Error('release_manifest_mismatch')
 for(const [file,expected] of Object.entries(manifest.files)){
  if(!relative(file)||lstatSync(path.join(directory,file)).isSymbolicLink()||hash(readBoundArtifact(path.join(directory,file),directory))!==expected)throw Error('release_component_mismatch')
 }
 return {...manifest,release_id}
}
async function withInstallerLock(releaseHome,action) {
 const holder=spawn('flock',['-x',path.join(releaseHome,'installer.lock'),'/bin/sh','-c','printf locked; cat >/dev/null'],{stdio:['pipe','pipe','pipe']})
 try {await new Promise((resolve,reject)=>{holder.once('error',reject);holder.stdout.once('data',resolve);holder.once('exit',code=>reject(Error('installer_lock_failed:'+code))) });return await action()}
 finally {holder.stdin.end()}
}
export async function activateRuntimeRelease(options) {return withInstallerLock(options.releaseHome,()=>activateLocked(options))}
async function activateLocked({releaseHome,candidate,expectedCurrent,requiredChecks,readiness,restart,preReadiness,restorePrevious}) {
 // Global kernel installer lock is held; each component resolves this pointer once.
 const manifest=verifyRuntimeRelease(candidate)
 if(requiredChecks.some(check=>manifest.acceptance?.[check]!==true))throw Error('release_acceptance_incomplete')
 if(preReadiness && await preReadiness(manifest,candidate)!==true)throw Error('release_candidate_readiness_failed')
 const pointer=path.join(releaseHome,'current')
 let current=null
 try {current=readlinkSync(pointer)}catch(error){if(error.code!=='ENOENT')throw error}
 if(current!==expectedCurrent)throw Error('release_compare_and_swap_conflict')
 const switchTo=target=>{const temporary=pointer+'.'+process.pid+'.next';symlinkSync(target,temporary);renameSync(temporary,pointer)}
 switchTo(candidate)
 try {await restart();if(await readiness(manifest)!==true)throw Error('release_readiness_failed')}
 catch(error){if(current!==null)switchTo(current);else unlinkSync(pointer);await (restorePrevious??restart)();throw error}
 return {release_id:manifest.release_id,previous:current}
}
// Shell/bootstrap owns service configuration and the global flock. This library
// never installs an unverified candidate or rewrites individual component paths.
if(process.argv[1]===fileURLToPath(import.meta.url)){
 try {const manifest=verifyRuntimeRelease(process.argv[2]);process.stdout.write(JSON.stringify(manifest)+'\n')}
 catch(error){process.stderr.write(error.message+'\n');process.exitCode=1}
}
