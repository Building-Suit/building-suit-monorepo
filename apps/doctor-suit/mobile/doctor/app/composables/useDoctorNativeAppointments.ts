import type {createNativeAppointments,NativeScheduleScope} from '../utils/nativeAppointments'
export function useDoctorNativeAppointments(){const app=useNuxtApp();return {appointments:app.$doctorNativeAppointments as ReturnType<typeof createNativeAppointments>,scope:app.$doctorNativeAppointmentScope as ()=>NativeScheduleScope|null}}
