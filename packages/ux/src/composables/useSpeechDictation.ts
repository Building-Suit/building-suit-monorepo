import { computed, onMounted, onScopeDispose, reactive, readonly, watch } from 'vue'

export type SpeechDictationError = 'unsupported' | 'denied' | 'noSpeech' | 'audio' | 'network' | 'failed' | 'limit'
export type SpeechDictationPhase = 'idle' | 'starting' | 'listening' | 'stopping'
export interface SpeechRecognitionSession {
  lang: string
  continuous: boolean
  interimResults: boolean
  maxAlternatives: number
  onstart: (() => void) | null
  onend: (() => void) | null
  onerror: ((event: { error: string }) => void) | null
  onresult: ((event: { results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }> }) => void) | null
  start(): void
  stop(): void
  abort(): void
}
export type SpeechRecognitionConstructor = new () => SpeechRecognitionSession
interface DictationOptions {
  getDraft: () => string
  setDraft: (value: string) => void
  language: () => string
  disabled: () => boolean
  maximumLength: number
}
interface DictationState { supported: boolean; phase: SpeechDictationPhase; error: SpeechDictationError | null }

/** Draft-only controller. There is deliberately no message/send callback. The
 * constructor is injected so browser speech can be checked without a microphone. */
export function createSpeechDictation(options: DictationOptions, state: DictationState) {
  let Constructor: SpeechRecognitionConstructor | undefined
  let current: SpeechRecognitionSession | null = null, disposed = false
  let stopDeadline: ReturnType<typeof setTimeout> | undefined
  const active = () => state.phase !== 'idle'
  function finish(session: SpeechRecognitionSession, abort = false) {
    if (current !== session) return
    current = null
    clearTimeout(stopDeadline); stopDeadline = undefined
    session.onstart = session.onend = session.onerror = session.onresult = null
    state.phase = 'idle'
    if (abort) try { session.abort() } catch { /* Already stopped. */ }
  }
  function cancel() { if (current) finish(current, true) }
  function stop() {
    const session = current
    if (!session || state.phase === 'stopping') return
    state.phase = 'stopping'
    // Some engines fail to emit end after a lost connection. Never leave the
    // microphone or Send latch stuck waiting for that event indefinitely.
    stopDeadline = setTimeout(() => finish(session, true), 3000)
    try { session.stop() } catch { finish(session, true) }
  }
  function start() {
    if (disposed || active() || options.disabled()) return
    state.error = null
    if (!Constructor) { state.error = 'unsupported'; return }
    const prefix = options.getDraft()
    if (prefix.length >= options.maximumLength) { state.error = 'limit'; return }
    let lastWritten = prefix
    try {
      const session = new Constructor()
      current = session; state.phase = 'starting'
      session.lang = options.language()
      session.continuous = true; session.interimResults = true; session.maxAlternatives = 1
      session.onstart = () => { if (current === session && state.phase === 'starting') state.phase = 'listening' }
      session.onresult = event => {
        if (current !== session || disposed) return
        // A logout, external draft reset or programmatic edit wins over late
        // recognition events. Never overwrite a newly edited draft.
        if (options.disabled() || options.getDraft() !== lastWritten) { finish(session, true); return }
        const chunks: string[] = []
        for (let index = 0; index < event.results.length; index++) {
          const text = event.results[index]?.[0]?.transcript?.trim()
          if (text) chunks.push(text)
        }
        // The result list includes earlier final results. Replace this session's
        // suffix rather than appending every interim revision a second time.
        const spoken = chunks.join(' '), combined = prefix + (spoken && prefix && !/\s$/.test(prefix) ? ' ' : '') + spoken
        let value = combined.slice(0, options.maximumLength)
        if (/[\uD800-\uDBFF]$/.test(value)) value = value.slice(0, -1)
        lastWritten = value; options.setDraft(value)
        if (combined.length >= options.maximumLength) { state.error = 'limit'; stop() }
      }
      session.onerror = event => {
        if (current !== session) return
        const errors: Record<string, SpeechDictationError> = {
          'not-allowed': 'denied', 'service-not-allowed': 'denied', 'no-speech': 'noSpeech', 'audio-capture': 'audio', network: 'network',
        }
        state.error = event.error === 'aborted' ? null : errors[event.error] ?? 'failed'
        finish(session, true)
      }
      session.onend = () => { if (current === session) finish(session) }
      session.start()
    } catch {
      state.error = 'failed'
      if (current) finish(current, true)
    }
  }
  return {
    start, stop, cancel,
    setConstructor(value: SpeechRecognitionConstructor | undefined) { Constructor = value; state.supported = Boolean(value) },
    dispose() { disposed = true; cancel() },
  }
}

/** Browser capability discovery is mount-only; recording starts on an explicit
 * button action, ends on scope/language/access changes, and never auto-restarts. */
export function useSpeechDictation(options: DictationOptions) {
  const state = reactive<DictationState>({ supported: false, phase: 'idle', error: null })
  const controller = createSpeechDictation(options, state)
  onMounted(() => {
    const speechWindow = window as unknown as { SpeechRecognition?: SpeechRecognitionConstructor; webkitSpeechRecognition?: SpeechRecognitionConstructor }
    controller.setConstructor(window.isSecureContext ? speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition : undefined)
  })
  watch([options.disabled, options.language], () => controller.cancel(), { flush: 'sync' })
  onScopeDispose(controller.dispose)
  return {
    supported: computed(() => state.supported), active: computed(() => state.phase !== 'idle'),
    phase: computed(() => state.phase), error: computed(() => state.error), state: readonly(state),
    start: controller.start, stop: controller.stop, cancel: controller.cancel,
  }
}
