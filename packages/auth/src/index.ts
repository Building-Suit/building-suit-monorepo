export interface PortalIdentity {
  userId: string
  portal: 'ledger-suit' | 'shop-suit'
  profileId: string | null
  memberships: ReadonlyArray<{ tenantId: string; role: string }>
}
/** Only same-origin application routes are accepted as post-login destinations. */
export function safeReturnPath(value: unknown, fallback = '/dashboard'): string {
  return typeof value === 'string' && value.startsWith('/') && !value.startsWith('//') && !/[\\\r\n]/.test(value) ? value : fallback
}
