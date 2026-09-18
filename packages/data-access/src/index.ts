import type { DataScope } from '@building-suit/contracts'
/** Structured keys prevent cross-portal, cross-account and cross-tenant cache collisions. */
export function scopedQueryKey(scope: DataScope, feature: string, parameters: unknown = null): string {
  return JSON.stringify(['building-suit', scope.environment, scope.portal, scope.userId, scope.tenantId, feature, parameters])
}
export interface QueryPage<T> { items: T[]; total: number; offset: number; limit: number }
export interface PageRequest { offset: number; limit: number; search?: string; sort?: Array<{ field: string; direction: 'asc' | 'desc' }> }
export interface QueryAdapter<T> { list(request: PageRequest, signal?: AbortSignal): Promise<QueryPage<T>> }
