export type MeetingAudioError = 'consent-required' | 'insecure-context' | 'recognition-unavailable'
  | 'local-recognition-unavailable' | 'local-recognition-downloadable' | 'local-recognition-downloading'
  | 'local-recognition-unverified' | 'local-recognition-policy-blocked' | 'microphone-unavailable'
  | 'microphone-denied' | 'microphone-ended' | 'microphone-device-unavailable' | 'recognition-service-denied'
  | 'recognition-language-unavailable' | 'recognition-no-speech' | 'recognition-network' | 'recognition-failed'
  | 'recognition-limit' | 'recognition-model-required' | 'recognition-busy' | 'voice-unavailable' | 'playback-failed'
export type MeetingLocalRecognitionStatus = 'available' | 'unsupported-browser' | 'insecure-context'
  | 'language-unavailable' | 'language-downloadable' | 'language-downloading' | 'unverified'
export interface MeetingLocalRecognitionSupport {
  status: MeetingLocalRecognitionStatus
  /** Canonical recognition locale, such as ar-EG or en-US. */
  language: string
  error: 'recognition-model-required' | 'microphone-unavailable' | 'recognition-unavailable' | 'recognition-policy-blocked' | 'recognition-probe-failed' | null
}
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
  capture: 'idle' | 'requesting' | 'listening' | 'finishing' | 'failed'
  captureActive: boolean
  muted: boolean
  /** Basic browser-service API capability; not verified service/language readiness. */
  recognitionAvailable: boolean
  synthesisAvailable: boolean
  language: string
  recognitionMode: 'local-only' | 'browser-service' | null
  speakingAgentId: string | null
  error: MeetingAudioError | null
}
export interface MeetingAudioContribution { turnId: string; generationId: string; agentId: string }
export interface MeetingAudioDraft { text: string; final: boolean; uncertain: boolean; confidence: number | null; language: string }
export interface MeetingRecognitionResultEvent {
  resultIndex?: number
  results: ArrayLike<{ isFinal?: boolean; 0: { transcript: string; confidence?: number; language?: string } }>
}
export interface MeetingRecognitionSession {
  lang: string
  processLocally?: boolean
  continuous: boolean
  interimResults: boolean
  maxAlternatives: number
  onstart: (() => void) | null
  onresult: ((event: MeetingRecognitionResultEvent) => void) | null
  onerror: ((event: { error: string }) => void) | null
  onspeechstart: (() => void) | null
  onend: (() => void) | null
  start(): void
  stop?(): void
  abort(): void
}
export interface MeetingRecognitionEngine {
  support(): { available: boolean; prepared: boolean }
  createSession(stream: MediaStream, options?: { signal?: AbortSignal }): Promise<MeetingRecognitionSession>
}
export interface MeetingAudioOptions {
  language?: string
  profiles?: readonly MeetingVoiceProfile[]
  recognitionEngine?: MeetingRecognitionEngine
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
  finishCapture(): boolean
  setMuted(muted: boolean): boolean
  setLanguage(language: string): void
  setProfiles(profiles: readonly MeetingVoiceProfile[]): void
  voiceOptions(language?: string): { voiceURI: string; name: string; language: string; local: true }[]
  listVoices(language?: string): { voiceURI: string; name: string; language: string; local: true }[]
  localRecognitionAvailability(): Promise<'available' | 'unavailable' | 'unverified'>
  localRecognitionSupport(): Promise<MeetingLocalRecognitionSupport>
  voiceAvailable(agentId: string): boolean
  beginContribution(contribution: MeetingAudioContribution): boolean
  speakChunk(chunk: MeetingAudioContribution & { text: string }): boolean
  interrupt(reason?: string): boolean
  close(): void
}
export function createMeetingAudio(options?: MeetingAudioOptions): MeetingAudioController
