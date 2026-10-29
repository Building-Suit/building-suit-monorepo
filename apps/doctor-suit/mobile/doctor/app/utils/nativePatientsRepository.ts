import {doctorPatientDirectory,doctorPatientProfile,doctorDocumentDirectory} from '@building-suit/contracts'
import type {NativePatientsPort} from './nativePatients.ts'
import {createNativeScopedRpc} from './nativeScopedRpc.ts'
export function createNativePatientsRepository(...dependencies:Parameters<typeof createNativeScopedRpc>):NativePatientsPort {
  const rpc=createNativeScopedRpc(...dependencies)
  return {
    async directory(scope,query,signal){return doctorPatientDirectory(await rpc('doctor_patients',{p_page:query.page,p_size:query.size,p_search:query.search,p_status:query.status},scope,signal),scope.practiceId)},
    async profile(scope,patientId,signal){return doctorPatientProfile(await rpc('doctor_patient_profile',{p_patient:patientId},scope,signal),scope.practiceId,patientId)},
    async documents(scope,patientId,signal){return doctorDocumentDirectory(await rpc('doctor_patient_documents',{p_patient:patientId,p_page:0,p_size:25},scope,signal,'documents.read'),scope.practiceId,patientId)},
    // Read permission alone does not approve device custody or a file cache.
    async download(){throw Object.assign(new Error('Document delivery requires approved device policy'),{code:'DEVICE_POLICY_REQUIRED'})},
  }
}
