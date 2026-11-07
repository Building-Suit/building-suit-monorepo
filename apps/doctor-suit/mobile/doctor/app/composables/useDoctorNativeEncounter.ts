import type {createNativeEncounter} from '../utils/nativeEncounter'
export function useDoctorNativeEncounter(){
 const service=useNuxtApp().$doctorNativeEncounter
 if(!service)throw new Error('Native encounter service unavailable')
 return service as ReturnType<typeof createNativeEncounter>
}
