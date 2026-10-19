import type{DoctorSaasTermsVersion}from'./saasTerms'
export interface DoctorSaasTermsDocument{termsId:string;documentRef:string;english:string;arabic:string}
export function doctorSaasTermsDocument(value:unknown,terms:DoctorSaasTermsVersion):DoctorSaasTermsDocument|null{
 if(value===null)return null
 if(!value||typeof value!=='object')throw Error('DOCTOR_SAAS_DOCUMENT_INVALID')
 const row=value as Record<string,unknown>
 if(row.terms_id!==terms.id||row.document_ref!==terms.termsDocumentRef||row.data_mode!=='synthetic'||typeof row.content_en!=='string'||typeof row.content_ar!=='string'||[row.content_en,row.content_ar].some(text=>text.trim().length<20||text.length>50000))throw Error('DOCTOR_SAAS_DOCUMENT_INVALID')
 return{termsId:terms.id,documentRef:terms.termsDocumentRef,english:row.content_en,arabic:row.content_ar}
}
