/** Input must come from auth.getUser(), which validates the session with Supabase Auth.
 * Never pass getSession(), route data, or user-editable metadata as proof. */
export function verifiedGoogleIdentity(user: {
  email?: string
  email_confirmed_at?: string
  identities?: { provider: string; identity_data?: Record<string, unknown> }[]
} | null) {
  if (!user?.email || !user.email_confirmed_at) return null
  const email = user.email.trim().toLowerCase()
  const claims = user.identities?.find(identity => identity.provider === 'google')?.identity_data
  if (claims?.email_verified !== true || typeof claims.email !== 'string'
    || claims.email.trim().toLowerCase() !== email) return null
  const name = [claims.full_name, claims.name].find(value => typeof value === 'string' && value.trim())
  return { email, name: typeof name === 'string' ? name.trim() : '' }
}
