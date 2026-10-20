import type{createFulfillmentController}from'../utils/operationalFulfillment'
import type{createMessageOutboxReader}from'../utils/messageOutbox'
import type{createContactPreferencesController}from'../utils/contactPreferencesController'
import type{createWorklistsController}from'../utils/worklistsController'
import type{createWaitlistController}from'../utils/waitlistController'
import type {createConsultationsController} from '../utils/consultationsController'
import type {createClinicalReleaseController} from '../utils/clinicalReleaseController'
import type{createManualReportController}from'../utils/manualReconciliationController'
import type{createManualPaymentController}from'../utils/manualPaymentController'
import type { createDoctorAuditController } from '../utils/auditController'
import type { DoctorAuditScope } from '../utils/administrativeAudit'
import type { createDoctorAccountController } from '../utils/accountController'
import type { createDoctorAuthController } from '../utils/authController'
import type { createDoctorPracticeController } from '../utils/practiceController'
import type { createDoctorContextController } from '../utils/contextController'
import type { createDoctorLocationsController } from '../utils/locationsController'
import type { DoctorContextScope } from '../utils/contextScope'
import type { createDoctorTeamController } from '../utils/teamController'
import type { createDoctorInvitationController } from '../utils/invitationController'
import type { createDoctorPatientsController } from '../utils/patientsController'
import type { DoctorLocationContext } from '../utils/locationContext'
import type { createClinicalController } from '../utils/clinicalController'
declare module '#app' {
  interface NuxtApp {
    $doctorFulfillment:ReturnType<typeof createFulfillmentController>
    $doctorOutbox: ReturnType<typeof createMessageOutboxReader>
    $doctorContactPreferences:ReturnType<typeof createContactPreferencesController>
    $doctorWorklists:ReturnType<typeof createWorklistsController>
    $doctorWaitlist:ReturnType<typeof createWaitlistController>
    $doctorConsultations:ReturnType<typeof createConsultationsController>
    $doctorClinicalRelease:ReturnType<typeof createClinicalReleaseController>
    $doctorClinical:ReturnType<typeof createClinicalController>
    $doctorManualReport: ReturnType<typeof createManualReportController>
    $doctorManualPayment: ReturnType<typeof createManualPaymentController>
    $doctorAudit: ReturnType<typeof createDoctorAuditController>
    $doctorPersonalAudit: ReturnType<typeof createDoctorAuditController>
    $doctorAuditScope: () => DoctorAuditScope|null
    $doctorPersonalAuditScope: () => DoctorAuditScope|null
    $doctorAccount: ReturnType<typeof createDoctorAccountController>
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
