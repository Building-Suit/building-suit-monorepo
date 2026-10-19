// Captured provider output can contain arbitrary secrets and SQL details. Never
// return excerpts, dynamic identifiers, matched substrings or exception text.
const states = new Set(['08000','08001','08006','22023','23502','23503','23505','23514','28000','28P01','40001','40P01','42501','42601','42703','42704','42710','42804','42883','42P01','42P07','53000','53100','53200','53300','55P03','57014','57P01','57P03','58000','XX000'])
const services = Object.freeze({ db: 'database',auth: 'auth',storage: 'storage',rest: 'postgrest',kong: 'gateway',edge_runtime: 'edge-runtime',mailpit: 'local-mail',inbucket: 'local-mail' })
export function doctorProviderDiagnostics(output) {
  if (typeof output!=='string') return 'provider-operation-failed'
  const categories = []
  for (const [pattern,category] of [
    [/must be owner of (?:table|relation)/i,'database-object-ownership-denied'],
    [/permission denied/i,'database-permission-denied'],
    [/toomanyrequests|rate exceeded|too many requests/i,'container-registry-rate-limited'],
    [/no space left on device/i,'executor-disk-capacity'],
    [/unhealthy|health.?check.*fail/i,'local-service-health-check-failed'],
    [/pull access denied|manifest unknown/i,'container-image-unavailable'],
    [/connection refused/i,'local-service-unavailable'],
  ]) if (pattern.test(output)) categories.push(category)
  const codes = [...output.matchAll(/\bSQLSTATE\s+([A-Z0-9]{5})\b/g)].map(match => match[1]).filter(code => states.has(code))
  const foundServices = Object.entries(services).filter(([name]) => new RegExp(`\\bsupabase_${name}_building-suit-doctor\\b`).test(output)).map(([,name]) => name)
  return [categories.length ? [...new Set(categories)].join(',') : 'provider-operation-failed',
    codes.length ? `sqlstate=${[...new Set(codes)].sort().join(',')}` : '',
    foundServices.length ? `services=${[...new Set(foundServices)].sort().join(',')}` : ''].filter(Boolean).join('; ')
}
export class DoctorProviderFailure extends Error {
  #diagnostic
  constructor(output) { super('provider operation failed'); this.#diagnostic = doctorProviderDiagnostics(output) }
  get diagnostic() { return this.#diagnostic }
}
export function doctorProviderFailureSummary(error) {
  return error instanceof DoctorProviderFailure ? error.diagnostic : 'provider-acceptance-assertion-failed'
}
