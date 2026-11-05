export interface MeetingVoiceProfile {
  agentId: string
  voiceURI: string
  supportedLanguages: readonly string[]
  rate?: number
  pitch?: number
  availability?: 'available' | 'unavailable'
  fallbackPolicy: 'none'
}
export interface MeetingAudioState {
  capture: 'idle' | 'requesting' | 'listening' | 'failed'
  captureActive: boolean
  muted: boolean
  recognitionAvailable: boolean
  synthesisAvailable: boolean
  language: string
  recognitionMode: 'local-only' | 'browser-service' | null
  speakingAgentId: string | null
  error: string | null
}
export interface MeetingAudioContribution { turnId: string; generationId: string; agentId: string }
export interface MeetingAudioDraft { text: string; final: boolean; uncertain: boolean; confidence: number | null; language: string }
export interface MeetingAudioOptions {
  language?: string
  profiles?: readonly MeetingVoiceProfile[]
  environment?: Partial<Window & typeof globalThis>
  now?: () => number
  onState?: (state: MeetingAudioState) => void
  onDraft?: (draft: MeetingAudioDraft) => void
  onInterrupt?: (event: MeetingAudioContribution & { reason: string; cancellationCallLatencyMs: number }) => void
  onFounderSpeechStart?: (event: { reason: string }) => void
}
export interface MeetingAudioController {
  getState(): MeetingAudioState
  startCapture(consent: { userInitiated: true; recognitionDisclosureAccepted: true; deviceId?: string; recognitionMode?: 'local-only' | 'browser-service' }): Promise<boolean>
  stopCapture(): void
  setMuted(muted: boolean): boolean
  setLanguage(language: string): void
  setProfiles(profiles: readonly MeetingVoiceProfile[]): void
  voiceOptions(language?: string): { voiceURI: string; name: string; language: string; local: true }[]
  listVoices(language?: string): { voiceURI: string; name: string; language: string; local: true }[]
  localRecognitionAvailability(): Promise<'available' | 'unavailable' | 'unverified'>
  voiceAvailable(agentId: string): boolean
  beginContribution(contribution: MeetingAudioContribution): boolean
  speakChunk(chunk: MeetingAudioContribution & { text: string }): boolean
  interrupt(reason?: string): boolean
  close(): void
}
export function createMeetingAudio(options?: MeetingAudioOptions): MeetingAudioController
