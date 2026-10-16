import type { createDoctorAuthController } from '../utils/authController'
import type { createDoctorPracticeController } from '../utils/practiceController'
declare module '#app' {
  interface NuxtApp { $doctorAuth: ReturnType<typeof createDoctorAuthController>; $doctorPractice: ReturnType<typeof createDoctorPracticeController> }
}
export {}
