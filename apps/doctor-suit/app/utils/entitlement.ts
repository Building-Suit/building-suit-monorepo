import type { DoctorEditionMode } from './administrativeEdition'
export interface DoctorEntitlement {
  state: 'preview' | 'unconfigured' | 'trial' | 'paid' | 'expired' | 'scheduled' | 'suspended'
  revision: number; writesAllowed: boolean; canAddStaff: boolean; canAddClinic: boolean; overLimit: boolean
  validUntil: string | null; observedAt: string
}
const record = (value: unknown): value is Record<string,unknown> => Boolean(value && typeof value==='object' && !Array.isArray(value))
function invalid(): never { throw new Error('DOCTOR_ENTITLEMENT_RESPONSE_INVALID') }
function stamp(value: unknown): string {
  if(typeof value!=='string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}:\d{2})$/.test(value) || !Number.isFinite(Date.parse(value)))invalid()
  return new Date(value).toISOString()
}
/** Candidate metadata is required. A preview response cannot grant live access. */
export function doctorEntitlement(value: unknown,edition: DoctorEditionMode | undefined): DoctorEntitlement | undefined {
  if(value===undefined && edition!=='administrative_candidate')return undefined
  if(!record(value) || !Number.isSafeInteger(value.revision) || Number(value.revision)<0
    || !['preview','unconfigured','trial','paid','expired','scheduled','suspended'].includes(String(value.state))
    || ['writes_allowed','can_add_staff','can_add_clinic','over_limit'].some(field=>typeof value[field]!=='boolean'))invalid()
  const observedAt=stamp(value.observed_at);const validUntil=value.valid_until===null?null:stamp(value.valid_until)
  if(value.state==='preview') {
    if(edition!=='synthetic_preview' || value.revision!==0 || validUntil!==null || !value.writes_allowed || !value.can_add_staff || !value.can_add_clinic || value.over_limit)invalid()
  } else {
    if(edition!=='administrative_candidate')invalid()
    if(value.state==='unconfigured') { if(value.revision!==0 || validUntil!==null || value.over_limit)invalid() }
    else if(value.revision===0 || validUntil===null)invalid()
    if(!['trial','paid'].includes(String(value.state)) && (value.writes_allowed || value.can_add_staff || value.can_add_clinic))invalid()
    if(['trial','paid'].includes(String(value.state)) && (!validUntil || observedAt>=validUntil || (!value.over_limit && !value.writes_allowed)))invalid()
    if(value.state==='expired' && validUntil && observedAt<validUntil)invalid()
    if((value.can_add_staff || value.can_add_clinic) && (!value.writes_allowed || value.over_limit))invalid()
  }
  return { state: value.state as DoctorEntitlement['state'],revision:Number(value.revision),writesAllowed:value.writes_allowed as boolean,
    canAddStaff:value.can_add_staff as boolean,canAddClinic:value.can_add_clinic as boolean,overLimit:value.over_limit as boolean,validUntil,observedAt }
}
/** Observation changes refresh deadlines, never the authority/cache epoch. */
export function doctorEntitlementKey(value: DoctorEntitlement | undefined): unknown[] {
  return value ? [value.state,value.revision,value.writesAllowed,value.canAddStaff,value.canAddClinic,value.overLimit,value.validUntil] : []
}
export interface DoctorEntitlementTimers { now(): number; set(callback: ()=>void,delay: number): unknown; clear(handle: unknown): void }
/** Timers only remove a read model's authority; a new server read may replace it. */
export function createDoctorEntitlementDeadline(timers?: DoctorEntitlementTimers) {
  let sequence=0;let handle: unknown
  function clear(){sequence++;if(handle!==undefined)timers?.clear(handle);handle=undefined}
  function arm(value: DoctorEntitlement|undefined,sentAt: number,expired: ()=>void,accepts: ()=>boolean){
    clear();if(!timers || !value || !['trial','paid'].includes(value.state) || !value.validUntil)return
    const token=sequence;const deadline=timers.now()+Math.max(0,Date.parse(value.validUntil)-Date.parse(value.observedAt)-Math.max(0,timers.now()-sentAt))
    function tick(){
      if(token!==sequence || !accepts())return
      handle=undefined;const left=deadline-timers!.now()
      if(left>0){handle=timers!.set(tick,Math.min(Math.ceil(left),2147483647));return}
      clear();expired()
    }
    handle=timers.set(tick,Math.min(Math.ceil(deadline-timers.now()),2147483647))
  }
  return{clear,arm}
}
