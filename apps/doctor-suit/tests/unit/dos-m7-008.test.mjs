import test from 'node:test'
import assert from 'node:assert/strict'
import {createHash} from 'node:crypto'
import {compareDoctorOperationalSupport as compare} from '../helpers/operational-support-evidence.mjs'
import {doctorOperationsTaskIds} from '../operations-browser-evidence.mjs'
import {nativePolicyCases} from '../../mobile/doctor/scripts/policy-case-manifest.mjs'
const head='a'.repeat(40),base='b'.repeat(40)
const artifact=value=>{const bytes=JSON.stringify(value);return{bytes,sha256:createHash('sha256').update(bytes).digest('hex')}}
const amend=(input,key,change)=>{const value=JSON.parse(input[key].bytes);change(value);input[key]=artifact(value)}
function fixture(){
 const operations={executionId:'d2070008-0000-4000-8000-000000000001',startedAt:'2026-11-01T00:00:00Z',finishedAt:'2026-11-01T00:01:00Z',sourceHead:head,baseSha:base,baseVerified:true,finalHead:head,sourceClean:true,candidateVerified:true,nodeVersion:'v26.8.1',commandArgv:['node','apps/doctor-suit/tests/operations-actual-provider.mjs'],exitCode:0,stage:'actual M3 browser assertions',browserResult:{exitCode:0,logSha256:'c'.repeat(64),accepted:true,expected:[...doctorOperationsTaskIds],passed:[...doctorOperationsTaskIds],failed:[],issues:[]},ownedLocalProject:'synthetic-unit-only',hostedOperations:false,professionalApproval:false,providerApproval:false}
 const declaration={sourceHead:head,baseSha:base,syntheticWebOperations:'verified',syntheticAndroidEmulator:'unavailable',excludedSurfaces:['physical-device','ios','patient-mobile','offline-clinical','clinical-production'],operationalLimits:'unavailable',rollbackDependencies:'unavailable',productionCapacityClaim:false,providerUpgradeAuthorized:false,productionLoadTestAuthorized:false}
 return{sourceHead:head,baseSha:base,declaration:artifact(declaration),operations:artifact(operations),nativeBuild:null,nativeReceipts:null}
}
function noAuthority(result){for(const key of['executionProvenanceVerified','productionCapacityClaim','providerUpgradeAuthorized','productionLoadTestAuthorized','fullTaskAccepted','clinicalApproval'])assert.equal(result[key],false,key);assert.equal(result.operationalLimits.status,'unavailable');assert.equal(result.rollbackDependencies.status,'unavailable')}
function nativeFixture(){
 const build={sourceHead:head,apkSha256:'d'.repeat(64),testApkSha256:'e'.repeat(64),appId:'com.buildingsuit.doctor.synthetic',variant:'debug',syntheticOnly:true,clinicalAuthority:false,externalDistribution:false}
 const shell=['cold-launch-signed-out','cold-deep-link-signed-out','hardware-back-workspace','background-resume-signed-out','unknown-deep-link-denied'],vault=['fresh-install-empty','ciphertext-roundtrip','tamper-denied','namespace-denied','purge-marker','seed-before-reinstall','fresh-after-reinstall'],emulators={}
 for(const api of[29,36]){const receipt=ids=>({version:1,sourceHead:head,apkSha256:build.apkSha256,testApkSha256:build.testApkSha256,appId:build.appId,api,accepted:true,stage:'complete',cleanup:'passed',issues:[],runner:'owned-disposable-android-emulator',physicalDevice:false,syntheticOnly:true,clinicalApproval:false,offlineChartApproval:false,storeUpload:false,cases:ids.map(id=>({id,status:'passed'}))});emulators[api]={shell:{...receipt(shell),offlineClinicalApproval:false,runtime:{webviewMajor:api===29?74:133,clientIssues:[],webviewVisible:true,syntheticPackageVisible:true},lifecycle:{backgroundObserved:true,resumeObserved:true}},vault:{...receipt(vault),task:'DOS-M4-003'},policy:{...receipt(nativePolicyCases.map(v=>v.id)),accepted:undefined,policySubsetAccepted:true,scope:'native-policy-subset',taskAcceptance:false,physicalDeviceAcceptance:false,task:'DOS-M4-010'}}}
 return{build,receipts:{emulators,backend:{sourceHead:head,runId:1,jobId:2,kind:'doctor-sql',conclusion:'success'}}}
}
test('C03 comparator preserves current producer formats and distinguishes partial synthetic coverage from operational readiness',()=>{
 const input=fixture(),before=structuredClone(input),result=compare(input)
 assert.equal(result.comparisonStatus,'consistent-partial-scope');assert.equal(result.webOperations.status,'verified');assert.equal(result.androidEmulator.status,'unavailable');assert.deepEqual(result.inputSha256,{declaration:input.declaration.sha256,operations:input.operations.sha256});noAuthority(result);assert.deepEqual(input,before)
})
test('missing receipts are unavailable and cannot support declared verified coverage',()=>{
 const input=fixture();input.operations=null;assert.equal(compare(input).comparisonStatus,'failed')
 amend(input,'declaration',v=>v.syntheticWebOperations='unavailable');const result=compare(input);assert.equal(result.comparisonStatus,'unavailable');assert.equal(result.webOperations.status,'unavailable');noAuthority(result)
})
test('receipt bytes must match supplied hashes; valid JSON or success labels alone do not suffice',()=>{
 for(const key of['operations','declaration']){const input=fixture();input[key].bytes+=' ';const result=compare(input);assert.equal(result.comparisonStatus,'invalid');assert.ok(result.issues.includes('receipt-invalid'));noAuthority(result)}
 const input=fixture();input.operations=artifact(null);assert.notEqual(compare(input).comparisonStatus,'consistent-partial-scope')
})
test('a parent candidate, wrong base, dirty source or failed execution cannot qualify current web coverage',()=>{
 for(const change of[v=>v.sourceHead='f'.repeat(40),v=>v.finalHead='f'.repeat(40),v=>v.baseSha='f'.repeat(40),v=>v.sourceClean=false,v=>v.candidateVerified=false,v=>v.exitCode=1]){const input=fixture();amend(input,'operations',change);assert.equal(compare(input).comparisonStatus,'failed')}
})
test('all ten M3 cases must occur exactly once, with no failed/skipped/unknown replacement',()=>{
 for(const change of[v=>v.browserResult.passed.pop(),v=>v.browserResult.passed[1]=v.browserResult.passed[0],v=>v.browserResult.failed.push({task:'DOS-M3-001'}),v=>v.browserResult.accepted=false,v=>v.browserResult.issues.push('private.sentinel')]){const input=fixture();amend(input,'operations',change);const result=compare(input);assert.equal(result.comparisonStatus,'failed');assert.equal(JSON.stringify(result).includes('private.sentinel'),false)}
})
test('actual native receipt decoder is reused, preserving both API populations, APK binding and clinical exclusions',()=>{
 const input=fixture(),native=nativeFixture();input.nativeBuild=artifact(native.build);input.nativeReceipts=artifact(native.receipts);amend(input,'declaration',v=>v.syntheticAndroidEmulator='verified')
 assert.equal(compare(input).androidEmulator.status,'verified');noAuthority(compare(input))
 for(const change of[v=>v.emulators[29].policy.cases.pop(),v=>v.emulators[36].shell.apkSha256='f'.repeat(64),v=>v.emulators[29].shell.clinicalApproval=true]){const changed=structuredClone(input);amend(changed,'nativeReceipts',change);assert.equal(compare(changed).comparisonStatus,'failed')}
})
test('excluded physical/iOS/patient/offline/production surfaces cannot disappear or be replaced with an invented surface',()=>{
 for(const change of[v=>v.excludedSurfaces.pop(),v=>v.excludedSurfaces[1]=v.excludedSurfaces[0],v=>v.excludedSurfaces.push('invented')]){const input=fixture();amend(input,'declaration',change);assert.ok(compare(input).issues.includes('surface-exclusions-invalid'))}
})
test('capacity, provider upgrades, production load and rollback readiness cannot be inferred from synthetic success',()=>{
 for(const key of['productionCapacityClaim','providerUpgradeAuthorized','productionLoadTestAuthorized']){const input=fixture();amend(input,'declaration',v=>v[key]=true);const result=compare(input);assert.ok(result.issues.includes('authority-claim-invalid'));noAuthority(result)}
 for(const key of['operationalLimits','rollbackDependencies']){const input=fixture();amend(input,'declaration',v=>v[key]='verified');assert.ok(compare(input).issues.includes('unsupported-readiness-claim'))}
})
test('bounded malformed/private input and accessors fail without echoing material or invoking accessors',()=>{
 for(const bytes of['private.sentinel','x'.repeat(1048577)]){const input=fixture();input.operations={bytes,sha256:createHash('sha256').update(bytes).digest('hex')};const result=compare(input);assert.equal(result.comparisonStatus,'invalid');assert.equal(JSON.stringify(result).includes('private.sentinel'),false)}
 let called=false;const input=fixture();Object.defineProperty(input,'operations',{get(){called=true;throw Error('private.sentinel')}});assert.equal(compare(input).comparisonStatus,'invalid');assert.equal(called,false)
})

