export interface BsClientPortfolioView {
  id: string
  name: string
  legalName?: string
  identity: string
  health: string
  healthLabel: string
  healthTone: 'success' | 'warning' | 'neutral'
  period: string
  reconciliation: string
  activity: string
}
export interface BsClientPortfolioCopy {
  title: string
  subtitle: string
  summary: string
  filters: string
  searchLabel: string
  searchPlaceholder: string
  healthFilter: string
  refresh: string
  signalNote: string
  loadFailed: string
  loadFailedHint: string
  retry: string
  emptyTitle: string
  emptyDescription: string
  tableLabel: string
  client: string
  health: string
  period: string
  reconciliation: string
  lastActivity: string
  actions: string
  opening: string
  openClient: string
}
