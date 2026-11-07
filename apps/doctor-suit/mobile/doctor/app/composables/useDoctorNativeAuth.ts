import type{createNativeSession}from'../utils/nativeSession'
export function useDoctorNativeAuth(){
 const app=useNuxtApp()
 if(!app.$doctorNativeSession||!app.$doctorNativeAvailability)throw new Error('Native session unavailable')
 return{auth:app.$doctorNativeSession as ReturnType<typeof createNativeSession>,readiness:app.$doctorNativeAvailability as Ref<'checking'|'enabled'|'disabled'>}
}
