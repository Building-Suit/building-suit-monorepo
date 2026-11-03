/** Worker IDs supplement (never replace) historical ceo/hr task ownership. */
export const workforce = [
  { agentId: 'AG-CEO-001', name: 'Steve', role: 'CEO', legacyRole: 'ceo', profileVersion: '7', qualification: 'on-demand; expanded workflow trial pending' },
  { agentId: 'AG-HR-001', name: 'Maya', role: 'HR Lead', legacyRole: 'hr', profileVersion: '1.1.0', qualification: 'bounded staffing only; expanded workflow trial pending' },
  { agentId: 'AG-HR-002', name: 'Noah', role: 'Recruiter', legacyRole: 'hr', profileVersion: '1.0.0', qualification: 'configured; trial pending' },
  { agentId: 'AG-HR-003', name: 'Iris', role: 'Evaluator', legacyRole: 'hr', profileVersion: '1.0.0', qualification: 'configured; trial pending' },
] as const
export type AgentId = typeof workforce[number]['agentId']
export const stages = [
  { stage: 'research', agentId: 'AG-HR-002' },
  { stage: 'evaluate', agentId: 'AG-HR-003' },
  { stage: 'consolidate', agentId: 'AG-HR-001' },
  { stage: 'reply', agentId: 'AG-CEO-001' },
] as const
export type Stage = typeof stages[number]['stage']
export const readTools = ['public.search', 'public.read'] as const
export type ReadTool = typeof readTools[number]
export const brainContextKeys = ['bootstrap', 'charter', 'workingAgreement', 'registry', 'organization', 'hrCharter', 'workforceSkill', 'home', 'soul', 'milestones', 'mode'] as const
export type BrainKey = AgentId | 'playbook' | typeof brainContextKeys[number]
export interface WorkflowApproval {
  allowedTools: ReadTool[]
  publicInputs: string[]
  brainFiles: Record<BrainKey, string>
  daily: boolean
  timezone: 'Africa/Cairo'
  timezoneConfirmed: boolean
  approvedAt: string
}
export interface BrainFile { id: string; revision: string; text: string; accessedAt: string }
export type BrainSnapshot = Pick<BrainFile, 'id' | 'revision' | 'text'>
export interface BrainReference { id: string; revision: string; accessedAt: string; blob: string }
export interface StageEvidence {
  stage: Stage
  agentId: AgentId
  contextId: string
  principalId: string
  input: string
  inputDigest: string
  brain: (BrainFile | BrainReference)[]
  allowedTools: ReadTool[]
  toolCalls: { name: ReadTool; input: string; output: string }[]
  output: string
  sources: string[]
  review?: { accepted: boolean; artifactDigest: string; evidence: string }
  startedAt: string
  completedAt: string
}
export interface WorkflowRun {
  key: string
  taskId: string
  contractDigest: string
  localDate: string
  status: 'running' | 'blocked' | 'completed' | 'cancelled'
  owner: string
  generation: number
  leaseUntil: number
  evidenceBudget?: number
  checkpoints: Partial<Record<Stage, StageEvidence>>
  rejectedReviews?: StageEvidence[]
  attempts: { stage: Stage; contextId: string; reservationId: string; at: string }[]
  failures: { at: string; code: string }[]
  outbox?: { key: string; text: string; status: 'pending' | 'delivered'; receipt?: string }
}
