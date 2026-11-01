import {createHash} from 'node:crypto'
import {inspectNativeCandidate} from '../../mobile/doctor/scripts/candidate-evidence.mjs'
import {doctorOperationsTaskIds} from '../operations-browser-evidence.mjs'

const sha = (value, length) => typeof value === 'string' && new RegExp(`^[a-f0-9]{${length}}$`).test(value)
const record = value => value && typeof value === 'object' && !Array.isArray(value)
const exactKeys = (value, keys) => {
 if(!record(value)||![Object.prototype,null].includes(Object.getPrototypeOf(value)))return false
 const descriptors=Object.getOwnPropertyDescriptors(value)
 return Reflect.ownKeys(descriptors).length===keys.length&&keys.every(key=>Object.hasOwn(descriptors,key)&&Object.hasOwn(descriptors[key],'value'))
}
const receiptKeys = ['executionId','startedAt','finishedAt','sourceHead','baseSha','baseVerified','finalHead','sourceClean','candidateVerified','nodeVersion','commandArgv','exitCode','stage','browserResult','ownedLocalProject','hostedOperations','professionalApproval','providerApproval']
const excluded = ['physical-device','ios','patient-mobile','offline-clinical','clinical-production']
const unavailable = () => ({status:'unavailable',issues:['missing-receipt']})

// Compare supplied receipt bytes with an explicit support declaration. This does
// not fetch artifacts, authenticate their provenance, execute a workload or grant
// operational authority. Only existing M3/native producer formats are admitted.
export function compareDoctorOperationalSupport(input) {
 const result = {version:1,caseId:'DOS-M7-008-C03',comparisonStatus:'invalid',inputSha256:{},
  webOperations:unavailable(),androidEmulator:unavailable(),excludedSurfaces:[...excluded],
  operationalLimits:{status:'unavailable',missing:['approved-workload-and-thresholds','verified-provider-quotas-and-costs','accountable-support-and-runbooks']},
  rollbackDependencies:{status:'unavailable',missing:['approved-recovery-objectives-and-custody','complete-database-and-object-restore','authorized-rollback-scope']},
  issues:[],executionProvenanceVerified:false,productionCapacityClaim:false,providerUpgradeAuthorized:false,productionLoadTestAuthorized:false,fullTaskAccepted:false,clinicalApproval:false}
 const fail = issue => {result.issues.push(issue);return result}
 try {
  // Clone only JSON data. Callers supply bytes, never functions or executable paths.
  if(!exactKeys(input,['sourceHead','baseSha','declaration','operations','nativeBuild','nativeReceipts']) || !sha(input.sourceHead,40) || !sha(input.baseSha,40))return fail('input-binding-invalid')
  const parse = (key) => {
   const supplied=input[key]
   if(supplied===null)return null
   if(!exactKeys(supplied,['bytes','sha256'])||typeof supplied.bytes!=='string'||Buffer.byteLength(supplied.bytes)>1048576||!sha(supplied.sha256,64))throw Error('receipt-invalid')
   const digest=createHash('sha256').update(supplied.bytes).digest('hex')
   if(digest!==supplied.sha256)throw Error('receipt-invalid')
   result.inputSha256[key]=digest
   const value=JSON.parse(supplied.bytes)
   if(!record(value))throw Error('receipt-invalid')
   return value
  }
  const declaration=parse('declaration'),operations=parse('operations'),build=parse('nativeBuild'),native=parse('nativeReceipts')
  if(!exactKeys(declaration,['sourceHead','baseSha','syntheticWebOperations','syntheticAndroidEmulator','excludedSurfaces','operationalLimits','rollbackDependencies','productionCapacityClaim','providerUpgradeAuthorized','productionLoadTestAuthorized'])||declaration.sourceHead!==input.sourceHead||declaration.baseSha!==input.baseSha)return fail('declaration-binding-invalid')
  if(!['verified','unavailable'].includes(declaration.syntheticWebOperations)||!['verified','unavailable'].includes(declaration.syntheticAndroidEmulator))return fail('declaration-status-invalid')
  if(!Array.isArray(declaration.excludedSurfaces)||declaration.excludedSurfaces.length!==excluded.length||new Set(declaration.excludedSurfaces).size!==excluded.length||excluded.some(id=>!declaration.excludedSurfaces.includes(id)))return fail('surface-exclusions-invalid')
  if(declaration.productionCapacityClaim!==false||declaration.providerUpgradeAuthorized!==false||declaration.productionLoadTestAuthorized!==false)return fail('authority-claim-invalid')
  // No approved limit/recovery receipt format exists yet. Do not accept assertions
  // of readiness, numeric defaults or a unit comparator as such a receipt.
  if(declaration.operationalLimits!=='unavailable'||declaration.rollbackDependencies!=='unavailable')return fail('unsupported-readiness-claim')
  if(operations!==null){
   const issues=[]
   if(!exactKeys(operations,receiptKeys)||operations.sourceHead!==input.sourceHead||operations.finalHead!==input.sourceHead||operations.baseSha!==input.baseSha)issues.push('operations-binding-mismatch')
   if(!record(operations)||operations.baseVerified!==true||operations.sourceClean!==true||operations.candidateVerified!==true||operations.exitCode!==0||operations.hostedOperations!==false||operations.professionalApproval!==false||operations.providerApproval!==false)issues.push('operations-not-qualified')
   if(typeof operations?.executionId!=='string'||!/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(operations.executionId)||
    typeof operations.startedAt!=='string'||typeof operations.finishedAt!=='string'||!Number.isFinite(Date.parse(operations.startedAt))||!Number.isFinite(Date.parse(operations.finishedAt))||Date.parse(operations.finishedAt)<Date.parse(operations.startedAt)||
    !Array.isArray(operations.commandArgv)||operations.commandArgv.length!==2||operations.commandArgv.some(value=>typeof value!=='string'||value.length>512)||!/(^|\/)apps\/doctor-suit\/tests\/operations-actual-provider\.mjs$/.test(operations.commandArgv[1])||operations.stage!=='actual M3 browser assertions')issues.push('operations-execution-binding-invalid')
   const browser=operations?.browserResult
   if(!record(browser)||browser.exitCode!==0||browser.accepted!==true||!sha(browser.logSha256,64)||!Array.isArray(browser.expected)||!Array.isArray(browser.passed)||!Array.isArray(browser.failed)||browser.failed.length||!Array.isArray(browser.issues)||browser.issues.length)issues.push('operations-browser-invalid')
   for(const population of[browser?.expected,browser?.passed])if(!Array.isArray(population)||population.length!==10||new Set(population).size!==10||doctorOperationsTaskIds.some(id=>!population.includes(id)))issues.push('operations-population-invalid')
   result.webOperations={status:issues.length?'failed':'verified',issues:[...new Set(issues)]}
  }
  if(build!==null||native!==null){
   const matching=record(build)&&build.sourceHead===input.sourceHead
   const inspected=inspectNativeCandidate(build,native)
   result.androidEmulator={status:matching&&inspected.consistentSyntheticSubset?'verified':'failed',issues:matching?inspected.issues:['native-binding-mismatch']}
  }
  for(const[name,claim]of[['webOperations','syntheticWebOperations'],['androidEmulator','syntheticAndroidEmulator']]){
   if(result[name].status==='failed')result.issues.push(name==='webOperations'?'operations-receipt-failed':'native-receipt-failed')
   else if(result[name].status!==declaration[claim])result.issues.push(name==='webOperations'?'operations-declaration-mismatch':'native-declaration-mismatch')
  }
  result.comparisonStatus=result.issues.length?'failed':(result.webOperations.status==='verified'||result.androidEmulator.status==='verified')?'consistent-partial-scope':'unavailable'
  return result
 }catch{return fail('receipt-invalid')}
}

