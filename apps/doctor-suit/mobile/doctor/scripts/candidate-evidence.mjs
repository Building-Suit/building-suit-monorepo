import{nativePolicyCases}from'./policy-case-manifest.mjs'
const shellCases=['cold-launch-signed-out','cold-deep-link-signed-out','hardware-back-workspace','background-resume-signed-out','unknown-deep-link-denied']
const vaultCases=['fresh-install-empty','ciphertext-roundtrip','tamper-denied','namespace-denied','purge-marker','seed-before-reinstall','fresh-after-reinstall']
const sha=(value,length)=>typeof value==='string'&&new RegExp(`^[a-f0-9]{${length}}$`).test(value)
const record=value=>Boolean(value&&typeof value==='object'&&!Array.isArray(value))
const keys=(value,allowed)=>record(value)&&Object.keys(value).every(key=>allowed.includes(key))
const allowedReceipt=['version','task','sourceHead','appId','apkSha256','testApkSha256','api','accepted','stage','cleanup','runtime','lifecycle','runner','physicalDevice','cases','syntheticOnly','clinicalApproval','offlineClinicalApproval','offlineChartApproval','storeUpload','issues','scope','taskAcceptance','physicalDeviceAcceptance','policySubsetAccepted']
/** Consistency and privacy validation only. Files/summary counters do not prove
 * execution provenance, and this reader never grants physical/domain acceptance. */
export function inspectNativeCandidate(expected,input){
 expected=record(expected)?expected:{}
 const issues=new Set(),apiResults=[]
 const validBuild=keys(expected,['sourceHead','apkSha256','testApkSha256','appId','variant','syntheticOnly','clinicalAuthority','externalDistribution'])&&sha(expected.sourceHead,40)&&sha(expected.apkSha256,64)&&sha(expected.testApkSha256,64)&&expected.appId==='com.buildingsuit.doctor.synthetic'&&expected.variant==='debug'&&expected.syntheticOnly===true&&expected.clinicalAuthority===false&&expected.externalDistribution===false
 if(!validBuild)issues.add('build-binding-invalid')
 if(!keys(input,['emulators','backend'])||!keys(input?.emulators,['29','36']))issues.add('candidate-population-invalid')
 for(const api of[29,36]){
  const bundle=input?.emulators?.[api],result={api,shellPassed:0,vaultPassed:0,policyPassed:0,consistent:false},local=new Set()
  if(!keys(bundle,['shell','vault','policy']))local.add('receipt-population-invalid')
  for(const[kind,expectedCases]of[['shell',shellCases],['vault',vaultCases],['policy',nativePolicyCases.map(value=>value.id)]]){
   const receipt=bundle?.[kind]
   if(!keys(receipt,allowedReceipt)){local.add('receipt-shape-invalid');continue}
   if(!validBuild||receipt.sourceHead!==expected.sourceHead||receipt.apkSha256!==expected.apkSha256||receipt.api!==api||receipt.version!==1||receipt.runner!=='owned-disposable-android-emulator')local.add('receipt-binding-mismatch')
   if((kind==='vault'&&receipt.task!=='DOS-M4-003')||(kind==='policy'&&receipt.task!=='DOS-M4-010')||(kind==='shell'&&receipt.task!==undefined&&receipt.task!=='DOS-M4-002'))local.add('receipt-task-mismatch')
   if((kind==='shell'&&receipt.offlineClinicalApproval!==false)||(kind!=='shell'&&receipt.offlineChartApproval!==false)||((kind==='shell'||kind==='policy')&&receipt.storeUpload!==false))local.add('authority-claim-invalid')
   if((kind!=='vault'&&receipt.appId!==expected.appId)||(receipt.appId!==undefined&&receipt.appId!==expected.appId)||(kind!=='shell'&&receipt.testApkSha256!==expected.testApkSha256))local.add('receipt-binding-mismatch')
   if(receipt.physicalDevice!==false||receipt.syntheticOnly!==true||receipt.clinicalApproval!==false||receipt.storeUpload===true||receipt.offlineChartApproval===true||receipt.offlineClinicalApproval===true)local.add('authority-claim-invalid')
   if(kind==='policy'&&(receipt.scope!=='native-policy-subset'||receipt.taskAcceptance!==false||receipt.physicalDeviceAcceptance!==false||receipt.accepted!==undefined))local.add('authority-claim-invalid')
   if((kind==='policy'?receipt.policySubsetAccepted:receipt.accepted)!==true||receipt.stage!=='complete'||receipt.cleanup!=='passed'||(receipt.issues!==undefined&&(!Array.isArray(receipt.issues)||receipt.issues.length!==0)))local.add('receipt-not-passed')
   if(kind==='shell'&&(!keys(receipt.runtime,['webviewMajor','clientIssues','webviewVisible','syntheticPackageVisible'])||receipt.runtime.webviewMajor!==(api===29?74:133)||!Array.isArray(receipt.runtime.clientIssues)||receipt.runtime.clientIssues.length||receipt.runtime.webviewVisible!==true||receipt.runtime.syntheticPackageVisible!==true))local.add('renderer-observation-invalid')
   if(kind==='shell'&&(!keys(receipt.lifecycle,['backgroundObserved','resumeObserved'])||receipt.lifecycle.backgroundObserved!==true||receipt.lifecycle.resumeObserved!==true))local.add('lifecycle-observation-missing')
   const population=receipt.cases
   if(!Array.isArray(population)||population.length!==expectedCases.length||population.some(value=>!keys(value,['id','status'])||!expectedCases.includes(value.id)||value.status!=='passed')||new Set(population.map(value=>value?.id)).size!==expectedCases.length)local.add('case-population-not-passed')
   else result[kind+'Passed']=population.length
  }
  result.consistent=local.size===0;apiResults.push(result)
  for(const issue of local)issues.add(issue)
 }
 const backend=input?.backend
 const backendConsistent=keys(backend,['sourceHead','runId','jobId','kind','conclusion'])&&validBuild&&backend.sourceHead===expected.sourceHead&&backend.kind==='doctor-sql'&&backend.conclusion==='success'&&Number.isSafeInteger(backend.runId)&&backend.runId>0&&Number.isSafeInteger(backend.jobId)&&backend.jobId>0
 if(!backendConsistent)issues.add('exact-backend-evidence-missing')
 return{version:1,task:'DOS-M4-010',sourceHead:sha(expected?.sourceHead,40)?expected.sourceHead:null,consistentSyntheticSubset:issues.size===0,apiResults,backendReceiptConsistent:backendConsistent,issues:[...issues].sort(),executionProvenance:'Requires independent verification against the owned GitHub run/job and immutable artifacts; consistency alone is insufficient.',taskAcceptance:false,physicalDeviceAcceptance:false,clinicalApproval:false,offlineChartApproval:false,distributionApproval:false,storeUpload:false,blockedCriteria:['approved-physical-matrix','signed-in-native-journeys','qualified-accessibility-security','accountable-platform-offline-review','distribution-signing-prerequisites','M7-launch-acceptance']}
}
