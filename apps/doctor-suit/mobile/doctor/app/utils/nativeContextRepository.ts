import type {DoctorMobileIdentity} from '@building-suit/contracts'
import {nativeContextChoice, type NativeContextChoice, type NativeContextPort} from './nativeContext.ts'
import {nativeSessionConfiguration, type NativeAuthTransport, type NativeSessionConfiguration} from './nativeSessionBackend.ts'
const object = (value: unknown): value is Record<string, unknown> => Boolean(value && typeof value === 'object' && !Array.isArray(value))
const uuid = (value: unknown): value is string => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
const unavailable = (code = 'CONTEXT_UNAVAILABLE') => Object.assign(new Error('Context unavailable'), {code})
export function createNativeContextRepository(configuration: NativeSessionConfiguration, transport: NativeAuthTransport, accessToken: () => string | null): NativeContextPort {
  const config = nativeSessionConfiguration(configuration)
  if (!config) throw unavailable()
  async function request(path: string, body: Record<string, unknown> | undefined, signal: AbortSignal) {
    const token = accessToken()
    if (!token || signal.aborted) throw unavailable()
    const response = await transport({url: config!.url + path, method: body ? 'POST' : 'GET', body, signal,
      headers: {apikey: config!.publicKey, Authorization: 'Bearer ' + token, 'Content-Type': 'application/json'}})
    if (signal.aborted || accessToken() !== token) throw unavailable()
    if (!Number.isInteger(response.status) || response.status < 200 || response.status >= 300) throw unavailable(response.status === 403 ? '42501' : 'CONTEXT_UNAVAILABLE')
    if (JSON.stringify(response.data ?? null).length > 262144) throw unavailable()
    return response.data
  }
  async function owner(practiceId: string, signal: AbortSignal): Promise<string> {
    if (!uuid(practiceId)) throw unavailable()
    // Existing practices SELECT RLS returns only the actor's own/current active
    // memberships. No profile/contact lookup or privileged endpoint is used.
    const rows = await request('/rest/v1/practices?select=id,owner_user_id&id=eq.' + practiceId, undefined, signal)
    if (!Array.isArray(rows) || rows.length !== 1 || !object(rows[0]) || rows[0].id !== practiceId || !uuid(rows[0].owner_user_id)) throw unavailable('42501')
    return rows[0].owner_user_id
  }
  function decode(row: unknown, doctorId: string, identity: DoctorMobileIdentity): NativeContextChoice {
    if (!object(row) || row.edition !== 'synthetic_preview' || !object(row.entitlement) || row.entitlement.state !== 'preview' || !uuid(row.practice_id) || !uuid(row.location_id) || typeof row.practice_name !== 'string' || typeof row.doctor_name !== 'string' || typeof row.location_name !== 'string') throw unavailable()
    return nativeContextChoice({context: {contractVersion: 1, product: 'doctor-suit', dataMode: 'synthetic', ...identity,
      doctorId, practiceId: row.practice_id, locationId: row.location_id, portal: row.portal as 'doctor' | 'secretary',
      grantsVersion: row.grants_version as number, locationVersion: row.location_version as number, capabilities: row.capabilities as string[]},
      practiceName: row.practice_name, doctorName: row.doctor_name, locationName: row.location_name}, identity)
  }
  return {
    async list(identity, signal) {
      const rows = await request('/rest/v1/rpc/doctor_contexts', {}, signal)
      if (!Array.isArray(rows) || rows.length > 200) throw unavailable()
      const owners = new Map<string, string>()
      const result: NativeContextChoice[] = []
      for (const row of rows) {
        if (!object(row) || !uuid(row.practice_id)) throw unavailable()
        if (!owners.has(row.practice_id)) owners.set(row.practice_id, await owner(row.practice_id, signal))
        result.push(decode(row, owners.get(row.practice_id)!, identity))
      }
      return result
    },
    async resolve(choice, identity, signal) {
      const context = nativeContextChoice(choice, identity).context
      const row = await request('/rest/v1/rpc/doctor_resolve_context', {p_practice: context.practiceId, p_location: context.locationId, p_expected_version: context.grantsVersion}, signal)
      return decode(row, await owner(context.practiceId, signal), identity)
    },
  }
}
