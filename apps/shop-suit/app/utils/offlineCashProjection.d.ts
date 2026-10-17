import type { OfflineRecord } from './offlineStore.js'
export function projectOfflineCash(active: { id: string; expectedCash: number } | null, records: ReadonlyArray<OfflineRecord>): number
export function isCounterCashAmount(value: number, allowZero?: boolean): boolean
