import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../types/database.types'
import type { DoctorIdentity } from './authController'
import type { DoctorContextScope } from './contextScope'
import { doctorLocationContexts } from './locationContext.ts'
import { doctorContextRepository } from './contextRepository'
import { doctorAppointmentsRepository } from './appointmentsRepository'
export function doctorDashboardRepository(client: SupabaseClient<Database>,environment: DoctorContextScope['environment']) {
  const contexts = doctorContextRepository(client);const appointments = doctorAppointmentsRepository(client)
  return { contexts: async (actor: DoctorIdentity,signal: AbortSignal) => doctorLocationContexts(await contexts.load(signal),actor,environment),board: appointments.board }
}
