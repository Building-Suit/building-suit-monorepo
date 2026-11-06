/**
 * Browser audio is optional transport. Recognition produces a reviewable draft,
 * never an authorized meeting command. No MediaRecorder or raw-audio storage is
 * used. The caller must persist exact synthetic voice assignments separately.
 */
export function createMeetingAudio(options = {}) {
  const scope = options.environment ?? globalThis
  const now = options.now ?? (() => scope.performance?.now?.() ?? Date.now())
  const synthesis = scope.speechSynthesis
  const Recognition = scope.SpeechRecognition ?? scope.webkitSpeechRecognition
  const recognitionEngine = options.recognitionEngine
  const Utterance = scope.SpeechSynthesisUtterance
  const media = scope.navigator?.mediaDevices
  const requestFrame = scope.requestAnimationFrame?.bind(scope)
  const cancelFrame = scope.cancelAnimationFrame?.bind(scope)
  let language = normalizeLanguage(options.language ?? 'ar')
  let captureEpoch = 0
  let playbackEpoch = 0
  let closed = false
  let recognition = null
  let recognitionSetup = null
  let stream = null
  let captureTracks = []
  let trackEnded = null
  let context = null
  let source = null
  let analyser = null
  let frame = null
  let vadFrames = 0
  let active = null
  let playing = false
  const queue = []
  const profiles = new Map()
  const invalidated = new Set()
  const state = {
    capture: 'idle', captureActive: false, muted: true,
    recognitionAvailable: Boolean(scope.isSecureContext !== false && (recognitionEngine?.support().available || !recognitionEngine && Recognition) && media?.getUserMedia),
    synthesisAvailable: Boolean(synthesis && Utterance),
    language, recognitionMode: null, speakingAgentId: null, error: null,
  }

  function publish() { options.onState?.({ ...state }) }
  function fail(reason) { state.error = reason; publish(); return false }
  const onVoicesChanged = () => { if (!closed) publish() }
  synthesis?.addEventListener?.('voiceschanged', onVoicesChanged)
  function key(contribution) { return `${contribution.turnId}\u0000${contribution.generationId}` }
  function validId(value) { return typeof value === 'string' && /^[A-Za-z0-9_.:-]{1,160}$/.test(value) }
  function rememberInvalidated(contribution) {
    if (!contribution) return
    invalidated.add(key(contribution))
    // Never evict an invalidated identifier and accidentally admit a late
    // generation. Admission fails closed after this meeting's bounded budget.
  }

  /** Stop output and fence every queued chunk/callback before calling cancel. */
  function interrupt(reason = 'manual') {
    const previous = active
    const startedAt = now()
    rememberInvalidated(previous)
    active = null
    playbackEpoch += 1
    queue.length = 0
    playing = false
    state.speakingAgentId = null
    synthesis?.cancel?.()
    if (previous) options.onInterrupt?.({
      ...previous, reason,
      cancellationCallLatencyMs: Math.max(0, now() - startedAt),
    })
    publish()
    return Boolean(previous)
  }

  function releaseCapture() {
    if (frame !== null) cancelFrame?.(frame)
    frame = null
    vadFrames = 0
    try { source?.disconnect?.() } catch { /* Detached nodes are already closed. */ }
    try { analyser?.disconnect?.() } catch { /* Detached nodes are already closed. */ }
    source = null
    analyser = null
    const closing = context
    context = null
    try { Promise.resolve(closing?.close?.()).catch(() => {}) } catch { /* No audio is retained. */ }
    for (const track of captureTracks) {
      if (trackEnded) track.removeEventListener?.('ended', trackEnded)
      track.stop()
    }
    captureTracks = []
    trackEnded = null
    stream = null
    state.captureActive = false
    state.muted = true
  }

  function stopCapture() {
    captureEpoch += 1
    recognitionSetup?.abort()
    recognitionSetup = null
    const previous = recognition
    recognition = null
    if (previous) {
      previous.onresult = null
      previous.onspeechstart = null
      previous.onstart = null
      previous.onend = null
      previous.onerror = null
      try { previous.abort() } catch { /* Already ended. */ }
    }
    releaseCapture()
    state.capture = 'idle'
    state.recognitionMode = null
    publish()
  }

  /** Manual Stop releases the device now, then admits this session's final draft. */
  function finishCapture() {
    if (closed || state.capture === 'finishing') return false
    if (!recognition || typeof recognition.stop !== 'function') { stopCapture(); return false }
    releaseCapture()
    state.capture = 'finishing'
    publish()
    try { recognition.stop(); return true }
    catch { stopCapture(); return fail('recognition-failed') }
  }

  function founderSpeech(reason) {
    interrupt(reason)
    options.onFounderSpeechStart?.({ reason })
  }

  /** Capability reads never request capture, install packs, or select a service. */
  async function localRecognitionSupport() {
    const selectedLanguage = recognitionEngine ? 'auto' : recognitionLanguage(language)
    const result = (status, error = null) => ({ status, language: selectedLanguage, error })
    if (scope.isSecureContext === false) return result('insecure-context')
    if (recognitionEngine) {
      const support = await recognitionEngine.support()
      return support.prepared ? result('available') : support.available
        ? result('language-downloadable', 'recognition-model-required')
        : result('unsupported-browser', 'recognition-unavailable')
    }
    if (!Recognition) return result('unsupported-browser', 'recognition-unavailable')
    if (!media?.getUserMedia) return result('unsupported-browser', 'microphone-unavailable')
    if (typeof Recognition.available !== 'function') return result('unsupported-browser')
    try {
      const probe = new Recognition()
      if (!('processLocally' in probe)) return result('unsupported-browser')
      const policy = scope.document?.permissionsPolicy ?? scope.document?.featurePolicy
      if (policy?.allowsFeature?.('on-device-speech-recognition') === false) return result('unverified', 'recognition-policy-blocked')
      const availability = await Recognition.available({ langs: [selectedLanguage], processLocally: true })
      // Never install/download a pack or fall back to a network service here.
      const statuses = { available: 'available', unavailable: 'language-unavailable',
        downloadable: 'language-downloadable', downloading: 'language-downloading' }
      return Object.hasOwn(statuses, availability) ? result(statuses[availability]) : result('unverified', 'recognition-probe-failed')
    }
    catch (error) {
      return result('unverified', ['NotAllowedError', 'SecurityError'].includes(error?.name)
        ? 'recognition-policy-blocked' : 'recognition-probe-failed')
    }
  }

  /** Compatibility projection; detailed UI should use localRecognitionSupport. */
  async function localRecognitionAvailability() {
    const support = await localRecognitionSupport()
    return support.status === 'available' ? 'available' : support.status === 'unverified' ? 'unverified' : 'unavailable'
  }

  function startVad(epoch) {
    const AudioContext = scope.AudioContext ?? scope.webkitAudioContext
    if (!AudioContext || !requestFrame || !stream) return
    try {
      context = new AudioContext()
      Promise.resolve(context.resume?.()).catch(() => {})
      source = context.createMediaStreamSource(stream)
      analyser = context.createAnalyser()
      analyser.fftSize = 512
      source.connect(analyser)
      // Do not connect to the destination: microphone audio must not echo.
      const values = new Float32Array(analyser.fftSize)
      const sample = () => {
        if (closed || captureEpoch !== epoch || !analyser || !state.captureActive) return
        analyser.getFloatTimeDomainData(values)
        let power = 0
        for (const value of values) power += value * value
        vadFrames = Math.sqrt(power / values.length) >= 0.035 ? vadFrames + 1 : 0
        if (vadFrames === 2) founderSpeech('voice-activity')
        frame = requestFrame(sample)
      }
      frame = requestFrame(sample)
    }
    catch {
      // Recognition's speech-start event and manual interruption remain usable.
      try { source?.disconnect?.() } catch { /* No output connection exists. */ }
    }
  }

  /** Called only from an explicit UI action after the service disclosure. */
  async function startCapture(consent) {
    if (closed) return false
    if (consent?.userInitiated !== true || consent?.recognitionDisclosureAccepted !== true) return fail('consent-required')
    if (scope.isSecureContext === false) return fail('insecure-context')
    if (!Recognition && !recognitionEngine) return fail('recognition-unavailable')
    if (!media?.getUserMedia) return fail('microphone-unavailable')
    if (!state.recognitionAvailable) return fail('recognition-unavailable')
    if (state.capture === 'requesting' || state.capture === 'finishing' || state.captureActive) return false
    const mode = consent.recognitionMode ?? 'local-only'
    if (mode !== 'local-only' && mode !== 'browser-service' || recognitionEngine && mode !== 'local-only') return fail('recognition-unavailable')
    const expected = ++captureEpoch
    state.capture = 'requesting'
    state.recognitionMode = mode
    state.error = null
    publish()
    let acquired
    try {
      if (mode === 'local-only') {
        const support = await localRecognitionSupport()
        if (closed || expected !== captureEpoch) return false
        if (support.status !== 'available') {
          state.capture = 'failed'
          if (support.error === 'recognition-model-required') return fail('recognition-model-required')
          const reasons = { 'language-downloadable': 'local-recognition-downloadable',
            'language-downloading': 'local-recognition-downloading', unverified: support.error === 'recognition-policy-blocked'
              ? 'local-recognition-policy-blocked' : 'local-recognition-unverified' }
          return fail(Object.hasOwn(reasons, support.status) ? reasons[support.status] : 'local-recognition-unavailable')
        }
      }
      acquired = await media.getUserMedia({ audio: {
        echoCancellation: true, noiseSuppression: true, autoGainControl: true,
        ...(consent.deviceId ? { deviceId: { exact: consent.deviceId } } : {}),
      }, video: false })
      if (closed || expected !== captureEpoch) {
        for (const track of acquired.getTracks()) track.stop()
        return false
      }
      stream = acquired
      captureTracks = acquired.getTracks()
      // Capture ownership moves to releaseCapture; avoid stopping it twice after
      // an aborted asynchronous engine setup.
      acquired = null
      trackEnded = () => {
        if (closed || expected !== captureEpoch) return
        stopCapture()
        state.capture = 'failed'
        fail('microphone-ended')
      }
      for (const track of captureTracks) track.addEventListener?.('ended', trackEnded, { once: true })
      state.captureActive = true
      state.muted = false
      if (recognitionEngine) recognitionSetup = new AbortController()
      const current = recognitionEngine ? await recognitionEngine.createSession(stream, { signal: recognitionSetup.signal }) : new Recognition()
      if (closed || expected !== captureEpoch) { current.abort(); return false }
      recognition = current
      if (mode === 'local-only') current.processLocally = true
      current.lang = recognitionEngine ? 'auto' : recognitionLanguage(language)
      current.continuous = true
      current.interimResults = true
      current.maxAlternatives = 1
      const entries = new Map()
      const valid = () => !closed && expected === captureEpoch && recognition === current
      current.onspeechstart = () => { if (valid() && state.captureActive) founderSpeech('recognition-speech-start') }
      current.onstart = () => { if (valid()) { state.capture = 'listening'; publish() } }
      current.onresult = event => {
        if (!valid()) return
        if (!event.results || event.results.length > 128) { stopCapture(); fail('recognition-limit'); return }
        for (let index = event.resultIndex ?? 0; index < event.results.length; index += 1) {
          const result = event.results[index]
          const alternative = result?.[0]
          if (!alternative || typeof alternative.transcript !== 'string') continue
          if (alternative.transcript.length > 8_000) { stopCapture(); fail('recognition-limit'); return }
          entries.set(index, { text: alternative.transcript, final: result.isFinal === true,
            language: recognitionEngine && ['ar', 'en'].includes(alternative.language) ? alternative.language : language,
            confidence: typeof alternative.confidence === 'number' && Number.isFinite(alternative.confidence)
              ? Math.max(0, Math.min(1, alternative.confidence)) : null })
        }
        // Engines can replace or shorten interim results.
        for (const index of entries.keys()) if (index >= event.results.length) entries.delete(index)
        const ordered = [...entries].sort(([a], [b]) => a - b).map(([, entry]) => entry)
        const text = ordered.map(entry => entry.text).join(' ').trim()
        if (text.length > 8_000) { stopCapture(); fail('recognition-limit'); return }
        const confidence = ordered.length && ordered.every(entry => entry.confidence !== null)
          ? Math.min(...ordered.map(entry => entry.confidence)) : null
        options.onDraft?.({ text, final: ordered.length > 0 && ordered.every(entry => entry.final),
          uncertain: confidence === null || confidence < 0.86, confidence, language: ordered.at(-1)?.language ?? language })
      }
      current.onerror = event => {
        if (!valid()) return
        const reasons = { 'not-allowed': 'microphone-denied', 'service-not-allowed': 'recognition-service-denied',
          'audio-capture': 'microphone-device-unavailable', 'language-not-supported': 'recognition-language-unavailable',
          'no-speech': 'recognition-no-speech', network: 'recognition-network',
          'recognition-no-speech': 'recognition-no-speech', 'recognition-busy': 'recognition-busy',
          'model-not-ready': 'recognition-model-required', 'recognition-language-unsupported': 'recognition-language-unavailable',
          'recognition-result-limit': 'recognition-limit', 'recognition-input-invalid': 'recognition-limit' }
        stopCapture()
        state.capture = 'failed'
        fail(Object.hasOwn(reasons, event.error) ? reasons[event.error] : 'recognition-failed')
      }
      current.onend = () => { if (valid()) stopCapture() }
      if (!recognitionEngine) startVad(expected)
      current.start()
      publish()
      return true
    }
    catch (error) {
      if (closed || expected !== captureEpoch) {
        for (const track of acquired?.getTracks?.() ?? []) track.stop()
        return false
      }
      stopCapture()
      state.capture = 'failed'
      const engineReason = recognitionEngine && ['recognition-model-required', 'recognition-busy', 'recognition-unavailable'].includes(error?.message) ? error.message : null
      return fail(engineReason ?? (error?.name === 'NotAllowedError' ? 'microphone-denied' : recognitionEngine ? 'recognition-failed' : 'microphone-unavailable'))
    }
  }

  function voiceOptions(requestedLanguage = language) {
    const requested = normalizeLanguage(requestedLanguage).split('-')[0]
    return (synthesis?.getVoices?.() ?? []).filter(voice => voice.localService === true
      && voice.lang?.toLowerCase().split('-')[0] === requested)
      .map(voice => ({ voiceURI: voice.voiceURI, name: voice.name, language: voice.lang, local: true }))
  }

  function resolveVoice(agentId) {
    const profile = profiles.get(agentId)
    if (!profile || profile.availability === 'unavailable'
      || !profile.supportedLanguages.some(item => item.toLowerCase().split('-')[0] === language.split('-')[0])) return null
    const voice = (synthesis?.getVoices?.() ?? []).find(item => item.voiceURI === profile.voiceURI
      && item.localService === true && item.lang?.toLowerCase().split('-')[0] === language.split('-')[0])
    return voice ? { voice, profile } : null
  }

  function setProfiles(input) {
    interrupt('voice-profile-change')
    profiles.clear()
    for (const profile of input ?? []) {
      if (!validId(profile.agentId) || typeof profile.voiceURI !== 'string' || profile.voiceURI.length > 512
        || !Array.isArray(profile.supportedLanguages) || !profile.supportedLanguages.length
        || !profile.supportedLanguages.every(item => typeof item === 'string' && /^(ar|en)(?:-[A-Za-z]{2,8})?$/i.test(item))
        || profile.fallbackPolicy !== 'none') continue
      profiles.set(profile.agentId, { ...profile, supportedLanguages: [...profile.supportedLanguages],
        rate: Math.max(0.5, Math.min(2, Number.isFinite(profile.rate) ? profile.rate : 1)),
        pitch: Math.max(0, Math.min(2, Number.isFinite(profile.pitch) ? profile.pitch : 1)) })
    }
    publish()
  }

  function beginContribution(contribution) {
    if (closed || invalidated.size >= 512 || !validId(contribution?.turnId) || !validId(contribution?.generationId) || !validId(contribution?.agentId)
      || invalidated.has(key(contribution))) return false
    if (active && key(active) === key(contribution)) return active.agentId === contribution.agentId
    interrupt('superseded')
    active = { turnId: contribution.turnId, generationId: contribution.generationId, agentId: contribution.agentId }
    return true
  }

  function pump() {
    if (closed || playing || !active || !queue.length) return
    const assignment = resolveVoice(active.agentId)
    if (!assignment || !state.synthesisAvailable) { interrupt('voice-unavailable'); fail('voice-unavailable'); return }
    const epoch = playbackEpoch
    const contribution = { ...active }
    const item = queue.shift()
    const utterance = new Utterance(item.text)
    utterance.voice = assignment.voice
    utterance.lang = assignment.voice.lang
    utterance.rate = assignment.profile.rate
    utterance.pitch = assignment.profile.pitch
    playing = true
    const valid = () => !closed && epoch === playbackEpoch && active && key(active) === key(contribution)
    utterance.onstart = () => { if (valid()) { state.speakingAgentId = contribution.agentId; publish() } }
    utterance.onend = () => {
      if (!valid()) return
      playing = false
      state.speakingAgentId = null
      publish()
      pump()
    }
    utterance.onerror = () => { if (valid()) { interrupt('playback-failed'); fail('playback-failed') } }
    try { synthesis.speak(utterance) }
    catch { if (valid()) { interrupt('playback-failed'); fail('playback-failed') } }
  }

  function speakChunk(chunk) {
    if (closed || !active || !chunk || key(active) !== key(chunk) || active.agentId !== chunk.agentId
      || typeof chunk.text !== 'string' || !chunk.text.trim() || chunk.text.length > 4_000 || queue.length >= 32) return false
    if (!resolveVoice(chunk.agentId) || !state.synthesisAvailable) return fail('voice-unavailable')
    queue.push({ text: chunk.text })
    pump()
    return true
  }

  function setLanguage(value) {
    const next = normalizeLanguage(value)
    if (next === language) return
    stopCapture()
    interrupt('language-change')
    language = next
    state.language = next
    state.error = null
    publish()
  }

  function close() {
    if (closed) return
    stopCapture()
    interrupt('closed')
    closed = true
    synthesis?.removeEventListener?.('voiceschanged', onVoicesChanged)
    profiles.clear()
    state.capture = 'idle'
    publish()
  }

  publish()
  if (options.profiles) setProfiles(options.profiles)
  return {
    getState: () => ({ ...state }), startCapture, stopCapture, finishCapture, interrupt, beginContribution, speakChunk,
    setLanguage, setProfiles, voiceOptions, listVoices: voiceOptions, localRecognitionAvailability, localRecognitionSupport,
    voiceAvailable: agentId => Boolean(resolveVoice(agentId) && state.synthesisAvailable),
    setMuted: value => { if (value) stopCapture(); return state.muted },
    close,
  }
}

function normalizeLanguage(value) {
  if (typeof value !== 'string' || !/^(ar|en)(?:-[A-Za-z]{2,8})?$/i.test(value)) throw new TypeError('Unsupported meeting language')
  const [base, region] = value.split('-')
  return `${base.toLowerCase()}${region ? `-${region.toUpperCase()}` : ''}`
}

// Recognition uses the app's configured BCP 47 locales; voice matching still
// uses the selected language and never swaps to another recognition language.
function recognitionLanguage(value) { return value === 'ar' ? 'ar-EG' : value === 'en' ? 'en-US' : value }
