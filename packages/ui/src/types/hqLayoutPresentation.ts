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
  sceneUnavailableLabel: string
  mouseControlsLabel: string
  touchControlsLabel: string
  keyboardControlsLabel: string
  zoomLabel: string
  workplaces: HqWorkplacesCopy
  companyPlans: HqCompanyPlansCopy
  companyBrain: HqBrainContent
}

/** Workplace presentation and visual capacity, without employee-assignment claims. */
export interface HqWorkplacesCopy {
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
