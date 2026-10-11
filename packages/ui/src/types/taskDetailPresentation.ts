export interface BsTaskDetailView {
  title: string
  context: string
  description?: string
  status: string
  statusLabel: string
  statusTone: 'neutral' | 'success' | 'info' | 'warning' | 'danger'
  attempt: { label: string; value: string; hint?: string }
  profile: { label: string; value: string; hint?: string }
  stage: { label: string; value: string }
  usage: { label: string; value: string; hint: string }
  actions: { id: string; label: string }[]
  checks: { id: string; name: string; description: string; elapsed: string; status: string; statusLabel: string; statusTone: 'neutral' | 'success' | 'info' | 'warning' | 'danger' }[]
  process: { worktree: string; branch: string; parent: string; prompt: string; log: string }
  packet: string
  events: { id: string; summary: string; payload: string }[]
}
export interface BsTaskDetailCopy {
  refresh: string
  actions: string
  actionHint: string
  chatPrompt: string
  repairPrompt: string
  verification: string
  process: string
  packet: string
  timeline: string
  worktree: string
  branch: string
  parent: string
  prompt: string
  log: string
}
