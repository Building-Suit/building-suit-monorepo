import type { MeetingRecognitionEngine } from './createMeetingAudio.mjs'
export interface MultilingualMeetingRecognitionState {
  phase: 'idle' | 'downloading' | 'loading' | 'ready' | 'failed'
  progress: number | null
  prepared: boolean
  processing: boolean
  error: string | null
}
export interface MultilingualMeetingRecognitionSupport {
  status: 'ready' | 'model-required' | 'unsupported-browser' | 'insecure-context'
  available: boolean
  prepared: boolean
  language: 'auto'
  languages: readonly ['ar', 'en']
  error: string | null
  model: { id: string; revision: string; approximateBytes: number }
}
export interface MultilingualMeetingRecognition extends MeetingRecognitionEngine {
  getState(): MultilingualMeetingRecognitionState
  support(): MultilingualMeetingRecognitionSupport
  prepare(consent: { userInitiated: true; modelDownloadConsent: true }): Promise<boolean>
  dispose(): void
}
export function createMultilingualMeetingRecognition(options?: {
  onState?: (state: MultilingualMeetingRecognitionState) => void
  environment?: Partial<Window & typeof globalThis>
  createWorker?: () => Worker
  workletUrl?: string | URL
}): MultilingualMeetingRecognition
