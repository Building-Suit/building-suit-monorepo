import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../types/database.types'
import { doctorAppointmentBoard,doctorAppointmentHistory,doctorAppointmentResult,type DoctorAppointmentQuery,type DoctorAppointmentCommand } from './appointments.ts'
import { doctorAvailabilityRepository } from './availabilityRepository'
import { doctorPatientsRepository } from './patientsRepository'
export function doctorAppointmentsRepository(client: SupabaseClient<Database>) {
  const availability = doctorAvailabilityRepository(client); const patients = doctorPatientsRepository(client)
  return {
    async board(practiceId: string,locationId: string,query: DoctorAppointmentQuery,signal: AbortSignal) { const { data,error } = await client.rpc('doctor_appointment_board',{ p_practice: practiceId,p_location: locationId,p_day: query.date,p_page: query.page,p_queue_page: query.queuePage }).abortSignal(signal);if(error)throw error;return doctorAppointmentBoard(data,practiceId,locationId,query) },
    async history(practiceId: string,locationId: string,appointmentId: string,page: number,signal: AbortSignal) { const { data,error } = await client.rpc('doctor_appointment_history',{ p_practice: practiceId,p_location: locationId,p_appointment: appointmentId,p_page: page }).abortSignal(signal);if(error)throw error;return doctorAppointmentHistory(data,practiceId,locationId,appointmentId,page) },
    async patients(practiceId: string,locationId: string,search: string,signal: AbortSignal) { return patients.load(practiceId,locationId,{ page: 0,size: 20,search,status: 'active' },signal) },
    offers: availability.slots,
    async command(practiceId: string,locationId: string,command: DoctorAppointmentCommand,key: string,signal: AbortSignal) {
      const result = command.kind==='transition' ? await client.rpc('doctor_transition_appointment',{ p_practice: practiceId,p_location: locationId,p_appointment: command.appointmentId,p_expected_version: command.version,p_state: command.state,p_reason: command.reason,p_key: key }).abortSignal(signal)
        : command.kind==='book' ? await client.rpc('doctor_book_appointment',{ p_practice: practiceId,p_location: locationId,p_patient: command.patientId,p_day: command.date,p_minute: command.minute,p_schedule_version: command.scheduleVersion,p_location_version: command.locationVersion,p_key: key }).abortSignal(signal)
          : await client.rpc('doctor_reschedule_appointment',{ p_practice: practiceId,p_location: locationId,p_appointment: command.appointmentId,p_expected_version: command.version,p_destination: command.destinationId,p_day: command.date,p_minute: command.minute,p_schedule_version: command.scheduleVersion,p_location_version: command.locationVersion,p_reason: command.reason,p_key: key }).abortSignal(signal)
      if(result.error)throw result.error;return doctorAppointmentResult(result.data)
    },
  }
}
