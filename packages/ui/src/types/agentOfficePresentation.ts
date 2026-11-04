export type AgentOfficeView = 'office' | 'tasks' | 'brain'
export type AgentOfficeRoomKind = 'executive' | 'department'
export type AgentOfficeTone = 'neutral' | 'success' | 'info' | 'warning' | 'danger'

/** Product-owned translated copy. This template contains no company policy text. */
export interface AgentOfficeCopy {
  office: string; tasks: string; brain: string; talkToCeo: string
  workspace: string; roomList: string; sceneHint: string; zoomIn: string; zoomOut: string; resetView: string; miniMap: string
  brainLabel: string; brainSubtitle: string; connectionTitle: string; loading: string; retry: string; readOnly: string
  tasksTitle: string; tasksIntro: string; newTask: string; noTasks: string; reviewPlan: string; viewTask: string
  conversationTitle: string; conversationHint: string; messageLabel: string; messagePlaceholder: string; sendMessage: string; noMessages: string
  taskFormTitle: string; taskTitle: string; taskBrief: string; taskAcceptance: string; taskScope: string; taskOwner: string; taskOwnerValue: string
  taskBudget: string; taskBudgetValue: string; createProposal: string; cancel: string; close: string
  brief: string; acceptance: string; allowedActions: string; deliverable: string; reviewEvidence: string; budget: string
  approvedScopeNotice: string; approvePlan: string; cancelTask: string; reviewTitle: string
  profile: string; skills: string; reporting: string; unassignedTitle: string; unassignedDescription: string
  brainTitle: string; brainIntro: string; noBrainNotes: string; activityTitle: string; noActivity: string
}
export interface AgentOfficeContent {
  brandName: string
  brandSubtitle: string
  logoSrc: string
  sceneSrc: string
  sceneAlt: string
  copy: AgentOfficeCopy
}
export interface AgentOfficeRoom {
  id: string
  label: string
  kind: AgentOfficeRoomKind
  active: boolean
  /** Position within the complete, un-cropped scene canvas, from 0 to 100. */
  x: number
  y: number
  statusLabel: string
  description: string
  skills: string[]
  reportingLabel?: string
}
export interface AgentOfficeMessage {
  id: string
  role: 'founder' | 'assistant'
  text: string
  authorLabel: string
  createdLabel: string
  statusLabel: string
  canPlanWork?: boolean
  taskId?: string
  replyTo?: string
}
export interface AgentOfficeTaskDraft {
  title: string
  brief: string
  acceptance: string
  allowedActions: string
  sourceMessageId?: string
}
export interface AgentOfficeTask {
  id: string
  title: string
  ownerLabel: string
  status: string
  statusLabel: string
  tone?: AgentOfficeTone
  updatedLabel: string
  brief: string
  acceptance: string
  allowedActions: string
  budgetLabel: string
  deliverable?: string
  reviewEvidence?: string
  sourceMessageId?: string
  canAuthorizeWorkflow?: boolean
  workflowAuthorized?: boolean
  /** Affordances only. Every mutation must also be authorized by the server. */
  milestones?: { id: string; title: string; acceptance: string; status: string }[]
  canApprove: boolean
  canCancel: boolean
}
export interface AgentOfficeNote { id: string; title: string; text: string }
export interface AgentOfficeActivity { id: string; title: string; detail: string; createdLabel: string }

export interface AgentOfficeWorkflowDraft { id: string; brainFiles: Record<string, string> }
/** Translated labels for explicit message planning and a separately approved read-only scope. */
export interface AgentOfficeWorkCopy {
  planFromMessage: string; linkedTask: string; originalMessage: string; privateContextNotice: string
  authorizeBrainWork: string; workflowTitle: string; workflowIntro: string; workflowScope: string
  workflowUnavailable: string; fileReferenceHint: string; authorizeWorkflow: string; workflowAuthorized: string
}

export interface LivingOfficePageCopy {
  title: string; intro: string; createDepartment: string; departmentName: string; purpose: string; createOffice: string
  milestoneTitle: string; milestoneAcceptance: string; addMilestone: string; milestones: string; planned: string; milestoneHint: string
  configured: string; execution: string; noWrites: string; departmentCreated: string
}
