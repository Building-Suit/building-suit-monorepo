import {doctorUuid} from './locationContext.ts'
export interface ConsultationType {id:string;practice_id:string;version:number;name:string;duration_minutes:number;buffer_before:number;buffer_after:number;capacity:1;location_ids:string[];active:boolean}
export interface ConsultationInput {name:string;duration_minutes:number;buffer_before:number;buffer_after:number;capacity:1;location_ids:string[];active:boolean}
const record=(v:unknown):v is Record<string,unknown>=>Boolean(v&&typeof v==='object'&&!Array.isArray(v))
const integer=(v:unknown,min:number,max:number):v is number=>Number.isSafeInteger(v)&&Number(v)>=min&&Number(v)<=max
export function validConsultationInput(v:unknown):v is ConsultationInput {
 return record(v)&&typeof v.name==='string'&&v.name.trim().length>0&&v.name.length<=100&&!Array.from(v.name).some(c=>c.charCodeAt(0)<32||c.charCodeAt(0)===127)&&integer(v.duration_minutes,5,120)&&integer(v.buffer_before,0,120)&&integer(v.buffer_after,0,120)&&v.capacity===1&&typeof v.active==='boolean'&&Array.isArray(v.location_ids)&&v.location_ids.length>0&&v.location_ids.length<=100&&v.location_ids.every(doctorUuid)&&new Set(v.location_ids).size===v.location_ids.length
}
export function consultationType(v:unknown,practice:string):ConsultationType {
 if(!validConsultationInput(v)||!record(v)||v.practice_id!==practice||!doctorUuid(v.id)||!integer(v.version,1,2147483647))throw new Error('DOCTOR_CONSULTATION_RESPONSE_INVALID')
 return {id:v.id,practice_id:practice,version:v.version,name:v.name,duration_minutes:v.duration_minutes,buffer_before:v.buffer_before,buffer_after:v.buffer_after,capacity:1,location_ids:[...v.location_ids],active:v.active}
}
export function consultationDirectory(v:unknown,practice:string,location:string){
 if(!record(v)||v.practice_id!==practice||v.location_id!==location||v.data_mode!=='synthetic'||v.capacity!==1||v.override_policy!=='deny'||typeof v.can_manage!=='boolean'||!Array.isArray(v.types))throw new Error('DOCTOR_CONSULTATION_RESPONSE_INVALID')
 const types=v.types.map(t=>consultationType(t,practice));if(new Set(types.map(t=>t.id)).size!==types.length||types.some(t=>!t.location_ids.includes(location)))throw new Error('DOCTOR_CONSULTATION_RESPONSE_INVALID')
 return{types,canManage:v.can_manage}
}
