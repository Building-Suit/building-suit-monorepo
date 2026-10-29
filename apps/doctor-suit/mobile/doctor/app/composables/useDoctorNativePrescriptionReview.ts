import type {createNativePrescriptionReview} from '../utils/nativePrescriptionReview'
export function useDoctorNativePrescriptionReview(){
 const service=useNuxtApp().$doctorNativePrescriptionReview
 if(!service)throw new Error('Native prescription review unavailable')
 return service as ReturnType<typeof createNativePrescriptionReview>
}
