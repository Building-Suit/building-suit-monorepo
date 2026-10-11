export interface BsTaskWorklistRow {
  id: string
  to: string
  workstream: string
  title: string
  profile: string
  status: string
  statusLabel: string
  statusTone: 'neutral' | 'success' | 'info' | 'warning' | 'danger'
}
