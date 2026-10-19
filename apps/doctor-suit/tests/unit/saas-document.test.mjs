import test from'node:test'
import assert from'node:assert/strict'
import{doctorSaasTermsDocument}from'../../app/utils/saasTermsDocument.ts'
const terms={id:'ae210000-0000-0000-0000-000000000001',termsDocumentRef:'synthetic-document/v1'}
const raw={terms_id:terms.id,document_ref:terms.termsDocumentRef,data_mode:'synthetic',content_en:'Synthetic review text only, not legal approval.',content_ar:'وثيقة اختبار اصطناعية فقط دون موافقة قانونية.'}
test('version document is nullable and bound to exact terms/ref with both full language texts',()=>{
 assert.equal(doctorSaasTermsDocument(null,terms),null);assert.equal(doctorSaasTermsDocument(raw,terms).english,raw.content_en)
 for(const change of[{terms_id:'ae210000-0000-0000-0000-000000000002'},{document_ref:'synthetic-document/v2'},{data_mode:'live'},{content_ar:''},{content_en:'x'.repeat(50001)}])assert.throws(()=>doctorSaasTermsDocument({...raw,...change},terms))
})
