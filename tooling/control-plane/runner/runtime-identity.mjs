import {existsSync,readdirSync} from 'node:fs'
import {spawnSync} from 'node:child_process'
import path from 'node:path'
import {verifyRuntimeRelease} from './runtime-release.mjs'
export function runtimeIdentity(source) {
 if(existsSync(path.join(source,'release.json')))return verifyRuntimeRelease(source)
 const git=spawnSync('git',['rev-parse','HEAD'],{cwd:source,encoding:'utf8'})
 if(git.status!==0||!/^[a-f0-9]{40}$/.test(git.stdout.trim()))throw Error('runtime_source_identity_required')
 const versions=readdirSync(path.join(source,'tooling/control-plane/sql')).filter(f=>/^\d{3}_.+\.sql$/.test(f)).map(f=>Number(f.slice(0,3)))
 return {commit:git.stdout.trim(),schema_version:Math.max(...versions),release_id:null}
}
