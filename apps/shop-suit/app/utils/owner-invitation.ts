interface OwnerClaimClient {
  auth: {
    verifyOtp(input: { token_hash: string; type: 'invite' }): Promise<{ data: { user: { id: string } | null }; error: unknown }>
    getUser(): Promise<{ data: { user: { id: string } | null }; error: unknown }>
  }
  rpc(name: 'shop_admin_provisioned_owner_claim'): PromiseLike<{ data: unknown; error: unknown }>
}
export async function claimProvisionedOwner(client: OwnerClaimClient, tokenHash?: string) {
  let expectedId: string | undefined
  if (tokenHash !== undefined) {
    if (!/^[0-9a-f]{64}$/i.test(tokenHash)) throw new Error('Owner invitation unavailable')
    const verified = await client.auth.verifyOtp({ token_hash: tokenHash, type: 'invite' })
    if (verified.error || !verified.data.user) throw new Error('Owner invitation unavailable')
    expectedId = verified.data.user.id
  }
  const identity = await client.auth.getUser()
  if (identity.error || !identity.data.user || (expectedId && expectedId !== identity.data.user.id)) throw new Error('Owner invitation unavailable')
  const claimed = await client.rpc('shop_admin_provisioned_owner_claim')
  if (claimed.error || !claimed.data || typeof claimed.data !== 'object' || typeof (claimed.data as { shopId?: unknown }).shopId !== 'string') throw new Error('Owner invitation unavailable')
  return claimed.data as { shopId: string; subscription: Record<string, unknown> }
}
