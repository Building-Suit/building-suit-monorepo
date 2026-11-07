import type { DoctorRegistrationIdentity } from './authController'
const record = (value: unknown): value is Record<string, unknown> => Boolean(value && typeof value === 'object' && !Array.isArray(value))
/** Input must come from Auth getUser, never a cookie, query, draft or metadata claim. */
export function doctorRegistrationIdentity(user: unknown): DoctorRegistrationIdentity | null {
  if (!record(user) || typeof user.id !== 'string' || !/^[0-9a-f-]{36}$/i.test(user.id) || typeof user.email !== 'string'
    || !user.email_confirmed_at || typeof user.email_confirmed_at !== 'string') return null
  const email = user.email.trim().toLowerCase()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) return null
  const google = Array.isArray(user.identities) ? user.identities.find(identity => record(identity) && identity.provider === 'google'
    && record(identity.identity_data) && identity.identity_data.email_verified === true
    && typeof identity.identity_data.email === 'string' && identity.identity_data.email.toLowerCase() === email) : null
  const claims = record(google) && record(google.identity_data) ? google.identity_data : null
  const name = claims && typeof (claims.full_name ?? claims.name) === 'string' ? String(claims.full_name ?? claims.name).trim().slice(0, 120) : ''
  return { userId: user.id, email, name, providerNameVerified: Boolean(name && google) }
}
