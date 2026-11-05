import { computed, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue'
import { createMeetingAudio } from '@building-suit/ux/meetingAudio'
import type { MeetingAudioController, MeetingAudioState, MeetingVoiceProfile } from '@building-suit/ux/meetingAudio'
import type { HqMeetingCommand, HqMeetingConnection, HqMeetingCopy, HqMeetingLanguage, HqMeetingPresentation, HqMeetingTaskState } from '@building-suit/ui/types/hqMeetingPresentation'
import type { MeetingRecord } from '../../shared/meetings/domain.mjs'
import type { MeetingRegistryParticipant } from '../../shared/meetings/registry.mjs'
import ar from '../../i18n/locales/ar.json'
import en from '../../i18n/locales/en.json'

type TransportCommand = HqMeetingCommand | { type: 'reconnect' } | { type: 'playback-ended'; turnId: string; generation: number }
interface Snapshot {
  mode: 'demonstration'
  registry: MeetingRegistryParticipant[]
  record: MeetingRecord | null
  reports: { taskId: string; readyForFounder: boolean; synthetic: true; result: { deliverable?: string } | null }[]
}
interface Playback { turnId: string; generation: number; agentId: string; key: string }
const headers = { 'X-HQ-Access': '1', 'X-HQ-Brain': '1' }
const voiceStorageKey = 'building-suit:hq:meeting:local-voices:v1'
const defaultParticipants = new Set(['AG-CEO-001', 'AG-HR-001', 'AG-HR-002', 'AG-RES-001'])

/** Per-tab orchestration. Only the explicitly enabled synthetic API is available. */
export function useHqMeeting(accessStatus?: () => string) {
  const { rt } = useI18n()
  const language = ref<HqMeetingLanguage>('ar')
  const record = shallowRef<MeetingRecord | null>(null)
  const registry = shallowRef<MeetingRegistryParticipant[]>([])
  const reports = shallowRef<Snapshot['reports']>([])
  const demonstration = ref(false)
  const connection = ref<HqMeetingConnection>('connecting')
  const pending = ref(false)
  const message = ref('')
  const draftText = ref('')
  const draftUncertain = ref(false)
  const playbackMuted = ref(false)
  const localRecognition = ref(false)
  const audioState = shallowRef<MeetingAudioState | null>(null)
  const voices = shallowRef<{ voiceURI: string; name: string; language: string; local: true }[]>([])
  const voiceAssignments = ref<Record<string, string>>({})
  // Resolve Nuxt's compiled message AST through rt. Both finite dictionaries
  // are present even when the scene's lazy locale has not loaded this language.
  const copy = computed<HqMeetingCopy>(() => Object.fromEntries(Object.entries((language.value === 'ar' ? ar : en).hq.meeting).map(([group, values]) => [group, Object.fromEntries(Object.entries(values).map(([key, value]) => [key, rt(value, {}, { locale: language.value })]))])) as unknown as HqMeetingCopy)
  let audio: MeetingAudioController | null = null
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
  const requests = new Set<AbortController>()
  const requestIds = new Map<string, string>()
  const played = new Set<string>()
  const completed = new Set<string>()

  function voiceKey(agentId: string) { return `${language.value}:${agentId}` }
  function founderName() { return copy.value.labels.founder }
  function nameFor(id: string) { return id === record.value?.founderId ? founderName() : record.value?.participants.find(item => item.id === id)?.name ?? registry.value.find(item => item.id === id)?.name ?? id }
  function failure() { message.value = copy.value.labels.unavailable }
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
    if (value?.mode !== 'demonstration' || !Array.isArray(value.registry) || value.registry.length > 32) return false
    const item = value.record
    return !item || (item.mode === 'demonstration' && typeof item.id === 'string' && Number.isSafeInteger(item.revision) && ['ar', 'en'].includes(item.language) && Array.isArray(item.events) && item.events.length <= 5000 && Array.isArray(item.participants) && item.participants.length <= 32 && Array.isArray(item.tasks) && item.tasks.length <= 100 && Array.isArray(item.plans) && item.plans.length <= 50)
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

  async function probeRecognition() {
    const capturedEpoch = epoch, selectedLanguage = language.value
    localRecognition.value = false
    const availability = await audio?.localRecognitionAvailability().catch(() => 'unavailable')
    if (!disposed && capturedEpoch === epoch && selectedLanguage === language.value) localRecognition.value = availability === 'available'
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
    playback = item
    if (!audio.speakChunk({ ...identity, text })) { playback = null; completePlayback(item) }
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
      if (playback && (!turn || turn.id !== playback.turnId || turn.generation !== playback.generation || turn.status !== 'speaking' || record.value.status !== 'active')) stopPlayback('superseded')
      if (record.value.status === 'ended') stopCapture()
    }
    refreshVoices()
    admitPlayback()
  }

  async function availability(capturedEpoch = epoch) {
    const value = await json<{ demonstration: boolean; live: false; blockers: string[] }>('/api/hq/meetings/availability', undefined, capturedEpoch)
    demonstration.value = value.demonstration === true && value.live === false
    if (!demonstration.value) { record.value = null; registry.value = []; message.value = copy.value.labels.unavailable }
    return demonstration.value
  }

  async function refresh() {
    if (refreshPromise) { refreshAgain = true; return refreshPromise }
    const capturedEpoch = epoch
    const capturedSelection = meetingSelection
    refreshPromise = (async () => {
      try {
        if (!online()) { connection.value = 'offline'; return }
        if (!await availability(capturedEpoch) || !opened || capturedEpoch !== epoch) { if (!demonstration.value) connection.value = 'failed'; return }
        const id = record.value?.id
        const value = await json<Snapshot>(`/api/hq/meetings/demo${id ? `?id=${encodeURIComponent(id)}` : ''}`, undefined, capturedEpoch)
        if (capturedSelection !== meetingSelection) return
        applySnapshot(value)
        connection.value = 'connected'
        message.value = ''
        reconnectRecord()
        if (!transport) void connectEvents()
      }
      catch {
        if (capturedEpoch === epoch && !disposed) { connection.value = online() ? 'failed' : 'offline'; failure() }
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
    const targetId = command.type === 'start' ? undefined : record.value?.id
    const operation = mutationQueue.then(async () => {
      if (capturedEpoch !== epoch || !usable() || !demonstration.value || (command.type !== 'start' && (!targetId || record.value?.id !== targetId))) return false
      pending.value = true
      const key = JSON.stringify({ meetingId: targetId, command })
      let requestId = requestIds.get(key)
      if (!requestId) { requestId = crypto.randomUUID(); requestIds.set(key, requestId) }
      try {
        const value = await json<Snapshot>('/api/hq/meetings/demo', { requestId, ...(targetId ? { meetingId: targetId } : {}), command }, capturedEpoch)
        if (command.type === 'start') { newMeetingIntent = false; meetingSelection++ }
        if (command.type === 'interrupt' && interruptionToken === interruptionIntent) interruptQueued = false
        applySnapshot(value)
        connection.value = 'connected'
        message.value = ''
        requestIds.delete(key)
        if (command.type === 'text' && draftText.value.trim() === command.text) { draftText.value = ''; draftUncertain.value = false }
        return true
      }
      catch (error) {
        if (capturedEpoch === epoch && !disposed) {
          if (!automatic) failure()
          // A confirmed conflict is safe to retry only as a fresh user action.
          if (error instanceof Error && /^meeting-http-4\d\d$/.test(error.message)) requestIds.delete(key)
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
      if (capturedEpoch === epoch && usable()) {
        connection.value = 'reconnecting'
        const delay = Math.min(30000, 500 * 2 ** Math.min(retryAttempt++, 6))
        retryTimer = setTimeout(() => { retryTimer = undefined; void connectEvents() }, delay)
      }
    }
  }

  function bestEffortDisconnect() {
    const id = record.value?.id
    if (!id || record.value?.status !== 'active' || !demonstration.value) return
    void fetch('/api/hq/meetings/demo', { method: 'POST', credentials: 'same-origin', cache: 'no-store', keepalive: true, headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify({ requestId: crypto.randomUUID(), meetingId: id, command: { type: 'close' } }) }).catch(() => undefined)
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
      if (audioState.value?.captureActive) stopCapture()
      draftText.value = value.text.slice(0, 12000); draftUncertain.value = false; recognitionBase = draftText.value
      return
    }
    if (value.type === 'refresh') {
      if (!opened) { opened = true; connection.value = online() ? 'connecting' : 'offline'; void probeRecognition() }
      await refresh(); reconnectRecord(); return
    }
    if (value.type === 'close') { invalidate('closed'); opened = false; connection.value = 'offline'; return }
    if (value.type === 'newMeeting') {
      if (record.value?.status !== 'ended' || pending.value) return
      stopCapture(); stopPlayback('new-meeting')
      meetingSelection++
      record.value = null; reports.value = []; draftText.value = ''; draftUncertain.value = false; newMeetingIntent = true
      return
    }
    if (value.type === 'voice') {
      if (!voices.value.some(item => item.voiceURI === value.voiceId) || !registry.value.some(item => item.id === value.agentId)) return
      const key = voiceKey(value.agentId)
      if (Object.entries(voiceAssignments.value).some(([other, uri]) => other !== key && other.startsWith(`${language.value}:`) && uri === value.voiceId)) { message.value = copy.value.labels.voiceUnavailable; return }
      stopPlayback('voice-change')
      voiceAssignments.value = { ...voiceAssignments.value, [key]: value.voiceId }
      try { localStorage.setItem(voiceStorageKey, JSON.stringify(voiceAssignments.value)) }
      catch { /* Voice preference persistence is optional. */ }
      refreshVoices(); message.value = ''; return
    }
    if (value.type === 'microphone') {
      if (!value.active) { stopCapture(); return }
      if (!usable() || pending.value || record.value?.status !== 'active' || !value.disclosureAccepted || !localRecognition.value || !audio) return
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
    if (!usable() || !demonstration.value || pending.value) return
    let textIntent: number | undefined
    if (value.type === 'text') { stopCapture(); stopPlayback('founder-text'); textIntent = beginInterruption() }
    if (value.type === 'end') { stopCapture(); stopPlayback('meeting-ended') }
    const success = await enqueue(value)
    if (value.type === 'text' && textIntent === interruptionIntent) { interruptQueued = false; if (success) admitPlayback() }
  }

  const meeting = computed<HqMeetingPresentation>(() => {
    const current = record.value
    const people = current?.participants ?? registry.value
    const latestPlan = current?.plans.at(-1)
    const activeAudio = audioState.value
    const status = activeAudio?.captureActive ? copy.value.labels.microphoneOn : !localRecognition.value ? copy.value.labels.microphoneUnavailable : copy.value.labels.microphoneOff
    return {
      phase: !demonstration.value ? 'unavailable' : current?.status === 'ended' ? 'ended' : current ? 'active' : 'setup',
      mode: demonstration.value ? 'demonstration' : 'unavailable', connection: connection.value,
      language: language.value, title: current?.title ?? '', pending: pending.value,
      canStart: demonstration.value && connection.value === 'connected' && !current,
      founder: { id: current?.founderId ?? 'synthetic-founder', name: founderName() },
      participants: people.map(person => {
        const participant = current?.participants.find(item => item.id === person.id)
        const status = activeAudio?.speakingAgentId === person.id ? 'speaking' : participant?.status === 'speaking' ? 'listening' : participant?.status ?? 'listening'
        const source = registry.value.find(item => item.id === person.id)
        return { id: person.id, name: person.name, role: person.role, ...(participant?.avatar ? { avatarUrl: participant.avatar } : {}), status, eligible: demonstration.value, workEligible: Boolean(participant?.supervisorId), selected: defaultParticipants.has(person.id), availability: source ? `${source.lifecycle} · ${source.operation}` : undefined, voiceId: voiceAssignments.value[voiceKey(person.id)] }
      }),
      floor: current?.floor.kind === 'founder' ? current.founderId : current?.floor.kind === 'agent' ? current.floor.agentId : null,
      microphone: { available: localRecognition.value, active: activeAudio?.captureActive ?? false, muted: playbackMuted.value, status },
      voiceAvailable: people.some(person => audio?.voiceAvailable(person.id)),
      voices: voices.value.map(item => ({ id: item.voiceURI, name: item.name, language: item.language })),
      draftText: draftText.value,
      draftUncertain: draftUncertain.value,
      transcript: (current?.events ?? []).filter(event => ['founder-utterance', 'agent-contribution', 'execution-report-ready'].includes(event.type)).map(event => ({ id: event.id, speakerName: nameFor(String(event.data.agentId ?? event.actorId)), text: String(event.data.text ?? event.data.summary ?? ''), kind: event.category, uncertain: event.data.uncertain === true })),
      chat: (current?.events ?? []).filter(event => ['link-shared', 'chat-message'].includes(event.type)).map(event => ({ id: event.id, speakerName: nameFor(String(event.data.speakerId ?? event.actorId)), text: String(event.data.text ?? event.data.url ?? ''), ...(typeof event.data.url === 'string' ? { links: [event.data.url] } : {}) })),
      tasks: (current?.tasks ?? []).map(task => {
        const report = reports.value.find(item => item.taskId === task.id)
        const status: HqMeetingTaskState = task.status === 'completed' && task.kind === 'execution' ? report?.readyForFounder || task.reviewStatus === 'accepted' ? 'reviewed' : 'review-required' : task.status
        return { id: task.id, ownerName: nameFor(task.agentId), title: task.question, status, ...(task.result ? { result: task.result } : {}), ...(task.error ? { error: task.error } : {}) }
      }),
      plan: latestPlan ? { version: latestPlan.version, digest: latestPlan.hash, title: latestPlan.title, summary: latestPlan.summary, state: latestPlan.status, tasks: latestPlan.tasks.map(task => ({ id: task.id, objective: task.objective, ownerName: nameFor(task.owner), deliverable: task.deliverable, budget: String(task.budget), blockers: task.blockers, scope: [task.scope ?? '', ...task.allowedActions, ...(task.allowedTools ?? [])].filter(Boolean), acceptance: task.acceptanceCriteria, review: task.requiredReview.map(nameFor).join(' → '), supervisorName: nameFor(task.supervisor), inputs: task.inputs, dependencies: task.dependencies, priority: task.priority, environment: task.executionEnvironment })), ...(latestPlan.approval ? { approvalTiming: copy.value.labels[latestPlan.approval.start === 'now' ? 'approveNow' : latestPlan.approval.start === 'meeting-end' ? 'approveOnEnd' : 'approve'] } : {}) } : null,
      ...(message.value ? { message: message.value } : {}), copy: copy.value,
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
    audio = createMeetingAudio({
      language: language.value,
      onState(state) {
        const previous = audioState.value?.speakingAgentId
        audioState.value = state
        if (playback && previous === playback.agentId && !state.speakingAgentId) { const item = playback; playback = null; completePlayback(item) }
      },
      onDraft(draft) {
        if (!usable() || record.value?.status !== 'active') return
        draftText.value = [recognitionBase, draft.text].filter(Boolean).join(' ').slice(0, 12000)
        draftUncertain.value = recognitionBaseUncertain || draft.uncertain
      },
      onInterrupt(event) {
        const previous = playback
        if (previous) played.add(previous.key)
        playback = null
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
    void availability(capturedEpoch).then(() => { if (!opened && capturedEpoch === epoch) connection.value = demonstration.value ? 'connected' : 'failed' }).catch(() => { if (capturedEpoch === epoch) { connection.value = 'failed'; failure() } })
  })
  if (accessStatus) watch(accessStatus, (status, previous) => {
    if (status === previous || previous === 'loading') return
    const reopen = opened
    invalidate('access-change')
    record.value = null; reports.value = []; registry.value = []; draftText.value = ''; draftUncertain.value = false; message.value = ''; newMeetingIntent = false
    if (reopen) { connection.value = 'reconnecting'; void refresh() }
  })
  onBeforeUnmount(() => {
    invalidate('disposed'); disposed = true; opened = false
    audio?.close(); audio = null
    document.removeEventListener('visibilitychange', visibilityChanged)
    window.removeEventListener('online', networkChanged)
    window.removeEventListener('offline', networkChanged)
    window.removeEventListener('beforeunload', unloading)
    window.speechSynthesis?.removeEventListener('voiceschanged', voicesChanged)
  })
  return { meeting, command }
}
