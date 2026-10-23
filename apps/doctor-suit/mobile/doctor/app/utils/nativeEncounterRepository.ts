import {clinicalDirectory,verifyClinicalDetail,clinicalCommandResult,type DoctorMobileContext,type ClinicalSnapshot} from '@building-suit/contracts'
import {createNativeScopedRpc} from './nativeScopedRpc.ts'
const owner=(scope:DoctorMobileContext)=>{if(scope.portal!=='doctor'||scope.userId!==scope.doctorId)throw Object.assign(new Error('Current doctor access required'),{code:'42501'})}
export function createNativeEncounterRepository(...dependencies:Parameters<typeof createNativeScopedRpc>) {
  const rpc=createNativeScopedRpc(...dependencies)
  async function directory(scope:DoctorMobileContext,page:number,search:string,signal:AbortSignal){
    owner(scope)
    if(!Number.isSafeInteger(page)||page<0||search.length>160)throw new Error('Invalid encounter query')
    return clinicalDirectory(await rpc('doctor_clinical_workspace',{p_page:page,p_search:search},scope,signal,null,8388608))
  }
  async function writable(scope:DoctorMobileContext,signal:AbortSignal,capability:'draft'|'sign'|'review'='draft'){
    const fresh=await directory(scope,0,'',signal)
    if(!fresh.available||!fresh.capabilities.includes(capability))throw Object.assign(new Error('Synthetic draft access required'),{code:'42501'})
  }
  return{
    directory,
    async detail(scope:DoctorMobileContext,id:string,signal:AbortSignal,page=0){owner(scope);return verifyClinicalDetail(await rpc('doctor_clinical_detail',{p_encounter:id,p_page:page},scope,signal,null,8388608),scope.practiceId,scope.locationId,id)},
    async save(scope:DoctorMobileContext,id:string,version:number,snapshot:ClinicalSnapshot,key:string,signal:AbortSignal){
      await writable(scope,signal)
      return clinicalCommandResult(await rpc('doctor_clinical_command',{p_encounter:id,p_expected_version:version,p_action:'save',p_input:{snapshot},p_key:key},scope,signal,null,8388608))
    },
    async start(scope:DoctorMobileContext,id:string,version:number,key:string,signal:AbortSignal){
      await writable(scope,signal)
      return clinicalCommandResult(await rpc('doctor_clinical_command',{p_encounter:id,p_expected_version:version,p_action:'start',p_input:{},p_key:key},scope,signal,null,8388608))
    },
    async transition(scope:DoctorMobileContext,id:string,version:number,action:'amend'|'withdraw',reason:string,key:string,signal:AbortSignal){
      await writable(scope,signal,action==='amend'?'review':'sign')
      return clinicalCommandResult(await rpc('doctor_clinical_command',{p_encounter:id,p_expected_version:version,p_action:action,p_input:{reason},p_key:key},scope,signal,null,8388608))
    },
    async finalize(scope:DoctorMobileContext,id:string,version:number,reviewedVersion:string,sha256:string,key:string,signal:AbortSignal){
      await writable(scope,signal,'sign')
      return clinicalCommandResult(await rpc('doctor_clinical_command',{p_encounter:id,p_expected_version:version,p_action:'finalize',p_input:{reviewed_version_id:reviewedVersion,reviewed_sha256:sha256},p_key:key},scope,signal,null,8388608))
    },
    async create(scope:DoctorMobileContext,patientId:string,snapshot:ClinicalSnapshot,key:string,signal:AbortSignal){
      await writable(scope,signal)
      return clinicalCommandResult(await rpc('doctor_clinical_command',{p_encounter:null,p_expected_version:null,p_action:'create',p_input:{patient_id:patientId,snapshot},p_key:key},scope,signal,null,8388608))
    },
  }
}
