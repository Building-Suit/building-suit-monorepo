import type { createDoctorAuthController } from '../utils/authController'
import type { createDoctorPracticeController } from '../utils/practiceController'
import type { createDoctorContextController } from '../utils/contextController'
import type { createDoctorLocationsController } from '../utils/locationsController'
import type { DoctorContextScope } from '../utils/contextScope'
import type { createDoctorTeamController } from '../utils/teamController'
import type { createDoctorInvitationController } from '../utils/invitationController'
import type { createDoctorPatientsController } from '../utils/patientsController'
import type { DoctorLocationContext } from '../utils/locationContext'
declare module '#app' {
  interface NuxtApp {
    $doctorAuth: ReturnType<typeof createDoctorAuthController>
    $doctorPractice: ReturnType<typeof createDoctorPracticeController>
    $doctorContext: ReturnType<typeof createDoctorContextController>
    $doctorLocations: ReturnType<typeof createDoctorLocationsController>
    $doctorLocationsScope: () => DoctorContextScope | null
    $doctorTeam: ReturnType<typeof createDoctorTeamController>
    $doctorTeamScope: () => DoctorContextScope | null
    $doctorPatients: ReturnType<typeof createDoctorPatientsController>
    $doctorPatientsScope: () => DoctorLocationContext | null
    $doctorInvitation: ReturnType<typeof createDoctorInvitationController>
  }
}
export {}
