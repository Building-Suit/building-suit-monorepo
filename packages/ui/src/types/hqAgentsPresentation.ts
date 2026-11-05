/** Product-owned agent/runtime observations projected into shared HQ UI. */
export interface HqAgentPresentation {
  id: string
  name: string
  roleLabel?: string
  activityLabel?: string
  departmentName?: string
  lifecycleLabel?: string
  connectionLabel?: string
  configured?: boolean
  connected?: boolean
  /** Decorative island presence only; never an observation of worker activity. */
  cosmeticIdle?: boolean
  role: 'ceo' | 'hr' | 'agent'
  departmentId: string | null
  deskIndex: number | null
  activity: 'working' | 'idle' | 'offline' | 'unknown'
  model?: string
  effort?: string
  managerId?: string
  managerName?: string
  profileUrl?: string
  avatarUrl?: string
}

export interface HqChatMessage {
  id: string
  role: 'founder' | 'ceo' | 'hr' | 'agent' | 'system'
  agentId?: string
  agentName?: string
  agentRole?: string
  replyTo?: string
  kind?: 'message' | 'handoff' | 'acknowledgement' | 'task-result' | 'recovery'
  mentions?: readonly { agentId: string; name: string }[]
  taskId?: string
  /** Only actual published Brain receipts are anchored here. */
  learningIds?: readonly string[]
  text: string
  createdAt: string
}

/** Recorded request execution, anchored to an actual message; never an agent utterance. */
export interface HqRequestProgress {
  messageId: string
  agentId: string
  agentName: string
  state: 'queued' | 'working' | 'recovery-needed'
  recovering: boolean
}

export interface HqAgentsPresentation {
  status: 'loading' | 'connected' | 'unavailable' | 'error'
  /** Initial load or a business write; background reads use refreshing. */
  pending: boolean
  refreshing?: boolean
  sending: boolean
  agents: readonly HqAgentPresentation[]
  messages: readonly HqChatMessage[]
  error?: string
  queuedCount: number
  requestProgress?: HqRequestProgress
  /** Bounded actual job receipts, not model-authored progress estimates. */
  workActivity?: readonly HqWorkActivity[]
  runtimeOnline: boolean
  lastRuntimeSeenAt?: string
  tasks?: readonly HqTaskPresentation[]
  runningTasks?: readonly HqTaskPresentation[]
  officeTasks?: readonly HqTaskPresentation[]
  tasksPartial?: boolean
  lessons?: readonly HqLessonPresentation[]
  submittingTask?: boolean
  observations?: HqOfficeObservations
}

export interface HqWorkActivity {
  id: string
  agentId: string
  agentName: string
  stage: string
  state: 'working' | 'queued' | 'unconfirmed'
  createdAt: string
  startedAt: string | null
  taskId?: string
  taskTitle?: string
}

export interface HqWorkActivityCopy {
  title: string; empty: string; queued: string; working: string; unconfirmed: string
  elapsed: string; waiting: string; observed: string; openTask: string; stage: string
  stages: Readonly<Record<string, string>>
}

/** Host receipts, never inferred from a skill assignment or model prose. */
export interface HqOfficeObservations {
  since: string
  observedAt: string
  agents: readonly {
    id: string
    metrics: { today: number; running: number; turnaroundSeconds: number | null; completed: number; daily: readonly number[] }
    tools: readonly { id: string; name: string; kind: 'api' | 'native' | 'mcp'; icon: 'drive' | 'web' | 'tool'; available: boolean }[]
    skills: readonly { id: string; name: string; loads: number | null; running: boolean }[]
  }[]
}

export interface HqOfficeCopy {
  overview: string; runningTasks: string; calendar: string; settings: string
  recentTasks: string; noRecentTasks: string
  metrics: string; tasksToday: string; running: string; turnaround: string; minutes: string
  connectedTools: string; active: string; inactive: string; toolsEmpty: string
  skills: string; skillUsage: string; skillBasis: string; skillsEmpty: string; neverUsed: string
  agents: string; agentsEmpty: string; unavailable: string; loading: string; retry: string
  activity: string; model: string; manager: string; profile: string; noRunningTasks: string
  agentDetails: string; back: string; close: string; scope: string; lifecycle: string; department: string
}

export interface HqTaskRequest { assigneeId: string | null; title: string; brief: string; acceptance: string }
export interface HqTaskPresentation {
  id: string
  title: string
  brief: string
  acceptance: string
  assigneeId: string | null
  assigneeName: string
  statusLabel: string
  state: 'pending' | 'active' | 'complete' | 'blocked'
  createdAt: string
  updatedAt?: string
  completedAt?: string | null
  deliverable: string
  reviews: readonly { id: string; reviewer: string; outcome: string; text: string }[]
  error?: string
}
export interface HqLessonPresentation {
  status?: 'proposed' | 'accepted' | 'rejected' | 'published'
  sourceId?: string
  id: string
  title: string
  text: string
  agentName: string
  statusLabel: string
  taskId: string | null
  createdAt: string
  sourceUrl?: string
  publicationReference?: string
  reviewedAt?: string
  publishedAt?: string
}

export interface HqWorkforceContent {
  activity?: HqWorkActivityCopy
  followup?: {
    title: string; explanation: string; action: string; source: string; scope: string
    scopeHint: string; criteria: string; submit: string; cancel: string; titlePrefix: string
    briefPrefix: string; acceptance: string; supported: string; completed: string; updated: string
  }
  chatLabel: string
  tasksLabel: string
  teamLabel: string
  learningLabel: string
  newTaskLabel: string
  assigneeLabel: string
  autoAssignLabel: string
  titleLabel: string
  briefLabel: string
  acceptanceLabel: string
  createLabel: string
  creatingLabel: string
  emptyTasksLabel: string
  emptyTeamLabel: string
  emptyLessonsLabel: string
  departmentLabel: string
  lifecycleLabel: string
  connectionLabel: string
  configuredNotice: string
  deliverableLabel: string
  reviewsLabel: string
  pendingDeliverableLabel: string
  pendingReviewLabel: string
  lessonSourceLabel: string
  sourceTaskLabel: string
  backLabel: string
  refreshLabel: string
  reviewedLabel: string
  publishedLabel: string
  receiptLabel: string
  loadingLabel: string
  unavailableLabel: string
}

/** All visible chat copy is supplied by the owning application's locale. */
export interface HqAgentsContent {
  title: string
  description: string
  transcriptLabel: string
  composerLabel: string
  composerPlaceholder: string
  sendLabel: string
  sendingLabel: string
  dictation: {
    start: string; stop: string; starting: string; listening: string; stopping: string
    unsupported: string; denied: string; noSpeech: string; audio: string; network: string; failed: string; limit: string; notice: string
  }
  emptyLabel: string
  loadingLabel: string
  unavailableLabel: string
  errorLabel: string
  runtimeOnlineLabel: string
  runtimeOfflineLabel: string
  queuedLabel: string
  lastSeenLabel: string
  keyboardHint: string
  founderLabel: string
  ceoLabel: string
  hrLabel: string
  systemLabel: string
  locale?: string
  openTaskLabel?: string
  learningUpdatedLabel?: string
  requestProgressLabels?: {
    queued: string
    working: string
    recoveryNeeded: string
    recoveryQueued: string
    recoveryWorking: string
  }
  workforce?: HqWorkforceContent
}
