export const CACHE_TTL: number
export interface OfflineRecord {
  envelope: { version: number; scope: string; localId: string; createdAt: string; command: OfflineCommand }
  signature: number[]; sequence: number; state: 'unsynced' | 'syncing' | 'failed' | 'synced'; error: string | null; result: string | null
}
export type OfflineCommand = { kind: 'sale'; args: Record<string, unknown> } | { kind: 'movement' | 'close'; args: Record<string, unknown> }
export function createOfflineStore(options: { scope: string }): {
  cache(key: string, value: unknown): Promise<void>
  cached<T = unknown>(key: string): Promise<T | null>
  enqueue(command: OfflineCommand, localId?: string): Promise<OfflineRecord>
  list(): Promise<OfflineRecord[]>
  retry(localId: string): Promise<void>
  sync(execute: (command: OfflineCommand) => Promise<string>, isCurrent?: () => boolean, onChange?: (record: OfflineRecord) => void): Promise<OfflineRecord[]>
  clearCache(): Promise<void>
  close(): void
}