test('missing execution identity, reversed dates and a different producer cannot supply actual receipt structure',()=>{
 for(const change of[v=>v.executionId='',v=>v.finishedAt='2026-10-01T00:00:00Z',v=>v.commandArgv=['node','unrelated.mjs'],v=>v.stage='setup']){const input=fixture();amend(input,'operations',change);assert.equal(compare(input).comparisonStatus,'failed')}
})

test('owned web runner projection records only bound comparisons and retains all unavailable obligations',async()=>{
 const {doctorOperationalWebReceipt}=await import('../helpers/operational-support-evidence.mjs')
 const actualShape=JSON.parse(fixture().operations.bytes),result=doctorOperationalWebReceipt(actualShape)
 assert.equal(result.comparisonPassed,true);assert.equal(result.sourceHead,head);assert.equal(result.baseSha,base);assert.equal(result.canonicalCaseAccepted,false);assert.equal(result.androidEmulator.status,'unavailable');noAuthority(result)
 assert.equal(JSON.stringify(result).includes(actualShape.ownedLocalProject),false);assert.equal(JSON.stringify(result).includes(actualShape.executionId),false)
 for(const field of['candidateVerified','baseVerified','sourceClean'])assert.equal(doctorOperationalWebReceipt({...actualShape,[field]:false}).comparisonPassed,false)
})
