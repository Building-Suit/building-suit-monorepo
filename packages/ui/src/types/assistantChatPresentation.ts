export interface BsAssistantChatLink {
  to: string
  label: string
}

export interface BsAssistantChatMessage {
  id: number
  role: 'user' | 'assistant' | 'receipt'
  text: string
  outcome?: string
  link?: BsAssistantChatLink
}

export interface BsAssistantChatCopy {
  title: string
  transcript: string
  user: string
  assistant: string
  receipt: string
  emptyTitle: string
  emptyDescription: string
  composer: string
  placeholder: string
  keyboardHint: string
  privacy: string
  send: string
  sending: string
  newChat: string
  confirm: string
  confirming: string
  discard: string
  proposalTitle: string
  proposalHelp: string
  loadEarlier?: string
  loadingEarlier?: string
  typing?: string
  status: Record<'loading' | 'denied' | 'unavailable' | 'noLocation', string>
}

export interface BsAssistantChatView {
  state: 'ready' | 'loading' | 'denied' | 'unavailable' | 'noLocation'
  context: readonly { label: string; value: string }[]
  messages: readonly BsAssistantChatMessage[]
  proposal: { title: string; fields: readonly { label: string; value: string }[] } | null
  delegation?: {
    enabled: boolean
    title: string
    explanation: string
    enable: string
    disable: string
    policies: readonly BsAssistantChatLink[]
  }
  pending: 'send' | 'confirm' | 'access' | null
  error: string | null
  canSend?: boolean
  showComposer?: boolean
  notice?: string
  hasMore?: boolean
  loadingEarlier?: boolean
  historyLoading?: boolean
  typing?: boolean
  pendingJobs?: readonly { id: string; label: string }[]
}

export interface BsShellAssistantChat {
  copy: BsAssistantChatCopy
  view: BsAssistantChatView
  maximumLength: number
  launcherLabel: string
  closeLabel: string
  openRequest?: number
}
