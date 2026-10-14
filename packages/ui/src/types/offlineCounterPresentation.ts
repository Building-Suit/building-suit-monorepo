export interface BsOfflineCounterView {
  notice: string
  retry: string
  records: { id: string; label: string; state: 'unsynced' | 'syncing' | 'failed' | 'synced'; status: string; detail: string; receipt: string | null }[]
}
