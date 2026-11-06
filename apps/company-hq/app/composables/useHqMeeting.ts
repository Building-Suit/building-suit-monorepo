import { computed, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue'
import { createMeetingAudio } from '@building-suit/ux/meetingAudio'
import type { MeetingAudioController, MeetingAudioError, MeetingAudioState, MeetingVoiceProfile } from '@building-suit/ux/meetingAudio'
import type { HqMeetingCommand, HqMeetingConnection, HqMeetingCopy, HqMeetingLabel, HqMeetingLanguage, HqMeetingPresentation, HqMeetingTaskState } from '@building-suit/ui/types/hqMeetingPresentation'
import type { MeetingRecord } from '../../shared/meetings/domain.mjs'
import type { MeetingRegistryParticipant } from '../../shared/meetings/registry.mjs'
import { buildLiveMeetingRequest, buildLivePlanSubmission, parseLiveMeetingSnapshot, parseLiveRoster } from '#shared/meetings/livePresentation.mjs'
import type { LiveMeetingCommandRequest, LiveMeetingRecord, LiveMeetingRegistryParticipant, LiveMeetingRequest } from '#shared/meetings/livePresentation.mjs'
import { createMultilingualMeetingRecognition } from '@building-suit/ux/meetingRecognition'
import type { MultilingualMeetingRecognition, MultilingualMeetingRecognitionState, MultilingualMeetingRecognitionSupport } from '@building-suit/ux/meetingRecognition'
import en from '../../i18n/locales/en.json'

type TransportCommand = HqMeetingCommand | { type: 'reconnect' } | { type: 'playback-ended'; turnId: string; generation: number }
interface Snapshot {
  mode: 'demonstration' | 'live'
  registry: MeetingRegistryParticipant[]
  record: MeetingRecord | null
  reports: { taskId: string; readyForFounder: boolean; synthetic: true; result: { deliverable?: string } | null }[]
}
interface Playback { turnId: string; generation: number; agentId: string; key: string }
const headers = { 'X-HQ-Access': '1', 'X-HQ-Brain': '1' }
const voiceStorageKey = 'building-suit:hq:meeting:local-voices:v1'
const defaultParticipants = new Set(['AG-CEO-001', 'AG-HR-001', 'AG-HR-002', 'AG-RES-001'])

/** Per-tab orchestration. Live transport remains independently gated by the server. */
export function useHqMeeting(accessStatus?: () => string, founder?: () => { displayName: string; avatarUrl?: string } | undefined) {
  const { rt } = useI18n()
  const liveEvents = useHqLiveEvents()
  const language = ref<HqMeetingLanguage>('en')
  const record = shallowRef<MeetingRecord | null>(null)
  const registry = shallowRef<MeetingRegistryParticipant[]>([])
  const liveRoster = shallowRef<LiveMeetingRegistryParticipant[]>([])
  const reports = shallowRef<Snapshot['reports']>([])
  const mode = ref<'demonstration' | 'live' | 'unavailable'>('unavailable')
  const demonstration = computed(() => mode.value === 'demonstration')
  const connection = ref<HqMeetingConnection>('connecting')
  const pending = ref(false)
  const message = ref('')
  const draftText = ref('')
  const draftUncertain = ref(false)
  const playbackMuted = ref(false)
  const localRecognition = ref(false)
  const recognitionState = shallowRef<MultilingualMeetingRecognitionState>({ phase: 'idle', progress: null, prepared: false, processing: false, error: null })
  const recognitionSupport = shallowRef<MultilingualMeetingRecognitionSupport | null>(null)
  const recognitionChecking = ref(false)
  const captureError = ref<MeetingAudioError | null>(null)
  const audioState = shallowRef<MeetingAudioState | null>(null)
  const playbackFailureAgent = ref<string | null>(null)
  const voices = shallowRef<{ voiceURI: string; name: string; language: string; local: true }[]>([])
  const voiceAssignments = ref<Record<string, string>>({})
  // Meeting chrome stays English independently of detected speech or replies.
  // Resolve Nuxt's compiled message AST through its supported runtime helper.
  const copy = computed<HqMeetingCopy>(() => Object.fromEntries(Object.entries(en.hq.meeting).map(([group, values]) => [group, Object.fromEntries(Object.entries(values).map(([key, value]) => [key, rt(value, {}, { locale: 'en' })]))])) as unknown as HqMeetingCopy)
  let audio: MeetingAudioController | null = null
  let recognitionEngine: MultilingualMeetingRecognition | null = null
  let opened = false
  let disposed = false
  let newMeetingIntent = false
  let epoch = 0
  let meetingSelection = 0
  let transport: AbortController | null = null
  let retryTimer: ReturnType<typeof setTimeout> | undefined
  let retryAttempt = 0
  let mutationQueue = Promise.resolve()
  let refreshPromise: Promise<void> | null = null
  let refreshAgain = false
  let interruptQueued = false
  let interruptionIntent = 0
  let reconnectQueued = false
  let playback: Playback | null = null
  let recognitionBase = ''
  let recognitionBaseUncertain = false
  let profileSignature = ''
  let refreshingVoices = false
  let previousAudioError: MeetingAudioError | null = null
  const requests = new Set<AbortController>()
  const requestIds = new Map<string, string>()
  const liveRequests = new Map<string, LiveMeetingRequest>()
  const liveSubmissions = new Map<string, LiveMeetingCommandRequest>()
  const uncertainProposals = new Set<string>()
  const played = new Set<string>()
  const completed = new Set<string>()

  function voiceKey(agentId: string) { return `${language.value}:${agentId}` }
  function founderName() { return mode.value === 'live' ? founder?.()?.displayName || copy.value.labels.founder : copy.value.labels.syntheticFounder }
  function nameFor(id: string) { return id === record.value?.founderId ? founderName() : record.value?.participants.find(item => item.id === id)?.name ?? registry.value.find(item => item.id === id)?.name ?? id }
  function failure() { message.value = copy.value.labels.meetingSetupRequired }
  function clearPrivateLiveState(error: unknown) {
    if (mode.value !== 'live' || !(error instanceof Error) || !/^meeting-http-40[13]$/.test(error.message)) return
    invalidate('authority-lost', false)
    liveRequests.clear(); liveSubmissions.clear(); uncertainProposals.clear(); requestIds.clear(); mode.value = 'unavailable'
    record.value = null; registry.value = []; liveRoster.value = []; reports.value = []; draftText.value = ''; draftUncertain.value = false
  }
  function online() { return typeof navigator === 'undefined' || navigator.onLine !== false }
  function usable() { return opened && !disposed && online() && (typeof document === 'undefined' || document.visibilityState !== 'hidden') }
  function stopPlayback(reason: string) {
    if (playback) played.add(playback.key)
    playback = null
    audio?.interrupt(reason)
  }
  function stopCapture() { audio?.stopCapture() }
  function beginInterruption() { interruptQueued = true; return ++interruptionIntent }

  async function json<T>(path: string, body?: object, capturedEpoch = epoch): Promise<T> {
    const controller = new AbortController()
    requests.add(controller)
    try {
      const response = await fetch(path, { method: body ? 'POST' : 'GET', credentials: 'same-origin', cache: 'no-store', headers: { ...headers, ...(body ? { 'Content-Type': 'application/json' } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}), signal: controller.signal })
      if (!response.ok) throw new Error(`meeting-http-${response.status}`)
      const value = await response.json() as T
      if (capturedEpoch !== epoch || disposed) throw new Error('meeting-stale-request')
      return value
    }
    finally { requests.delete(controller) }
  }

  function validSnapshot(value: Snapshot): boolean {
    if (value?.mode !== mode.value || !Array.isArray(value.registry) || value.registry.length > 32) return false
    const item = value.record
    return !item || (item.mode === value.mode && typeof item.id === 'string' && Number.isSafeInteger(item.revision) && ['ar', 'en'].includes(item.language) && Array.isArray(item.events) && item.events.length <= 5000 && Array.isArray(item.participants) && item.participants.length <= 32 && Array.isArray(item.tasks) && item.tasks.length <= 100 && Array.isArray(item.plans) && item.plans.length <= 64)
  }

  function liveSnapshot(value: unknown): Snapshot {
    return { mode: 'live', registry: liveRoster.value, record: parseLiveMeetingSnapshot(value, liveRoster.value), reports: [] }
  }

  function refreshVoices() {
    if (!audio || refreshingVoices) return
    refreshingVoices = true
    try {
      voices.value = audio.voiceOptions(language.value)
      const available = new Set(voices.value.map(item => item.voiceURI))
      const participants = record.value?.participants ?? registry.value
      const assigned = new Set<string>()
      const profiles: MeetingVoiceProfile[] = participants.flatMap(participant => {
        if (mode.value === 'live' && !liveRoster.value.some(item => item.id === participant.id && item.conversationAvailable)) return []
        const uri = voiceAssignments.value[voiceKey(participant.id)]
        if (!uri || !available.has(uri) || assigned.has(uri)) return []
        assigned.add(uri)
        return [{ agentId: participant.id, voiceURI: uri, supportedLanguages: [language.value], availability: 'available', fallbackPolicy: 'none' }]
      })
      const signature = JSON.stringify(profiles)
      if (signature !== profileSignature) { profileSignature = signature; audio.setProfiles(profiles) }
    }
    finally { refreshingVoices = false }
  }

  function probeRecognition() {
    recognitionChecking.value = true
    recognitionSupport.value = recognitionEngine?.support() ?? null
    recognitionState.value = recognitionEngine?.getState() ?? recognitionState.value
    localRecognition.value = recognitionSupport.value?.available === true && recognitionState.value.prepared
    recognitionChecking.value = false
  }

  const captureErrors: Partial<Record<MeetingAudioError, HqMeetingLabel>> = {
    'consent-required': 'microphoneConsentRequired', 'insecure-context': 'microphoneInsecure', 'recognition-unavailable': 'microphoneUnsupported',
    'local-recognition-unavailable': 'microphoneLanguageUnavailable', 'local-recognition-downloadable': 'microphoneLanguageDownloadable',
    'local-recognition-downloading': 'microphoneLanguageDownloading', 'local-recognition-unverified': 'microphoneSupportUnverified',
    'local-recognition-policy-blocked': 'microphonePolicyBlocked', 'microphone-unavailable': 'microphoneCaptureUnavailable',
    'microphone-denied': 'microphonePermissionDenied', 'microphone-device-unavailable': 'microphoneDeviceUnavailable',
    'microphone-ended': 'microphoneInputEnded', 'recognition-service-denied': 'microphoneServiceBlocked',
    'recognition-language-unavailable': 'microphoneLanguageError', 'recognition-no-speech': 'microphoneNoSpeech',
    'recognition-network': 'microphoneNetworkFailed', 'recognition-failed': 'microphoneRecognitionFailed', 'recognition-limit': 'microphoneLimit',
    'recognition-model-required': 'recognitionModelRequired', 'recognition-busy': 'microphoneRecognitionFailed',
  }
  function recognitionModelStatus(): string {
    if (recognitionState.value.phase === 'downloading') return copy.value.labels.recognitionDownloading
    if (recognitionState.value.phase === 'loading') return copy.value.labels.recognitionLoading
    if (recognitionState.value.phase === 'failed') return copy.value.labels[recognitionState.value.error === 'model-consent-required' ? 'recognitionModelConsentRequired' : 'recognitionModelFailed']
    if (recognitionState.value.processing) return copy.value.labels.recognitionTranscribing
    if (recognitionSupport.value?.status === 'insecure-context') return copy.value.labels.microphoneInsecure
    if (recognitionSupport.value?.status === 'unsupported-browser') return copy.value.labels.microphoneUnsupported
    return copy.value.labels[recognitionState.value.prepared ? 'recognitionModelReady' : 'recognitionModelRequired']
  }
  function microphoneStatus(): string {
    const state = audioState.value
    if (state?.capture === 'finishing') return copy.value.labels.microphoneFinishing
    if (state?.capture === 'requesting') return copy.value.labels.microphoneStarting
    if (state?.captureActive) return copy.value.labels.microphoneListening
    const errorLabel = captureError.value ? captureErrors[captureError.value] : undefined
    if (errorLabel) return copy.value.labels[errorLabel]
    if (recognitionChecking.value) return copy.value.labels.microphoneChecking
    if (recognitionState.value.prepared && !recognitionState.value.processing) return copy.value.labels.microphoneReadyLocal
    return recognitionModelStatus()
  }

  function completePlayback(item: Playback) {
    if (completed.has(item.key) || !usable() || record.value?.id === undefined || record.value?.turn?.id !== item.turnId || record.value.generation !== item.generation) return
    completed.add(item.key)
    void enqueue({ type: 'playback-ended', turnId: item.turnId, generation: item.generation }, true).then(success => { if (!success) completed.delete(item.key) })
  }

  function admitPlayback() {
    const current = record.value
    const turn = current?.turn
    if (!current || !turn || current.status !== 'active' || turn.status !== 'speaking' || !usable()) return
    if (mode.value === 'live' && !liveRoster.value.some(person => person.id === turn.agentId && person.conversationAvailable)) return
    const key = `${current.id}:${turn.id}:${turn.generation}`
    // A founder interruption must fence output before any asynchronous response.
    // Wait for that command's exact snapshot before admitting a fresh turn.
    if (interruptQueued) return
    const item: Playback = { key, turnId: turn.id, generation: turn.generation, agentId: turn.agentId }
    if (played.has(key)) {
      // Retrying a failed completion on a real readback must never replay audio.
      if (playback?.key !== key && !completed.has(key)) completePlayback(item)
      return
    }
    played.add(key)
    if (played.size > 1000) played.delete(played.values().next().value!)
    const contribution = current.events.find(event => event.id === turn.contributionEventId)
    const text = contribution?.data.text
    if (!audio || playbackMuted.value || !audio.voiceAvailable(turn.agentId) || typeof text !== 'string') { completePlayback(item); return }
    const identity = { turnId: turn.id, generationId: String(turn.generation), agentId: turn.agentId }
    // beginContribution interrupts any earlier output before this identity is admitted.
    if (!audio.beginContribution(identity)) { completePlayback(item); return }
    playbackFailureAgent.value = null
    playback = item
    if (!audio.speakChunk({ ...identity, text })) {
      if (['voice-unavailable', 'playback-failed'].includes(audio.getState().error ?? '')) playbackFailureAgent.value = turn.agentId
      playback = null; completePlayback(item)
    }
  }

  function applySnapshot(value: Snapshot) {
    if (!validSnapshot(value)) throw new Error('invalid-meeting-snapshot')
    const current = record.value
    if (current && value.record?.id === current.id && value.record.revision < current.revision) return
    registry.value = value.registry
    if (!(newMeetingIntent && value.record?.status === 'ended')) record.value = value.record
    reports.value = Array.isArray(value.reports) ? value.reports.slice(0, 100) : []
    if (record.value) {
      if (language.value !== record.value.language) {
        stopCapture(); stopPlayback('language-change')
        language.value = record.value.language
        audio?.setLanguage(language.value)
        void probeRecognition()
      }
      const turn = record.value.turn
      if (playback && (!turn || turn.id !== playback.turnId || turn.generation !== playback.generation || turn.status !== 'speaking' || record.value.status !== 'active' || mode.value === 'live' && !liveRoster.value.some(person => person.id === playback?.agentId && person.conversationAvailable))) stopPlayback('superseded')
      if (record.value.status === 'ended') stopCapture()
    }
    refreshVoices()
    admitPlayback()
  }

  async function availability(capturedEpoch = epoch) {
    const value = await json<{ demonstration: boolean; live: boolean; blockers: string[] }>('/api/hq/meetings/availability', undefined, capturedEpoch)
    const selected = value.live === true && value.demonstration !== true && accessStatus?.() === 'founder' ? 'live' : value.demonstration === true && value.live !== true ? 'demonstration' : 'unavailable'
    if (selected !== mode.value) {
      stopCapture(); stopPlayback('mode-change')
      transport?.abort(); transport = null
      mode.value = selected
      record.value = null; registry.value = []; liveRoster.value = []; reports.value = []; meetingSelection++
      draftText.value = ''; draftUncertain.value = false; newMeetingIntent = false
      playbackFailureAgent.value = null
      liveRequests.clear(); liveSubmissions.clear(); uncertainProposals.clear(); requestIds.clear()
    }
    if (mode.value === 'unavailable') message.value = copy.value.labels.meetingSetupRequired
    return mode.value !== 'unavailable'
  }

  async function refresh() {
    if (refreshPromise) { refreshAgain = true; return refreshPromise }
    const capturedEpoch = epoch
    refreshPromise = (async () => {
      try {
        if (!online()) { connection.value = 'offline'; return }
        if (!await availability(capturedEpoch) || !opened || capturedEpoch !== epoch) { if (mode.value === 'unavailable') connection.value = 'failed'; return }
        const capturedSelection = meetingSelection
        const id = record.value?.id
        let value: Snapshot
        if (mode.value === 'live') {
          liveRoster.value = parseLiveRoster(await json<unknown>('/api/hq/meetings/registry', undefined, capturedEpoch))
          value = liveSnapshot(await json<unknown>(`/api/hq/meetings/live${id ? `?id=${encodeURIComponent(id)}` : ''}`, undefined, capturedEpoch))
        }
        else value = await json<Snapshot>(`/api/hq/meetings/demo${id ? `?id=${encodeURIComponent(id)}` : ''}`, undefined, capturedEpoch)
        if (capturedSelection !== meetingSelection) return
        applySnapshot(value)
        connection.value = 'connected'
        message.value = ''
        reconnectRecord()
        if (demonstration.value && !transport) void connectEvents()
      }
      catch (error) {
        if (capturedEpoch === epoch && !disposed) { clearPrivateLiveState(error); stopCapture(); stopPlayback('readback-failed'); connection.value = online() ? 'failed' : 'offline'; failure() }
      }
      finally {
        if (capturedEpoch === epoch) {
          refreshPromise = null
          if (refreshAgain && usable()) { refreshAgain = false; void refresh() }
          else refreshAgain = false
        }
      }
    })()
    return refreshPromise
  }

  function enqueue(command: TransportCommand, automatic = false, interruptionToken?: number): Promise<boolean> {
    const capturedEpoch = epoch
    const capturedMode = mode.value
    const targetId = command.type === 'start' ? undefined : record.value?.id
    const operation = mutationQueue.then(async () => {
      if (capturedEpoch !== epoch || capturedMode !== mode.value || !usable() || mode.value === 'unavailable' || (mode.value === 'live' && accessStatus?.() !== 'founder') || (command.type !== 'start' && (!targetId || record.value?.id !== targetId))) return false
      pending.value = true
      const key = JSON.stringify({ meetingId: targetId, command })
      let requestId = requestIds.get(key)
      if (!requestId) { requestId = crypto.randomUUID(); requestIds.set(key, requestId) }
      try {
        let value: Snapshot
        if (mode.value === 'live') {
          const body = liveRequests.get(key) ?? buildLiveMeetingRequest(command, { requestId, meetingId: targetId, record: record.value as LiveMeetingRecord | null, roster: liveRoster.value })
          if (!body) throw new Error('unsupported-live-meeting-command')
          liveRequests.set(key, body)
          value = liveSnapshot(await json<unknown>('/api/hq/meetings/live', body, capturedEpoch))
          if (command.type === 'draftPlan' && value.record) {
            const planId = body.type === 'command' ? String(body.command.planId) : ''
            // An unknown proposal result has no trusted returned version yet.
            // Recover its snapshot, then require a fresh explicit edit action.
            if (uncertainProposals.has(key) && !liveSubmissions.has(key)) {
              applySnapshot(value); requestIds.delete(key); liveRequests.delete(key); uncertainProposals.delete(key); failure()
              return false
            }
            const submitKey = `${key}:submit`
            let submitId = requestIds.get(submitKey)
            if (!submitId) { submitId = crypto.randomUUID(); requestIds.set(submitKey, submitId) }
            const submit = liveSubmissions.get(key) ?? buildLivePlanSubmission(value.record as LiveMeetingRecord, submitId, planId)
            liveSubmissions.set(key, submit)
            const proposed = value.record.plans.find(plan => plan.id === submit.command.planId && plan.version === submit.command.version && plan.hash === submit.command.digest)
            const latest = value.record.plans.filter(plan => plan.id === planId).at(-1)
            if (!proposed || latest?.version !== proposed.version || !['draft', 'awaiting-approval'].includes(proposed.status)) { applySnapshot(value); throw new Error('live-meeting-plan-version-changed') }
            if (proposed.status === 'draft') {
              value = liveSnapshot(await json<unknown>('/api/hq/meetings/live', submit, capturedEpoch))
            }
            requestIds.delete(submitKey)
          }
        }
        else value = await json<Snapshot>('/api/hq/meetings/demo', { requestId, ...(targetId ? { meetingId: targetId } : {}), command }, capturedEpoch)
        if (command.type === 'start') { newMeetingIntent = false; meetingSelection++ }
        if (command.type === 'interrupt' && interruptionToken === interruptionIntent) interruptQueued = false
        applySnapshot(value)
        connection.value = 'connected'
        message.value = ''
        requestIds.delete(key)
        liveRequests.delete(key)
        liveSubmissions.delete(key); uncertainProposals.delete(key)
        if (command.type === 'text' && draftText.value.trim() === command.text) { draftText.value = ''; draftUncertain.value = false }
        return true
      }
      catch (error) {
        if (capturedEpoch === epoch && !disposed) {
          clearPrivateLiveState(error)
          if (!automatic) failure()
          // A confirmed conflict is safe to retry only as a fresh user action.
          const knownRejection = error instanceof Error && (/^meeting-http-4\d\d$/.test(error.message) || error.message === 'live-meeting-plan-version-changed')
          if (knownRejection) { requestIds.delete(key); requestIds.delete(`${key}:submit`); liveRequests.delete(key); liveSubmissions.delete(key); uncertainProposals.delete(key) }
          else if (mode.value === 'live' && command.type === 'draftPlan' && liveRequests.has(key) && !liveSubmissions.has(key)) uncertainProposals.add(key)
        }
        return false
      }
      finally { if (capturedEpoch === epoch) pending.value = false }
    })
    mutationQueue = operation.then(() => undefined, () => undefined)
    return operation
  }

  function reconnectRecord() {
    if (!reconnectQueued && record.value?.status === 'active' && record.value.connection !== 'connected') {
      reconnectQueued = true
      const capturedEpoch = epoch
      void enqueue({ type: 'reconnect' }, true).finally(() => { if (capturedEpoch === epoch) reconnectQueued = false })
    }
  }

  async function connectEvents() {
    if (!usable() || !demonstration.value || transport) return
    if (retryTimer) { clearTimeout(retryTimer); retryTimer = undefined }
    const capturedEpoch = epoch
    const controller = new AbortController()
    transport = controller
    try {
      const response = await fetch('/api/hq/meetings/demo-events', { credentials: 'same-origin', cache: 'no-store', headers, signal: controller.signal })
      if (!response.ok || !response.body) throw new Error('meeting-events-unavailable')
      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      while (usable() && capturedEpoch === epoch) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true }).replace(/\r\n/g, '\n')
        if (buffer.length > 65536) throw new Error('meeting-events-overflow')
        let boundary = buffer.indexOf('\n\n')
        while (boundary >= 0) {
          const frame = buffer.slice(0, boundary)
          buffer = buffer.slice(boundary + 2)
          const event = frame.split('\n').find(line => line.startsWith('event:'))?.slice(6).trim()
          if (event === 'ready') { retryAttempt = 0; connection.value = 'connected'; void refresh().then(reconnectRecord) }
          else if (event === 'meeting') void refresh()
          boundary = buffer.indexOf('\n\n')
        }
      }
      await reader.cancel().catch(() => undefined)
    }
    catch { /* Connection retry reads one snapshot on ready; heartbeats never query. */ }
    finally {
      if (transport === controller) transport = null
      if (capturedEpoch === epoch && usable() && demonstration.value) {
        connection.value = 'reconnecting'
        const delay = Math.min(30000, 500 * 2 ** Math.min(retryAttempt++, 6))
        retryTimer = setTimeout(() => { retryTimer = undefined; void connectEvents() }, delay)
      }
    }
  }

  function bestEffortDisconnect() {
    const id = record.value?.id
    if (!opened || !id || record.value?.status !== 'active' || mode.value === 'unavailable') return
    const requestId = crypto.randomUUID()
    const body = mode.value === 'live' ? buildLiveMeetingRequest({ type: 'close' }, { requestId, meetingId: id }) : { requestId, meetingId: id, command: { type: 'close' } }
    if (!body) return
    void fetch(`/api/hq/meetings/${mode.value === 'live' ? 'live' : 'demo'}`, { method: 'POST', credentials: 'same-origin', cache: 'no-store', keepalive: true, headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).catch(() => undefined)
  }

  function invalidate(reason: string, disconnect = true) {
    if (disconnect) bestEffortDisconnect()
    epoch++
    if (retryTimer) clearTimeout(retryTimer)
    retryTimer = undefined
    transport?.abort(); transport = null
    for (const request of requests) request.abort()
    requests.clear()
    refreshPromise = null; refreshAgain = false
    interruptionIntent++; interruptQueued = false; reconnectQueued = false; pending.value = false
    stopCapture(); stopPlayback(reason)
  }

  async function command(value: HqMeetingCommand): Promise<void> {
    if (disposed) return
    if (value.type === 'draft') {
      // Typing takes ownership of the reviewable draft; a later interim speech
      // result must not replace that explicit edit or append it twice.
      if (audioState.value?.captureActive || ['requesting', 'finishing'].includes(audioState.value?.capture ?? '')) stopCapture()
      if (value.text.length > 12000) {
        message.value = rt(en.hq.agents.dictation.limit, {}, { locale: 'en' })
        return
      }
      draftText.value = value.text; draftUncertain.value = false; recognitionBase = draftText.value
      if (message.value === copy.value.labels.contributionTooLong && Array.from(value.text).length <= 4000) message.value = ''
      return
    }
    if (value.type === 'refresh') {
      if (!opened) { opened = true; connection.value = online() ? 'connecting' : 'offline'; void probeRecognition() }
      await refresh(); reconnectRecord(); return
    }
    if (value.type === 'recheckMicrophone') { captureError.value = null; probeRecognition(); return }
    if (value.type === 'prepareMicrophone') {
      if (!recognitionEngine || recognitionState.value.prepared || ['loading', 'downloading'].includes(recognitionState.value.phase)) return
      if (!value.downloadConsent) { message.value = copy.value.labels.recognitionModelConsentRequired; return }
      captureError.value = null
      await recognitionEngine.prepare({ userInitiated: true, modelDownloadConsent: true })
      if (!disposed) probeRecognition()
      return
    }
    if (value.type === 'close') { invalidate('closed'); opened = false; connection.value = 'offline'; return }
    if (value.type === 'newMeeting') {
      if (record.value?.status !== 'ended' || pending.value) return
      stopCapture(); stopPlayback('new-meeting')
      meetingSelection++
      record.value = null; reports.value = []; draftText.value = ''; draftUncertain.value = false; newMeetingIntent = true
      playbackFailureAgent.value = null
      return
    }
    if (value.type === 'voice') {
      if (!voices.value.some(item => item.voiceURI === value.voiceId) || !registry.value.some(item => item.id === value.agentId)) return
      const key = voiceKey(value.agentId)
      if (Object.entries(voiceAssignments.value).some(([other, uri]) => other !== key && other.startsWith(`${language.value}:`) && uri === value.voiceId)) { message.value = copy.value.labels.voiceUnavailable; return }
      stopPlayback('voice-change')
      voiceAssignments.value = { ...voiceAssignments.value, [key]: value.voiceId }
      playbackFailureAgent.value = null
      try { localStorage.setItem(voiceStorageKey, JSON.stringify(voiceAssignments.value)) }
      catch { /* Voice preference persistence is optional. */ }
      refreshVoices(); message.value = ''; return
    }
    if (value.type === 'microphone') {
      if (!value.active) { audio?.finishCapture(); return }
      if (!usable() || pending.value || record.value?.status !== 'active' || !value.disclosureAccepted || !localRecognition.value || !audio || ['requesting', 'finishing'].includes(audioState.value?.capture ?? '')) return
      captureError.value = null
      recognitionBase = draftText.value.trim()
      recognitionBaseUncertain = draftUncertain.value
      await audio.startCapture({ userInitiated: true, recognitionDisclosureAccepted: true, recognitionMode: 'local-only' })
      return
    }
    if (value.type === 'mute') {
      playbackMuted.value = value.muted
      if (value.muted) { stopPlayback('muted'); const token = beginInterruption(); await enqueue({ type: 'interrupt' }, false, token) }
      return
    }
    if (value.type === 'language') {
      stopCapture(); stopPlayback('language-change')
      language.value = value.language
      audio?.setLanguage(value.language)
      refreshVoices(); void probeRecognition()
      if (record.value?.status === 'active') await enqueue(value)
      return
    }
    if (value.type === 'interrupt') { stopPlayback('founder-interrupt'); const token = beginInterruption(); await enqueue(value, false, token); return }
    if (!usable() || mode.value === 'unavailable' || pending.value) return
    if (value.type === 'text' && (audioState.value?.captureActive || ['requesting', 'finishing'].includes(audioState.value?.capture ?? ''))) return
    if (value.type === 'text' && Array.from(value.text).length > 4000) { message.value = copy.value.labels.contributionTooLong; return }
    let textIntent: number | undefined
    if (value.type === 'text') { stopCapture(); stopPlayback('founder-text'); textIntent = beginInterruption() }
    if (value.type === 'end') { stopCapture(); stopPlayback('meeting-ended') }
    const success = await enqueue(value)
    if (value.type === 'text' && textIntent === interruptionIntent) { interruptQueued = false; if (success) admitPlayback() }
  }

  const meeting = computed<HqMeetingPresentation>(() => {
    const current = record.value
    const liveCurrent = mode.value === 'live' ? current as LiveMeetingRecord | null : null
    const people = current?.participants ?? registry.value
    const latestPlan = current?.plans.at(-1)
    const activeAudio = audioState.value
    const trustedFounder = mode.value === 'live' ? founder?.() : undefined
    const status = microphoneStatus()
    const voiceFailed = playbackFailureAgent.value !== null && ['playback-failed', 'voice-unavailable'].includes(activeAudio?.error ?? '')
    const sourceFailed = Boolean(liveCurrent?.liveContributionErrors.length)
    const upgradeRequired = liveCurrent?.liveContributionErrors.some(item => item.error === 'meeting-protocol-required') === true
    const visibleMessage = message.value || (voiceFailed ? copy.value.labels.voiceUnavailable : upgradeRequired ? copy.value.labels.workerUpgradeRequired : sourceFailed ? copy.value.labels.unavailable : '')
    const qualifiedChair = mode.value !== 'live' || liveRoster.value.some(person => person.id === 'AG-CEO-001' && person.conversationAvailable)
    return {
      phase: mode.value === 'unavailable' ? 'unavailable' : current?.status === 'ended' ? 'ended' : current ? 'active' : 'setup',
      mode: mode.value, connection: connection.value,
      language: language.value, title: current?.title ?? '', pending: pending.value,
      canStart: mode.value !== 'unavailable' && qualifiedChair && registry.value.length > 0 && connection.value === 'connected' && !current,
      founder: { id: current?.founderId ?? (mode.value === 'live' ? 'founder' : 'synthetic-founder'), name: founderName(), ...(trustedFounder?.avatarUrl ? { avatarUrl: trustedFounder.avatarUrl } : {}) },
      participants: people.map(person => {
        const participant = current?.participants.find(item => item.id === person.id)
        const status = voiceFailed && playbackFailureAgent.value === person.id ? 'failed' : activeAudio?.speakingAgentId === person.id ? 'speaking' : participant?.status === 'speaking' ? 'listening' : participant?.status ?? 'listening'
        const source = registry.value.find(item => item.id === person.id)
        const qualified = demonstration.value || liveRoster.value.some(item => item.id === person.id && item.conversationAvailable)
        const supervisor = participant?.supervisorId ?? liveRoster.value.find(item => item.id === person.id)?.supervisorId
        const qualifiedSupervisor = demonstration.value || liveRoster.value.some(item => item.id === supervisor && item.workQualified)
        return { id: person.id, name: person.name, role: person.role, ...(participant?.avatar ? { avatarUrl: participant.avatar } : {}), status: !qualified ? 'unavailable' : status, eligible: qualified, workEligible: Boolean(supervisor) && (demonstration.value || liveRoster.value.some(item => item.id === person.id && item.workQualified)) && qualifiedSupervisor && (demonstration.value || liveRoster.value.some(item => item.id === 'AG-CEO-001' && item.workQualified)), selected: defaultParticipants.has(person.id), availability: source ? mode.value === 'live' ? source.lifecycle : `${source.lifecycle} · ${source.operation}` : undefined, voiceId: voiceAssignments.value[voiceKey(person.id)] }
      }),
      floor: current?.floor.kind === 'founder' ? current.founderId : current?.floor.kind === 'agent' ? current.floor.agentId : null,
      microphone: { available: localRecognition.value, active: activeAudio?.captureActive ?? false, muted: playbackMuted.value, status,
        support: recognitionChecking.value ? 'checking' : recognitionSupport.value?.status ?? 'unverified', checking: recognitionChecking.value, phase: activeAudio?.capture ?? 'idle',
        model: { phase: recognitionState.value.phase, prepared: recognitionState.value.prepared, canPrepare: recognitionSupport.value?.available === true && !recognitionState.value.prepared && !['loading', 'downloading'].includes(recognitionState.value.phase), processing: recognitionState.value.processing, progress: recognitionState.value.progress, status: recognitionModelStatus() } },
      voiceAvailable: people.some(person => audio?.voiceAvailable(person.id)),
      voices: voices.value.map(item => ({ id: item.voiceURI, name: item.name, language: item.language })),
      draftText: draftText.value,
      draftUncertain: draftUncertain.value,
      transcript: (current?.events ?? []).filter(event => ['founder-utterance', 'agent-contribution', 'execution-report-ready'].includes(event.type)).map(event => ({ id: event.id, speakerName: nameFor(String(event.data.agentId ?? event.actorId)), text: String(event.data.text ?? event.data.summary ?? ''), kind: event.category, uncertain: event.data.uncertain === true })),
      chat: (current?.events ?? []).filter(event => ['link-shared', 'chat-message'].includes(event.type)).map(event => ({ id: event.id, speakerName: nameFor(String(event.data.speakerId ?? event.actorId)), text: String(event.data.text ?? event.data.url ?? ''), ...(typeof event.data.url === 'string' ? { links: [event.data.url] } : {}) })),
      tasks: (current?.tasks ?? []).map(task => {
        const report = reports.value.find(item => item.taskId === task.id)
        const status: HqMeetingTaskState = task.status === 'completed' && task.kind === 'execution' ? report?.readyForFounder || task.reviewStatus === 'accepted' ? 'reviewed' : 'review-required' : task.status
        return { id: task.id, ownerName: nameFor(task.agentId), title: task.question, status, ...(task.result ? { result: task.result } : {}), ...(task.error ? { error: mode.value === 'live' ? copy.value.labels.unavailable : task.error } : {}) }
      }),
      plan: latestPlan ? { version: latestPlan.version, digest: latestPlan.hash, title: latestPlan.title, summary: latestPlan.summary, state: liveCurrent?.liveBlockedPlanIds.includes(latestPlan.id) ? 'blocked' : latestPlan.status, tasks: latestPlan.tasks.map(task => ({ id: task.id, objective: task.objective, ownerName: nameFor(task.owner), deliverable: task.deliverable, budget: String(task.budget), blockers: task.blockers, scope: [task.scope ?? '', ...task.allowedActions, ...(task.allowedTools ?? [])].filter(Boolean), acceptance: task.acceptanceCriteria, review: task.requiredReview.map(nameFor).join(' → '), supervisorName: nameFor(task.supervisor), inputs: task.inputs, dependencies: task.dependencies, priority: task.priority, environment: task.executionEnvironment })), ...(latestPlan.approval ? { approvalTiming: copy.value.labels[latestPlan.approval.start === 'now' ? 'approveNow' : latestPlan.approval.start === 'meeting-end' ? 'approveOnEnd' : 'approvedOnHold'] } : {}) } : null,
      ...(visibleMessage ? { message: visibleMessage } : {}), copy: copy.value,
    }
  })

  function visibilityChanged() {
    if (document.visibilityState === 'hidden') { if (opened) { invalidate('hidden'); connection.value = 'offline' } }
    else if (opened) { connection.value = 'reconnecting'; void refresh().then(reconnectRecord) }
  }
  function networkChanged() {
    if (!online()) { invalidate('offline'); connection.value = 'offline' }
    else if (opened) { connection.value = 'reconnecting'; void refresh().then(reconnectRecord) }
  }
  function unloading() { invalidate('unload') }
  function voicesChanged() { refreshVoices() }

  onMounted(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(voiceStorageKey) ?? '{}') as unknown
      if (saved && typeof saved === 'object' && !Array.isArray(saved)) voiceAssignments.value = Object.fromEntries(Object.entries(saved).filter(([key, value]) => /^(ar|en):[A-Z0-9-]+$/.test(key) && typeof value === 'string' && value.length <= 500).slice(0, 64))
    }
    catch { /* Unavailable storage leaves text as the default. */ }
    recognitionEngine = createMultilingualMeetingRecognition({ onState(state) {
      recognitionState.value = state
      if (recognitionEngine) { recognitionSupport.value = recognitionEngine.support(); localRecognition.value = recognitionSupport.value.available && state.prepared }
    } })
    probeRecognition()
    audio = createMeetingAudio({
      language: language.value, recognitionEngine,
      onState(state) {
        const previous = audioState.value?.speakingAgentId
        audioState.value = state
        if (state.error !== previousAudioError) {
          if (state.error && captureErrors[state.error]) captureError.value = state.error
          else if (!state.error) captureError.value = null
          previousAudioError = state.error
        }
        if (playback && previous === playback.agentId && !state.speakingAgentId) { const item = playback; playback = null; completePlayback(item) }
      },
      onDraft(draft) {
        if (!usable() || record.value?.status !== 'active') return
        const combined = [recognitionBase, draft.text].filter(Boolean).join(' ')
        if (combined.length > 12000) {
          stopCapture()
          message.value = rt(en.hq.agents.dictation.limit, {}, { locale: 'en' })
          return
        }
        draftText.value = combined
        draftUncertain.value = recognitionBaseUncertain || draft.uncertain
      },
      onInterrupt(event) {
        const previous = playback
        if (previous) played.add(previous.key)
        playback = null
        if (['voice-unavailable', 'playback-failed'].includes(event.reason)) playbackFailureAgent.value = event.agentId
        if (previous && ['voice-unavailable', 'playback-failed', 'voice-profile-change'].includes(event.reason)) completePlayback(previous)
      },
      onFounderSpeechStart() {
        if (!usable() || record.value?.status !== 'active' || interruptQueued) return
        stopPlayback('founder-speech'); const token = beginInterruption()
        void enqueue({ type: 'interrupt' }, false, token)
      },
    })
    audioState.value = audio.getState()
    refreshVoices(); void probeRecognition()
    document.addEventListener('visibilitychange', visibilityChanged)
    window.addEventListener('online', networkChanged)
    window.addEventListener('offline', networkChanged)
    window.addEventListener('beforeunload', unloading)
    window.speechSynthesis?.addEventListener('voiceschanged', voicesChanged)
    const capturedEpoch = epoch
    void availability(capturedEpoch).then(() => { if (!opened && capturedEpoch === epoch) connection.value = demonstration.value ? 'connected' : mode.value === 'live' ? 'connecting' : 'failed' }).catch(() => { if (capturedEpoch === epoch) { connection.value = 'failed'; failure() } })
  })
  liveEvents.subscribe('agents', () => {
    if (mode.value === 'live' && usable()) return refresh()
  }, reason => {
    if (mode.value !== 'live') return
    invalidate(`live-${reason}`, false)
    connection.value = reason === 'offline' ? 'offline' : 'failed'
    if (reason === 'scope') {
      liveRequests.clear(); liveSubmissions.clear(); uncertainProposals.clear(); requestIds.clear()
      record.value = null; registry.value = []; liveRoster.value = []; reports.value = []; draftText.value = ''; draftUncertain.value = false
      mode.value = 'unavailable'
    }
  })
  if (accessStatus) watch(accessStatus, (status, previous) => {
    if (status === previous) return
    if (previous === 'loading') { if (opened && status === 'founder') void refresh(); return }
    const reopen = opened
    invalidate('access-change')
    liveRequests.clear(); liveSubmissions.clear(); uncertainProposals.clear(); requestIds.clear()
    record.value = null; reports.value = []; registry.value = []; liveRoster.value = []; draftText.value = ''; draftUncertain.value = false; message.value = ''; newMeetingIntent = false
    if (reopen) { connection.value = 'reconnecting'; void refresh() }
  })
  onBeforeUnmount(() => {
    invalidate('disposed'); disposed = true; opened = false
    audio?.close(); audio = null
    recognitionEngine?.dispose(); recognitionEngine = null
    document.removeEventListener('visibilitychange', visibilityChanged)
    window.removeEventListener('online', networkChanged)
    window.removeEventListener('offline', networkChanged)
    window.removeEventListener('beforeunload', unloading)
    window.speechSynthesis?.removeEventListener('voiceschanged', voicesChanged)
  })
  return { meeting, command }
}
