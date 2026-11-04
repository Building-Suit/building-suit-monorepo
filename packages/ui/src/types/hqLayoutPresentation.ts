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
  companyBrain: HqBrainContent
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
