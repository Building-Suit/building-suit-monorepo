// Only structured counts/booleans from our fixed owned-database query may leave
// the fixture. Never echo SQL text, claims, identifiers or an arbitrary log line.
const flags = ['published','publishes_insert','publishes_update','primary_key']
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
