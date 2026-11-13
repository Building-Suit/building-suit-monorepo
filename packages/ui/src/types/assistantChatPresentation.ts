export interface BsAssistantChatLink {
  to: string
  label: string
}

export interface BsAssistantChatMessage {
  id: number
  role: 'user' | 'assistant' | 'receipt'
  text: string
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
}
