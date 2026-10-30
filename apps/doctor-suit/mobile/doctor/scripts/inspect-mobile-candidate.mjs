import{fileURLToPath}from'node:url'
import{readFile,writeFile,mkdir}from'node:fs/promises'
import{execFileSync}from'node:child_process'
import{inspectNativeCandidate}from'./candidate-evidence.mjs'
const root=new URL('../../../../../',import.meta.url),at=path=>new URL(path,root)
const sourceHead=execFileSync('git',['rev-parse','HEAD'],{cwd:fileURLToPath(root),encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim()
const read=async path=>{try{return JSON.parse(await readFile(at(path),'utf8'))}catch{return null}}
const metadata=await read('.local/doctor-android/build-metadata.json')
const expected={sourceHead,apkSha256:metadata?.apkSha256,testApkSha256:metadata?.testApkSha256,appId:metadata?.appId,variant:metadata?.variant,syntheticOnly:metadata?.syntheticOnly,clinicalAuthority:metadata?.clinicalAuthority,externalDistribution:metadata?.externalDistribution}
const emulators={}
for(const api of[29,36])emulators[api]={shell:await read(`test-results/doctor-mobile/device-${api}.json`),vault:await read(`test-results/doctor-mobile/session-vault-${api}.json`),policy:await read(`test-results/doctor-mobile/online-policy-${api}.json`)}
const packet=inspectNativeCandidate(expected,{emulators,backend:await read('test-results/doctor-mobile/backend-candidate.json')})
await mkdir(at('test-results/doctor-mobile'),{recursive:true});await writeFile(at('test-results/doctor-mobile/candidate-evidence.json'),JSON.stringify(packet,null,2)+'\n')
console.log('Doctor synthetic candidate consistency '+JSON.stringify(packet))
// A successful inspection never means task/physical/domain/release acceptance.
if(!packet.consistentSyntheticSubset)process.exitCode=1