// Called only by the existing owned M3 runner after source/cleanup verification.
// It compares the current web observation while explicitly leaving native,
// capacity and rollback evidence unavailable; it cannot qualify those surfaces.
export function doctorOperationalWebReceipt(operations) {
 try {
 const sourceHead=sha(operations?.sourceHead,40)?operations.sourceHead:null
 const baseSha=sha(operations?.baseSha,40)?operations.baseSha:null
 const pack=value=>{const bytes=JSON.stringify(value);return{bytes,sha256:createHash('sha256').update(bytes).digest('hex')}}
 const declaration={sourceHead,baseSha,syntheticWebOperations:'verified',syntheticAndroidEmulator:'unavailable',excludedSurfaces:[...excluded],operationalLimits:'unavailable',rollbackDependencies:'unavailable',productionCapacityClaim:false,providerUpgradeAuthorized:false,productionLoadTestAuthorized:false}
 const compared=compareDoctorOperationalSupport({sourceHead,baseSha,declaration:pack(declaration),operations:pack(operations),nativeBuild:null,nativeReceipts:null})
 return{...compared,sourceHead,baseSha,comparisonPassed:compared.comparisonStatus==='consistent-partial-scope',canonicalCaseAccepted:false}
 }catch{return{...compareDoctorOperationalSupport(null),sourceHead:null,baseSha:null,comparisonPassed:false,canonicalCaseAccepted:false}}
}
