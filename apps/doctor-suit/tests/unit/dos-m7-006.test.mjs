import test from 'node:test'
import assert from 'node:assert/strict'
import {createHash} from 'node:crypto'
import {verifyDoctorRecoveryDocumentBytes} from '../helpers/recovery-document-integrity.mjs'

const id=n=>`d7060000-0000-4000-8000-${String(n).padStart(12,'0')}`
function fixture(){
 const versions=[1,2].map(revision=>{
  const bytes=new TextEncoder().encode(`%PDF-1.7\nSynthetic immutable version ${revision}\n%%EOF`)
  return{row:{id:id(10+revision),practice_id:id(1),patient_id:id(2),location_id:id(3),document_id:id(4),revision,provenance:'uploaded_unreviewed',filename:'synthetic.pdf',mime_type:'application/pdf',byte_size:bytes.byteLength,sha256:createHash('sha256').update(bytes).digest('hex'),object_path:`${id(1)}/${id(2)}/${id(4)}/${id(20+revision)}.pdf`},bytes}
 })
 return{practiceId:id(1),versions:versions.map(v=>v.row),objects:versions.map(v=>({version_id:v.row.id,object_path:v.row.object_path,bytes:v.bytes}))}
}
const verify=value=>verifyDoctorRecoveryDocumentBytes(value)
function fails(value,issue){const result=verify(value);assert.equal(result.status,'failed');assert.equal(result.documentIntegrityVerified,false);assert.ok(result.issues.includes(issue));assert.equal(result.taskAcceptance,false);return result}

test('C02 unit subset: supplied historical document versions match stored byte_size and SHA-256 without granting recovery acceptance',()=>{
 const input=fixture(),before=structuredClone(input);input.objects.reverse()
 const result=verify(input)
 assert.equal(result.documentIntegrityVerified,true);assert.equal(result.verifiedVersions,2);assert.deepEqual(result.issues,[])
 for(const flag of['manifestCompletenessVerified','authorizationEstablished','restoreExecuted','taskAcceptance','clinicalApproval'])assert.equal(result[flag],false)
 assert.deepEqual(input.versions,before.versions);assert.deepEqual(input.objects,[...before.objects].reverse())
})
test('C02 unit subset: missing historical bytes fail even when the latest version is present',()=>{
 const input=fixture();input.objects.shift();const result=fails(input,'missing-object');assert.equal(result.verifiedVersions,1)
 input.objects=[];assert.equal(fails(input,'missing-object').verifiedVersions,0)
})
test('C02 unit subset: altered and truncated object bytes fail their independent integrity checks',()=>{
 const altered=fixture();altered.objects[0].bytes[0]^=1;fails(altered,'digest-mismatch')
 const truncated=fixture();truncated.objects[0].bytes=truncated.objects[0].bytes.subarray(1);fails(truncated,'size-mismatch')
 const metadata=fixture();metadata.versions[0].sha256='0'.repeat(64);fails(metadata,'digest-mismatch')
})
test('C02 unit subset: version/object identity and scope binding cannot be replaced by matching bytes',()=>{
 const changed=fixture();changed.objects[0].object_path=changed.objects[1].object_path+'x';fails(changed,'binding-mismatch')
 const foreign=fixture();foreign.versions[0].practice_id=id(99);fails(foreign,'scope-mismatch')
 const patient=fixture();patient.versions[0].patient_id=id(99);fails(patient,'invalid-version')
 const document=fixture();document.versions[0].document_id=id(99);fails(document,'invalid-version')
 const extra=fixture();extra.objects.push({...extra.objects[0],version_id:id(99),object_path:extra.objects[0].object_path+'x'});fails(extra,'unexpected-object')
})
test('C02 unit subset: duplicate IDs, object paths and document revisions cannot conceal omitted material',()=>{
 for(const change of[
  value=>value.versions[1].id=value.versions[0].id,
  value=>value.versions[1].object_path=value.versions[0].object_path,
  value=>value.versions[1].revision=value.versions[0].revision,
 ]){const input=fixture();change(input);fails(input,'duplicate-version')}
 const object=fixture();object.objects.push(object.objects[0]);fails(object,'duplicate-object')
})
test('C02 unit subset: stored document constraints reject invalid or coerced metadata',()=>{
 const unicode=fixture();unicode.versions[0].filename='😀'.repeat(160);assert.equal(verify(unicode).documentIntegrityVerified,true)
 for(const patch of[{byte_size:0},{byte_size:5242881},{byte_size:'44'},{sha256:'invalid'},{revision:0},{revision:2147483648},{revision:'1'},{filename:''},{filename:'x'.repeat(161)},{filename:'😀'.repeat(161)},{mime_type:'text/html'},{provenance:'clinically_approved'},{object_path:'../../private.sentinel'}]){
  const input=fixture();Object.assign(input.versions[0],patch);fails(input,'invalid-version')
 }
 const coerced=fixture();coerced.versions[0].mime_type={toString(){throw Error('must not coerce')}};fails(coerced,'invalid-version')
})
test('C02 unit subset: empty, malformed and concurrently mutable material supplies no acceptance',()=>{
 const empty=verify({practiceId:id(1),versions:[],objects:[]});assert.equal(empty.status,'no-evidence');assert.equal(empty.documentIntegrityVerified,false)
 for(const input of[null,{}, {practiceId:id(1),versions:[],objects:[],approved:true}])fails(input,'invalid-input')
 const invalid=fixture();invalid.objects[0].bytes=[1,2,3];fails(invalid,'invalid-object')
 const shared=fixture();shared.objects[0].bytes=new Uint8Array(new SharedArrayBuffer(shared.objects[0].bytes.byteLength));fails(shared,'invalid-object')
})
test('C02 unit subset: receipts contain no document names, paths, identities, digests, bytes or arbitrary exceptions',()=>{
 const input=fixture();input.versions[0].filename='private.sentinel.pdf';input.objects[0].bytes[0]^=1
 const result=fails(input,'digest-mismatch'),serialized=JSON.stringify(result)
 for(const privateValue of['private.sentinel',id(1),id(2),input.versions[0].object_path,input.versions[0].sha256])assert.equal(serialized.includes(privateValue),false)
 const exceptional=fixture();Object.defineProperty(exceptional.objects[0],'bytes',{get(){throw Error('private.sentinel')}})
 assert.equal(JSON.stringify(fails(exceptional,'invalid-input')).includes('private.sentinel'),false)
})
