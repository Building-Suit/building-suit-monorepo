import type { createDoctorAuthController } from '../utils/authController'
import type { createDoctorPracticeController } from '../utils/practiceController'
import type { createDoctorContextController } from '../utils/contextController'
import type { createDoctorLocationsController } from '../utils/locationsController'
import type { DoctorContextScope } from '../utils/contextScope'
declare module '#app' {
  interface NuxtApp {
    $doctorAuth: ReturnType<typeof createDoctorAuthController>
    $doctorPractice: ReturnType<typeof createDoctorPracticeController>
    $doctorContext: ReturnType<typeof createDoctorContextController>
    $doctorLocations: ReturnType<typeof createDoctorLocationsController>
    $doctorLocationsScope: () => DoctorContextScope | null
  }
}
export {}
