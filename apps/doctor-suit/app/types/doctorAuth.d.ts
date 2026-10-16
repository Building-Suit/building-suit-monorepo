import type { createDoctorAuthController } from '../utils/authController'
declare module '#app' {
  interface NuxtApp { $doctorAuth: ReturnType<typeof createDoctorAuthController> }
}
export {}
