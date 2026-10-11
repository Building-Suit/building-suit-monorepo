export interface BsAuditHistoryView {
  id: string
  timestamp: string
  actor: string
  activity: string
  action: string
  entity: string
  entityId?: string
  before: string
  after: string
  metadata: string
}
export interface BsAuditHistoryCopy {
  title: string
  subtitle: string
  stored: string
  empty: string
  date: string
  actor: string
  activity: string
  record: string
  changes: string
  viewChanges: string
  before: string
  after: string
  metadata: string
  loadMore: string
}
