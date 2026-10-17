// Only structured counts/booleans from our fixed owned-database query may leave
// the fixture. Never echo SQL text, claims, identifiers or an arbitrary log line.
const flags = ['published','publishes_insert','publishes_update','primary_key','replication_select','authenticated_select','service_select','service_insert','service_update','wal_slot_active']
const counts = ['revision_rows','subscriptions','sid_claims','authenticated_claims','visible_claims','wal_slots']
export function doctorRealtimeProbeSummary(output) {
  try {
    const value = JSON.parse(output)
    const keys = [...flags,...counts]
    if(!value || typeof value!=='object' || Array.isArray(value) || Object.keys(value).length!==keys.length || Object.keys(value).some(key => !keys.includes(key)))return { available: false }
    if(flags.some(key => typeof value[key]!=='boolean') || counts.some(key => !Number.isSafeInteger(value[key]) || value[key]<0 || value[key]>16)
      || ['sid_claims','authenticated_claims','visible_claims'].some(key => value[key]>value.subscriptions))return { available: false }
    return { available: true,...Object.fromEntries(keys.map(key => [key,value[key]])) }
  } catch { return { available: false } }
}

export function createDoctorRealtimeWireProbe() {
  const counts = { change_frames: 0,insert_frames: 0,update_frames: 0,unrecognized_change_frames: 0,change_matching_ids: 0,join_bindings: 0,join_numeric_ids: 0,join_string_ids: 0,join_zero_ids: 0,system_ok: 0,system_error: 0,client_error: 0 }
  const joinIds = new Set()
  const increment = key => { counts[key] = Math.min(16,counts[key]+1) }
  return {
    logger(kind,message,data) {
      if(kind==='error')increment('client_error')
      if(kind!=='receive' || typeof message!=='string')return
      const words = message.split(/\s+/)
      if(words.includes('phx_reply') && data?.status==='ok' && Array.isArray(data.response?.postgres_changes))for(const binding of data.response.postgres_changes.slice(0,16)) {
        increment('join_bindings')
        const id = binding?.id
        if(Number.isSafeInteger(id)) { increment('join_numeric_ids');if(id===0)increment('join_zero_ids') }
        else if(typeof id==='string')increment('join_string_ids')
        if(joinIds.size<64 && (Number.isSafeInteger(id) || typeof id==='string' && id.length<=128))joinIds.add(id)
      }
      if(words.includes('postgres_changes')) {
        increment('change_frames')
        increment(data?.data?.type==='INSERT' ? 'insert_frames' : data?.data?.type==='UPDATE' ? 'update_frames' : 'unrecognized_change_frames')
        if(Array.isArray(data?.ids) && data.ids.some(id => joinIds.has(id)))increment('change_matching_ids')
      }
      if(words.includes('system')) { if(data?.status==='ok')increment('system_ok');else if(data?.status==='error')increment('system_error') }
    },
    summary: () => ({ ...counts }),
  }
}
