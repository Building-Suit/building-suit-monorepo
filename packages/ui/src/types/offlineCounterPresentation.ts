export interface BsOfflineCounterView {
  recordsLabel?: string
  notice: string
  retry: string
  reconcile?: string
  records: { id: string; isResolved?: boolean; canRetry?: boolean; canReconcile?: boolean; label: string; state: 'unsynced' | 'syncing' | 'failed' | 'synced'; status: string; detail: string; receipt: string | null }[]
}
