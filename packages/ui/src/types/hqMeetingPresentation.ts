/** Neutral meeting projections. Authorization, providers and persistence stay product-owned. */
export type HqMeetingLanguage = 'ar' | 'en'
export type HqMeetingParticipantStatus = 'listening' | 'thinking' | 'speaking' | 'researching' | 'hand-raised' | 'unavailable' | 'failed'
export type HqMeetingPlanState = 'draft' | 'awaiting-approval' | 'approved' | 'dispatched' | 'revised' | 'deferred' | 'discarded' | 'blocked'
export type HqMeetingConnection = 'connected' | 'connecting' | 'reconnecting' | 'offline' | 'failed'
export type HqMeetingTaskState = 'queued' | 'running' | 'completed' | 'failed' | 'cancelled' | 'review-required' | 'reviewed'

export interface HqMeetingParticipant {
  id: string
  name: string
  role: string
  avatarUrl?: string
  status: HqMeetingParticipantStatus
  eligible: boolean
  workEligible?: boolean
  selected?: boolean
  availability?: string
  voiceId?: string
}

export type HqMeetingLabel =
  | 'entry' | 'title' | 'meetingTitle' | 'language' | 'arabic' | 'english' | 'participants' | 'founder' | 'start' | 'resume'
  | 'live' | 'demonstration' | 'unavailable' | 'demonstrationNotice' | 'microphone' | 'microphoneOn' | 'microphoneOff'
  | 'microphoneUnavailable' | 'microphoneConsent' | 'microphoneDisclosure' | 'device' | 'voice' | 'voiceUnavailable' | 'voiceAvailable'
  | 'disconnectPolicy' | 'holdOnDisconnect' | 'retention' | 'closeNotice' | 'connection' | 'refresh' | 'mute' | 'unmute' | 'interrupt'
  | 'end' | 'ended' | 'floor' | 'unassigned' | 'invite' | 'transcript' | 'uncertain' | 'text' | 'address' | 'coordinator'
  | 'send' | 'chat' | 'share' | 'empty' | 'tasks' | 'cancelTask' | 'research' | 'question' | 'assignResearch' | 'findings' | 'plan' | 'version'
  | 'digest' | 'objective' | 'owner' | 'deliverable' | 'budget' | 'blockers' | 'draftPlan' | 'approve' | 'approveNow' | 'approveOnEnd'
  | 'revise' | 'defer' | 'discard' | 'approvalNotice' | 'approvalConfirmation' | 'cancel' | 'confirm' | 'scope' | 'acceptance' | 'review'
  | 'supervisor' | 'inputs' | 'dependencies' | 'priority' | 'environment'
  | 'liveScopeNotice' | 'liveSourceNotice' | 'approvedOnHold' | 'syntheticFounder'

export interface HqMeetingCopy {
  labels: Record<HqMeetingLabel, string>
  participantStatus: Record<HqMeetingParticipantStatus, string>
  connectionStatus: Record<HqMeetingConnection, string>
  taskStatus: Record<HqMeetingTaskState, string>
  planStatus: Record<HqMeetingPlanState, string>
}

export interface HqMeetingPresentation {
  phase: 'setup' | 'active' | 'ended' | 'unavailable'
  mode: 'demonstration' | 'live' | 'unavailable'
  connection: HqMeetingConnection
  language: HqMeetingLanguage
  title: string
  pending: boolean
  canStart: boolean
  founder: { id: string; name: string; avatarUrl?: string }
  participants: readonly HqMeetingParticipant[]
  floor?: string | null
  microphone: { available: boolean; active: boolean; muted: boolean; status: string; device?: string }
  voiceAvailable: boolean
  /** Reviewable recognition draft; it never implies a finalized instruction. */
  draftText?: string
  draftUncertain?: boolean
  voices?: readonly { id: string; name: string; language: string }[]
  transcript: readonly { id: string; speakerName: string; text: string; kind?: string; uncertain?: boolean }[]
  chat: readonly { id: string; speakerName: string; text: string; links?: readonly string[] }[]
  tasks: readonly { id: string; ownerName: string; title: string; status: HqMeetingTaskState; result?: string; error?: string }[]
  plan?: {
    version: number
    digest: string
    title: string
    summary: string
    state: HqMeetingPlanState
    tasks: readonly { id: string; objective: string; ownerName: string; deliverable: string; budget: string; blockers?: readonly string[]; scope?: readonly string[]; acceptance?: readonly string[]; review?: string; supervisorName?: string; inputs?: readonly string[]; dependencies?: readonly string[]; priority?: string; environment?: string }[]
    approvalTiming?: string
  } | null
  message?: string
  copy: HqMeetingCopy
}

export type HqMeetingCommand =
  | { type: 'start'; title: string; language: HqMeetingLanguage; participantIds: string[] }
  | { type: 'text'; text: string; addressedTo?: string }
  | { type: 'draft'; text: string }
  | { type: 'newMeeting' }
  | { type: 'chat'; text: string }
  | { type: 'language'; language: HqMeetingLanguage }
  | { type: 'interrupt' }
  | { type: 'microphone'; active: boolean; disclosureAccepted?: boolean }
  | { type: 'mute'; muted: boolean }
  | { type: 'voice'; agentId: string; voiceId: string }
  | { type: 'invite'; agentId: string }
  | { type: 'research'; agentId: string; question: string }
  | { type: 'cancelTask'; taskId: string }
  | { type: 'draftPlan'; title: string; objective: string; deliverable: string; ownerId: string }
  | { type: 'plan'; decision: 'approve' | 'approve-now' | 'approve-on-end' | 'revise' | 'defer' | 'discard'; version: number; digest: string }
  | { type: 'end' }
  | { type: 'refresh' }
  | { type: 'close' }
