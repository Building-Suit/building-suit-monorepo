// Target Edge only: an exact, reserved Auth identity is the sole ownership authority.
export function isAccountProvisioning(envelope) {
  return ['shop.account.command', 'shop.account.query'].includes(envelope.operation)
}
function assertOwnedUser(user, row) {
  if (!user || user.id !== row.userId || user.email?.trim().toLowerCase() !== row.email
    || user.app_metadata?.bs_admin_provisioning_id !== row.jobId) throw new Error('auth_ownership_mismatch')
  return user
}

/** No automatic invitation resend after uncertainty. A distinct acknowledged command is required. */
export async function processAccountProvisioning({ rpc, auth, principalId, nonce, bodyDigest, envelope }) {
  const row = await rpc('shop_super_admin_account_begin', {
    p_principal_id: principalId, p_nonce: nonce, p_body_digest: bodyDigest, p_envelope: envelope,
  })
  if (row.done) return row.result
  const step = (name, details = {}) => rpc('shop_super_admin_account_step', {
    p_command_id: row.commandId, p_lease_token: row.leaseToken, p_step: name, p_details: details,
  })
  const finish = async code => (await step('release', { code })).result
  try {
    let user = await auth.getUserById(row.userId, row.authTimeoutMs)
    if (!user) {
      if (row.phase === 'active') throw new Error('auth_ownership_mismatch')
      try {
        user = await auth.createUser({
          id: row.userId, email: row.email, email_confirm: false,
          app_metadata: { bs_admin_provisioning_id: row.jobId },
          user_metadata: { display_name: row.displayName },
        }, row.authTimeoutMs)
      } catch (error) {
        // Even a duplicate response can follow our committed create with a lost reply.
        user = await auth.getUserById(row.userId, row.authTimeoutMs)
        if (!user) {
          if (error.code === 'email_exists' || error.code === 'user_already_exists') return (await step('auth_conflict')).result
          throw error
        }
      }
    }
    assertOwnedUser(user, row)
    const domain = await step('domain')
    if (domain.result?.data?.phase !== 'active') return await finish('domain_requires_review')
    const invitation = await step('invite_start')
    if (!invitation.sendAllowed) {
      if (['sent', 'claimed'].includes(invitation.result?.data?.invitationState)) return invitation.result
      return await finish('invitation_outcome_unknown')
    }
    try {
      const invited = await auth.inviteUserByEmail(row.email, row.inviteRedirectUrl, row.authTimeoutMs)
      assertOwnedUser(invited, row)
    } catch { /* The provider may have committed. SQL independently observes invited_at/confirmation. */ }
    const observed = await step('invite_finish')
    if (['sent', 'claimed'].includes(observed.result?.data?.invitationState)) return observed.result
    return await finish('invitation_outcome_unknown')
  } catch (error) {
    // Never pass provider messages, tokens or keys into audit or a browser response.
    return await finish(error?.message === 'auth_ownership_mismatch' ? 'auth_ownership_mismatch' : 'auth_or_domain_unavailable')
  }
}

/** Use only the target's supported Auth Admin HTTP API and target-owned runtime credentials. */
export function accountAuthAdmin({ supabaseUrl, serviceRoleKey, fetchImpl = fetch }) {
  const origin = new URL(supabaseUrl)
  if (!['https:', 'http:'].includes(origin.protocol) || origin.username || origin.password || origin.search || origin.hash
    || (origin.protocol === 'http:' && !['127.0.0.1', 'localhost', 'kong'].includes(origin.hostname))) throw new Error('auth_configuration_unavailable')
  const call = async (path, method, body, timeoutMs) => {
    const response = await fetchImpl(new URL(`/auth/v1/${path}`, origin), {
      method, redirect: 'error', signal: AbortSignal.timeout(timeoutMs),
      headers: { apikey: serviceRoleKey, authorization: `Bearer ${serviceRoleKey}`, 'content-type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
    const value = await response.json()
    if (!response.ok) {
      if (response.status === 404 && path.startsWith('admin/users/')) return null
      const error = new Error('auth_request_failed')
      const code = value.error_code ?? value.code
      error.code = typeof code === 'string' ? code : 'auth_request_failed'
      throw error
    }
    return value.user ?? value
  }
  return {
    getUserById: (id, timeout) => call(`admin/users/${encodeURIComponent(id)}`, 'GET', undefined, timeout),
    createUser: (attributes, timeout) => call('admin/users', 'POST', attributes, timeout),
    inviteUserByEmail: (email, redirect, timeout) => {
      const destination = new URL(redirect)
      if (destination.protocol !== 'https:' || destination.username || destination.password || destination.search || destination.hash
        || destination.pathname !== '/auth/owner-invitation') throw new Error('auth_configuration_unavailable')
      return call(`invite?redirect_to=${encodeURIComponent(redirect)}`, 'POST', { email }, timeout)
    },
  }
}
