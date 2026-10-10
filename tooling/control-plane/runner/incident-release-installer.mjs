import {readlinkSync} from 'node:fs'
import path from 'node:path'
import {createHash} from 'node:crypto'
import {prepareRuntimeRelease,activateRuntimeRelease,verifyRuntimeRelease} from './runtime-release.mjs'
const digest=bytes=>createHash('sha256').update(bytes).digest('hex')
export function successfulTapRun(result) {
 const text=result.stdout??''
 const count=Number(text.match(/^# tests (\d+)$/m)?.[1])
 if(result.code!==0||!Number.isSafeInteger(count)||count<1||Number(text.match(/^# pass (\d+)$/m)?.[1])!==count||!/^# fail 0$/m.test(text)||!/^# skipped 0$/m.test(text))throw Error('independent_complete_regression_run_required')
 return {tests:count,passed:count,failed:0,skipped:0,sha256:digest(text)}
}
export async function installIncidentRelease({releaseHome,sourceRoot,commit,newFiles,testResult,focusedResult,restart,preReadiness,readiness,registerPreparedRelease,recordActivation}) {
 const pointer=readlinkSync(path.join(releaseHome,'current'))
 const previous=verifyRuntimeRelease(pointer)
 const acceptance=successfulTapRun(testResult),focused=successfulTapRun(focusedResult)
 const files=[...new Set([...Object.keys(previous.files),...newFiles])].sort()
 // The host command result is the test authority. Model-authored plan/prose is
 // never accepted as a regression or release receipt.
 const candidate=prepareRuntimeRelease({sourceRoot,releaseHome,commit,files,schemaVersion:previous.schema_version,
  acceptance:{...previous.acceptance,incident_regression:true},metadata:{...previous.metadata,previous_release:previous.release_id,regression:acceptance,focused_regression:focused,
   test_result_fingerprint:digest(JSON.stringify({acceptance,focused}))}})
 if(typeof preReadiness!=='function'||typeof readiness!=='function'||typeof restart!=='function'||typeof registerPreparedRelease!=='function'||typeof recordActivation!=='function')throw Error('atomic_incident_installer_readiness_required')
 await registerPreparedRelease(verifyRuntimeRelease(candidate.directory),candidate.directory)
 const activated=await activateRuntimeRelease({releaseHome,candidate:candidate.directory,expectedCurrent:pointer,requiredChecks:[...Object.keys(previous.acceptance), 'incident_regression'],restart,preReadiness,
  readiness:async manifest=>{if(await readiness(manifest)!==true)return false;await recordActivation({release_id:manifest.release_id,previous:pointer},candidate.directory);return true}})
 return {...activated,directory:candidate.directory,source_commit:commit,regression:acceptance,manifest:candidate.manifest}
}
