import type{DoctorIdentity}from'./authController'
import{doctorUuid}from'./locationContext.ts'
export const doctorPrivacyKinds=['access_review','correction_review','erasure_review','restriction_review']as const
export type DoctorPrivacyKind=typeof doctorPrivacyKinds[number]
export interface DoctorPrivacyRequest{id:string;kind:DoctorPrivacyKind;state:'awaiting_review';createdAt:string}
export function doctorPrivacyRequest(value:unknown):DoctorPrivacyRequest{
 if(!value||typeof value!=='object')throw Error('DOCTOR_PRIVACY_INVALID')
 const row=value as Record<string,unknown>
 if(!doctorUuid(row.id)||!doctorPrivacyKinds.includes(row.kind as DoctorPrivacyKind)||row.state!=='awaiting_review'||typeof row.created_at!=='string'||!Number.isFinite(Date.parse(row.created_at)))throw Error('DOCTOR_PRIVACY_INVALID')
 return{id:row.id,kind:row.kind as DoctorPrivacyKind,state:'awaiting_review',createdAt:row.created_at}
}
export function doctorPrivacySnapshot(value:unknown,actor:DoctorIdentity):DoctorPrivacyRequest[]{
 if(!value||typeof value!=='object')throw Error('DOCTOR_PRIVACY_INVALID')
 const row=value as Record<string,unknown>
 if(row.user_id!==actor.userId||row.scope!=='own_account'||row.data_mode!=='synthetic'||row.policy_configured!==false||row.fulfillment_available!==false||!Array.isArray(row.items)||row.items.length>4)throw Error('DOCTOR_PRIVACY_INVALID')
 const items=row.items.map(doctorPrivacyRequest)
 if(new Set(items.map(x=>x.kind)).size!==items.length||new Set(items.map(x=>x.id)).size!==items.length)throw Error('DOCTOR_PRIVACY_INVALID')
 return items
}
