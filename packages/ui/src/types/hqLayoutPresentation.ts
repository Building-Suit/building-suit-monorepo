import type { HqAgentAvatar, HqAgentsContent } from './hqAgentsPresentation'

export type HqAvatarAssets = Readonly<Partial<Record<HqAgentAvatar['body'], Blob>>>

export interface HqStaffingDecision {
  planId: string
  digest: string
  decision: 'approved' | 'rejected'
  resumeOriginal: boolean
}
export interface HqStaffingPlan {
  originalTask: { title: string; brief: string; acceptance: string }
  agentId: string
  name: string
  departmentKey: string
  managerId: string
  reviewerId: string
  profileDraft: string
  skills: readonly { fileId: string; sourceVersion: string }[]
  modelPolicy: { model: string; effort: string; sourceVersion: string }
  trialCriteria: string
  resumeOriginal: boolean
}
export interface HqStaffingPresentation {
  totalCount?: number
  status: 'loading' | 'ready' | 'unavailable'
  pending: boolean
  message?: string
  workflows: readonly {
    id: string
    sourceTaskId: string
    status: string
    statusLabel: string
    blocker: string
    blockerLabel: string
    planId: string | null
    digest: string | null
    plan: HqStaffingPlan | null
  }[]
}
export interface HqStaffingCopy {
  title: string; empty: string; refresh: string; unavailable: string; profile: string; skills: string
  manager: string; reviewer: string; model: string; trial: string; source: string; approve: string; reject: string
  resume: string; cancel: string; confirmation: string; conflict: string; writerBoundary: string; limited: string; stop: string; stopConfirmation: string
}
/** HQ presentation copy. Product adapters own access and data retrieval. */
export interface HqLayoutContent {
  brandName: string
  brandSuffix: string
  logoSrc: string
  workspaceLabel: string
  tasksLabel: string
  calendarLabel: string
  brainLabel: string
  statusLabel: string
  talkToCeoLabel: string
  profileLabel: string
  loginLabel: string
  canvasLabel: string
  minimapLabel: string
  zoomOutLabel: string
  zoomInLabel: string
  fitViewLabel: string
  hologramLabel: string
  avatarAssets?: HqAvatarAssets
  sceneUnavailableLabel: string
  mouseControlsLabel: string
  touchControlsLabel: string
  keyboardControlsLabel: string
  zoomLabel: string
  workplaces: HqWorkplacesCopy
  companyPlans: HqCompanyPlansCopy
  companyBrain: HqBrainContent
  agents?: HqAgentsContent
}

/** Workplace presentation; assignments are supplied by the product roster. */
export interface HqWorkplacesCopy {
  office?: import('./hqAgentsPresentation').HqOfficeCopy
  label: string
  clearSelectionLabel: string
  executiveDescription: string
  departmentDescription: string
  workstationsLabel: string
  workstationsValue: string
  agentsSpaceLabel: string
  workspaceReadyLabel: string
  plansLabel: string
}

export interface HqBrainContent {
  title: string
  notesTabLabel: string
  openLabel: string
  loadingLabel: string
  connectedLabel: string
  unavailableLabel: string
  errorLabel: string
  sourceLabel: string
  freshnessLabel: string
  refreshLabel: string
  searchLabel: string
  showMoreLabel: string
  emptyLabel: string
  selectLabel: string
  noteErrorLabel: string
  observedLabel: string
  modifiedLabel: string
  partialLabel: string
  readOnlyLabel: string
  setupRequiredLabel: string
  authorizationRequiredLabel: string
  setupInstructionsLabel: string
  versionLabel: string
}

export interface HqBrainNoteSummary {
  id: string
  title: string
  path: string
  modifiedLabel: string
  version: string
}

export interface HqBrainPresentation {
  status: 'loading' | 'connected' | 'unavailable' | 'error'
  reason: 'not-configured' | 'authorization-required' | 'cloud-unavailable' | null
  refreshing: boolean
  notes: readonly HqBrainNoteSummary[]
  observedLabel: string
  partial: boolean
  selectedId: string | null
  noteStatus: 'idle' | 'loading' | 'ready' | 'error'
  note: (HqBrainNoteSummary & { content: string }) | null
}

/** Optional identity projection only; the product owns authentication. */
export interface HqUserPresentation {
  displayName: string
  detailLabel?: string
  avatarUrl?: string
}

/** Read-only projection of an explicitly approved department, never a proposal. */
export interface HqDepartmentOffice {
  id: string
  name: string
  nameAr?: string
  approvedAt: string
  /** Undefined means roster unavailable; an empty list means no assigned employees. */
  agents?: readonly { id: string; name: string }[]
}

export interface HqFounderAccessPresentation {
  status: 'loading' | 'anonymous' | 'founder' | 'denied' | 'error'
  user?: HqUserPresentation
  pending: boolean
  message?: string
}
export interface HqPlanDepartment {
  id: string
  key: string
  name: string
  nameAr?: string
}
export interface HqCompanyPlanPresentation {
  id: string
  title: string
  summary: string
  body: string
  status: 'ready' | 'approved' | 'rejected'
  revision: number
  departments: readonly HqPlanDepartment[]
  hiring: readonly { id: string; departmentId?: string; role: string; reason: string }[]
  skills: readonly { id: string; employeeId: string; skill: string; reason: string }[]
  hrReview: { reference: string; summary: string } | null
  ceoReview: { reference: string; summary: string } | null
  createdAt: string
  approvedAt?: string
  legacy: boolean
}
export interface HqCompanyPlansPresentation {
  status: 'loading' | 'ready' | 'unavailable'
  pending: boolean
  plans: readonly HqCompanyPlanPresentation[]
  message?: string
}
export interface HqCompanyPlansCopy {
  title: string
  board: {
    discussion: string
    preparation: string
    blocked: string
    done: string
    empty: string
    description: string
  }
  executiveLabel: string
  loginTitle: string
  loginDescription: string
  emailLabel: string
  passwordLabel: string
  signInLabel: string
  registerLabel: string
  signOutLabel: string
  confirmationRequired: string
  invalidCredentials: string
  denied: string
  unavailable: string
  signOutFailed: string
  loading: string
  empty: string
  refreshLabel: string
  departmentsLabel: string
  hiringLabel: string
  skillsLabel: string
  hrReviewLabel: string
  ceoReviewLabel: string
  readyLabel: string
  approvedLabel: string
  rejectedLabel: string
  approveLabel: string
  rejectLabel: string
  cancelLabel: string
  approveConfirmation: string
  rejectConfirmation: string
  conflict: string
  decisionFailed: string
  legacyLabel: string
}
