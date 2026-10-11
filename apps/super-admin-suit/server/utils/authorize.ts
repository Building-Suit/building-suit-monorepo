export interface AdminSession {
  userId: string
  role: 'owner'
  authorityEnvironmentId: string
}

interface SessionClient {
  auth: { getUser(): Promise<{ data: { user: { id: string } | null }; error: unknown }> }
  rpc(name: 'super_admin_session'): PromiseLike<{ data: unknown; error: { code?: string } | null }>
}

export class AdminAccessError extends Error {
  statusCode: number
  constructor(statusCode: number) {
    super(statusCode === 401 ? 'Authentication required' : statusCode === 403 ? 'Access denied' : 'Authorization unavailable')
    this.statusCode = statusCode
  }
}

/** Verify with this project's Auth server, then resolve authority afresh from its database. */
export async function authorizeAdmin(client: SessionClient): Promise<AdminSession> {
  const { data: identity, error: identityError } = await client.auth.getUser()
  if (identityError || !identity.user) throw new AdminAccessError(401)
  const { data, error } = await client.rpc('super_admin_session')
  if (error) throw new AdminAccessError(error.code === '42501' ? 403 : 503)
  const session = data as Partial<AdminSession> | null
  if (!session || session.userId !== identity.user.id || session.role !== 'owner'
    || typeof session.authorityEnvironmentId !== 'string' || !session.authorityEnvironmentId) {
    throw new AdminAccessError(503)
  }
  return { userId: session.userId, role: session.role, authorityEnvironmentId: session.authorityEnvironmentId }
}
