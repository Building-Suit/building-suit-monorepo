export interface BsExecutionActivityItem {
  id: string
  title: string
  subtitle?: string
  status: string
  statusLabel: string
  statusTone: 'neutral' | 'success' | 'info' | 'warning' | 'danger'
  description?: string
  attempt?: string
  date?: string
  summary?: string
  guidance?: string
  taskLink?: { to: string; label: string }
  actions?: { key: 'copy-error' | 'copy-diagnostic'; label: string }[]
  nodes?: { id: string; label: string; detail: string }[]
}
