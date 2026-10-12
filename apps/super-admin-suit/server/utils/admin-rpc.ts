export interface AdminRpcClient { rpc(name: string, args: Record<string, unknown>): PromiseLike<{ data: unknown; error: { code?: string; message?: string } | null }> }
export async function adminRpc(client: AdminRpcClient, name: string, args: Record<string, unknown>) {
  const { data, error } = await client.rpc(name, args)
  if (error) throw createError({ statusCode: error.code === '42501' ? 403 : error.message === 'INVALID_REQUEST' ? 400 : 503, statusMessage: 'Activity unavailable' })
  return data
}
