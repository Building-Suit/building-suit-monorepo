import {createHash} from 'node:crypto'
import {doctorDocumentPlan,documentRecord,documentUuid} from '../../supabase/functions/doctor-documents/contracts.ts'

// Unit-level integrity of supplied synthetic material only. No fetching, file
// reads, Storage access, restore, authorization or operational approval.
export function verifyDoctorRecoveryDocumentBytes(input){
 const issues=new Set();let expectedVersions=0,verifiedVersions=0
 const result=()=>({scope:'supplied-document-version-bytes',status:issues.size?'failed':expectedVersions?'verified':'no-evidence',
  documentIntegrityVerified:issues.size===0&&expectedVersions>0,expectedVersions,verifiedVersions,issues:[...issues].sort(),
  manifestCompletenessVerified:false,authorizationEstablished:false,restoreExecuted:false,taskAcceptance:false,clinicalApproval:false})
 try{
  if(!documentRecord(input)||Object.keys(input).some(key=>!['practiceId','versions','objects'].includes(key))||!documentUuid(input.practiceId)||!Array.isArray(input.versions)||!Array.isArray(input.objects)){issues.add('invalid-input');return result()}
  expectedVersions=input.versions.length
  const versions=new Map(),paths=new Set(),revisions=new Set()
  for(const row of input.versions){
   if(!documentRecord(row)||!documentUuid(row.id)||!documentUuid(row.practice_id)||!documentUuid(row.patient_id)||!documentUuid(row.location_id)||!Number.isInteger(row.revision)||row.revision<1||row.revision>2147483647||row.provenance!=='uploaded_unreviewed'||typeof row.mime_type!=='string'||typeof row.filename!=='string'||[...row.filename].length<1||[...row.filename].length>160){issues.add('invalid-version');continue}
   if(row.practice_id!==input.practiceId){issues.add('scope-mismatch');continue}
   let plan
   try{plan=doctorDocumentPlan({...row,version_id:row.id},{practiceId:input.practiceId,patientId:row.patient_id,locationId:row.location_id})}catch{issues.add('invalid-version');continue}
   const revision=plan.documentId+':'+row.revision
   if(versions.has(plan.versionId)||paths.has(plan.objectPath)||revisions.has(revision)){issues.add('duplicate-version');continue}
   versions.set(plan.versionId,plan);paths.add(plan.objectPath);revisions.add(revision)
  }
  // Invalid metadata cannot produce a partially accepted comparison.
  if(issues.size)return result()
  const objects=new Map(),objectPaths=new Set()
  for(const object of input.objects){
   if(!documentRecord(object)||Object.keys(object).some(key=>!['version_id','object_path','bytes'].includes(key))){issues.add('invalid-object');continue}
   const id=object.version_id,objectPath=object.object_path,bytes=object.bytes
   if(!documentUuid(id)||typeof objectPath!=='string'||!(bytes instanceof Uint8Array)||bytes.buffer instanceof SharedArrayBuffer){issues.add('invalid-object');continue}
   if(objects.has(id)||objectPaths.has(objectPath)){issues.add('duplicate-object');continue}
   objects.set(id,{object_path:objectPath,bytes});objectPaths.add(objectPath)
   if(!versions.has(id))issues.add('unexpected-object')
  }
  for(const[id,plan]of versions){
   const object=objects.get(id)
   if(!object){issues.add('missing-object');continue}
   if(object.object_path!==plan.objectPath){issues.add('binding-mismatch');continue}
   if(object.bytes.byteLength!==plan.size){issues.add('size-mismatch');continue}
   if(createHash('sha256').update(object.bytes).digest('hex')!==plan.sha256){issues.add('digest-mismatch');continue}
   verifiedVersions++
  }
  return result()
 }catch{issues.add('invalid-input');return result()}
}
