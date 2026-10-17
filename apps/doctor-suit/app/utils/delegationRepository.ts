import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../types/database.types'
import { doctorTeamDirectory, doctorInvitationDetails, type DoctorTeamQuery, type DoctorDelegationGrant } from './delegation.ts'
const serialize = (grants: DoctorDelegationGrant[]) => grants.map(item => ({ location_id: item.locationId, capabilities: [...item.capabilities] }))
export function doctorDelegationRepository(client: SupabaseClient<Database>) {
  return {
    async load(practiceId: string, query: DoctorTeamQuery, signal: AbortSignal) {
      const { data,error } = await client.rpc('doctor_team',{ p_practice: practiceId,p_page: query.page,p_size: query.size,p_search: query.search }).abortSignal(signal)
      if (error) throw error
      return doctorTeamDirectory(data,practiceId)
    },
    async invite(practiceId: string,email: string,grants: DoctorDelegationGrant[],hash: string,key: string,signal: AbortSignal) {
      const { data,error } = await client.rpc('doctor_invite_secretary',{ p_practice: practiceId,p_email: email.trim().toLowerCase(),p_grants: serialize(grants),p_token_hash: hash,p_key: key }).abortSignal(signal)
      if (error) throw error
      return data
    },
    async grants(practiceId: string,membership: string,version: number,grants: DoctorDelegationGrant[],key: string,signal: AbortSignal) {
      const { error } = await client.rpc('doctor_set_membership_grants',{ p_practice: practiceId,p_membership: membership,p_version: version,p_grants: serialize(grants),p_key: key }).abortSignal(signal)
      if (error) throw error
    },
    async status(practiceId: string,membership: string,version: number,status: string,key: string,signal: AbortSignal) {
      const { error } = await client.rpc('doctor_set_membership_status',{ p_practice: practiceId,p_membership: membership,p_version: version,p_status: status,p_key: key }).abortSignal(signal)
      if (error) throw error
    },
    async cancel(practiceId: string,invitation: string,version: number,key: string,signal: AbortSignal) {
      const { error } = await client.rpc('doctor_cancel_secretary_invitation',{ p_practice: practiceId,p_invitation: invitation,p_version: version,p_key: key }).abortSignal(signal)
      if (error) throw error
    },
    async review(invitation: string,token: string,signal: AbortSignal) {
      const { data,error } = await client.rpc('doctor_invitation_details',{ p_invitation: invitation,p_token: token }).abortSignal(signal)
      if (error) throw error
      return doctorInvitationDetails(data,invitation)
    },
    async accept(invitation: string,token: string,key: string,signal: AbortSignal) {
      const { error } = await client.rpc('doctor_accept_secretary_invitation',{ p_invitation: invitation,p_token: token,p_key: key }).abortSignal(signal)
      if (error) throw error
    },
  }
}
