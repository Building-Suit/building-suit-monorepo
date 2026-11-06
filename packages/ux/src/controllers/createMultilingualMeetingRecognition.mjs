import { meetingRecognitionModel as model } from './meetingRecognitionModel.mjs'
const workerErrors = new Set(['model-not-ready', 'model-load-failed', 'recognition-busy', 'recognition-input-invalid',
  'recognition-language-unsupported', 'recognition-repetition', 'recognition-no-speech', 'recognition-session-limit', 'recognition-inference-failed', 'recognition-result-limit', 'recognition-cancelled', 'recognition-disposed'])

/** Local automatic Arabic/English transcription. Download and capture are separate explicit actions. */
export function createMultilingualMeetingRecognition(options = {}) {
  const scope = options.environment ?? globalThis
  const makeWorker = options.createWorker ?? (() => new Worker(new URL('../workers/meetingRecognition.worker.mjs', import.meta.url), { type: 'module' }))
  const workletUrl = options.workletUrl ?? new URL('../worklets/meetingCapture.worklet.mjs', import.meta.url)
  const state = { phase: 'idle', progress: null, prepared: false, processing: false, error: null }
  let worker = null, disposed = false, sequence = 0, pendingPrepare = null, pendingJob = null, queuedJob = null, activeSession = null
  const publish = () => options.onState?.({ ...state })
  const failure = code => { state.error = code; state.phase = 'failed'; publish(); return false }
  const finiteError = value => workerErrors.has(value) ? value : 'recognition-inference-failed'

  function support() {
    const secure = scope.isSecureContext !== false
    const available = Boolean(!disposed && secure && scope.navigator?.mediaDevices?.getUserMedia
      && (scope.AudioContext ?? scope.webkitAudioContext) && scope.AudioWorkletNode && (options.createWorker || scope.Worker))
    return { status: !secure ? 'insecure-context' : !available ? 'unsupported-browser' : state.prepared ? 'ready' : 'model-required',
      available, prepared: state.prepared, language: 'auto', languages: ['ar', 'en'],
      error: disposed ? 'recognition-disposed' : !secure ? 'insecure-context' : !available ? 'recognition-unavailable' : state.error,
      model }
  }

  function terminateWorker() {
    worker?.terminate()
    worker = null
    if (pendingPrepare) { clearTimeout(pendingPrepare.timer); pendingPrepare.resolve(false); pendingPrepare = null }
    if (pendingJob) { clearTimeout(pendingJob.timer); pendingJob = null }
    if (queuedJob) { queuedJob.audio.fill(0); queuedJob = null }
    state.prepared = false; state.processing = false; state.phase = 'idle'; state.progress = null
  }

  function receive(event) {
    const data = event.data
    if (disposed || !data || typeof data !== 'object') return
    if (data.type === 'state' && pendingPrepare) {
      state.phase = data.phase === 'loading' ? 'loading' : 'downloading'
      state.progress = typeof data.progress === 'number' && Number.isFinite(data.progress) ? Math.max(0, Math.min(100, data.progress)) : null
      publish(); return
    }
    if (data.type === 'prepared' && pendingPrepare?.id === data.id) {
      const pending = pendingPrepare; pendingPrepare = null; clearTimeout(pending.timer)
      state.prepared = true; state.phase = 'ready'; state.progress = 100; state.error = null
      publish(); pending.resolve(true); return
    }
    if (data.type === 'error' && pendingPrepare?.id === data.id) {
      const pending = pendingPrepare; pendingPrepare = null; clearTimeout(pending.timer)
      terminateWorker(); failure(finiteError(data.code)); pending.resolve(false); return
    }
    if (!['result', 'error'].includes(data.type) || !pendingJob || pendingJob.id !== data.id
      || pendingJob.sessionId !== data.sessionId || pendingJob.chunkId !== data.chunkId) return
    const pending = pendingJob; pendingJob = null; clearTimeout(pending.timer)
    if (data.type === 'result') pending.deliver(data)
    else pending.reject(finiteError(data.code))
    if (queuedJob && worker && !disposed) { const queued = queuedJob; queuedJob = null; startJob(queued) }
    state.processing = Boolean(pendingJob || queuedJob); publish()
    pending.complete()
  }

  function startJob(job) {
    if (!worker || disposed || !state.prepared) { job.audio.fill(0); job.reject('model-not-ready'); return }
    const requestId = `chunk:${++sequence}`
    const timer = setTimeout(() => job.reject('recognition-inference-failed'), 90_000)
    pendingJob = { ...job, id: requestId, timer }
    state.processing = true; publish()
    try {
      worker.postMessage({ type: 'transcribe', id: requestId, sessionId: job.sessionId, chunkId: job.chunkId, audio: job.audio }, [job.audio.buffer])
    }
    catch { job.reject('recognition-inference-failed') }
  }

  function prepare(consent) {
    if (disposed) return Promise.resolve(false)
    if (consent?.userInitiated !== true || consent?.modelDownloadConsent !== true) return Promise.resolve(failure('model-consent-required'))
    if (!support().available) return Promise.resolve(failure(support().error ?? 'recognition-unavailable'))
    if (state.prepared) return Promise.resolve(true)
    if (pendingPrepare) return pendingPrepare.promise
    try {
      worker = makeWorker()
      worker.onmessage = receive
      worker.onerror = () => {
        const reject = pendingJob?.reject, current = activeSession
        terminateWorker(); failure('model-load-failed')
        if (reject) reject('recognition-inference-failed')
        else if (current) { current.onerror?.({ error: 'recognition-inference-failed' }); current.abort() }
      }
      const id = `prepare:${++sequence}`
      let resolve
      const promise = new Promise(done => { resolve = done })
      const timer = setTimeout(() => { terminateWorker(); failure('model-load-failed') }, 180_000)
      pendingPrepare = { id, promise, resolve, timer }
      state.error = null; state.phase = 'downloading'; state.progress = null; publish()
      worker.postMessage({ type: 'prepare', id })
      return promise
    }
    catch { terminateWorker(); return Promise.resolve(failure('model-load-failed')) }
  }

  async function createSession(stream, sessionOptions = {}) {
    if (disposed || !state.prepared || !worker) throw new Error('recognition-model-required')
    if (activeSession) throw new Error('recognition-busy')
    const id = `session:${++sequence}`
    const signal = sessionOptions.signal
    const AudioContext = scope.AudioContext ?? scope.webkitAudioContext
    let context = null, source = null, node = null, started = false, stopped = false, chunkSequence = 0
    let setupTimer = null, rejectSetup = null, finishTimer = null, finishing = false, captureFinished = false
    const results = []
    const session = { lang: 'auto', processLocally: true, continuous: true, interimResults: false, maxAlternatives: 1,
      onstart: null, onresult: null, onerror: null, onspeechstart: null, onend: null,
      start() {
        if (stopped || started || !node) throw new Error('recognition-disposed')
        started = true; node.port.postMessage({ type: 'start' }); session.onstart?.()
      },
      abort() {
        if (stopped) return
        stopped = true
        rejectSetup?.(new Error('recognition-disposed'))
        if (setupTimer !== null) clearTimeout(setupTimer)
        if (finishTimer !== null) clearTimeout(finishTimer)
        signal?.removeEventListener('abort', onAbort)
        if (activeSession === session) activeSession = null
        node?.port.postMessage({ type: 'stop' })
        closeGraph(); results.length = 0
        if (queuedJob?.sessionId === id) { queuedJob.audio.fill(0); queuedJob = null }
        if (pendingJob?.sessionId === id) {
          // Termination also releases in-flight WASM/model memory and transferred PCM.
          terminateWorker(); publish()
        }
        else worker?.postMessage({ type: 'cancel', sessionId: id })
        state.processing = Boolean(pendingJob || queuedJob); publish()
      },
      stop() {
        if (stopped || finishing) return
        finishing = true
        finishTimer = setTimeout(() => reject('recognition-inference-failed'), 3_000)
        if (node) node.port.postMessage({ type: 'finish' })
        else { captureFinished = true; complete() }
      },
    }
    const onAbort = () => session.abort()
    activeSession = session
    signal?.addEventListener('abort', onAbort, { once: true })
    if (signal?.aborted) { session.abort(); throw new Error('recognition-disposed') }
    const reject = code => {
      if (stopped) return
      session.onerror?.({ error: code })
      session.abort()
    }
    function closeGraph() {
      if (node) { node.port.onmessage = null; node.port.close?.() }
      try { source?.disconnect() } catch { /* Already disconnected. */ }
      try { node?.disconnect() } catch { /* Already disconnected. */ }
      Promise.resolve(context?.close()).catch(() => {})
      source = null; node = null; context = null
    }
    function complete() {
      if (stopped || !finishing || !captureFinished || pendingJob?.sessionId === id || queuedJob?.sessionId === id) return
      stopped = true
      if (finishTimer !== null) clearTimeout(finishTimer)
      signal?.removeEventListener('abort', onAbort)
      if (activeSession === session) activeSession = null
      closeGraph()
      worker?.postMessage({ type: 'cancel', sessionId: id })
      session.onend?.()
      results.length = 0
    }
    const deliver = data => {
      if (stopped || !started) return
      if (typeof data.text !== 'string' || !data.text.trim() || data.text.length > 4_000 || !['ar', 'en'].includes(data.language) || results.length >= 128) { reject('recognition-result-limit'); return }
      const item = [{ transcript: data.text, confidence: undefined, language: data.language }]
      item.isFinal = true
      results.push(item)
      session.onresult?.({ resultIndex: results.length - 1, results: [...results] })
    }
    function chunk(audio) {
      if (stopped || !started) { audio?.fill?.(0); return }
      if (!(audio instanceof Float32Array) || !audio.length || audio.length > 15 * 16_000) { audio?.fill?.(0); reject('recognition-input-invalid'); return }
      const job = { audio, sessionId: id, chunkId: ++chunkSequence, deliver, reject, complete }
      if (pendingJob) {
        if (queuedJob) { audio.fill(0); reject('recognition-busy'); return }
        queuedJob = job; state.processing = true; publish(); return
      }
      startJob(job)
    }
    try {
      context = new AudioContext({ sampleRate: 16_000 })
      if (context.sampleRate !== 16_000 || !context.audioWorklet) throw new Error('recognition-unavailable')
      const aborted = new Promise((_, reject) => { rejectSetup = reject })
      const deadline = new Promise((_, reject) => { setupTimer = setTimeout(() => { session.abort(); reject(new Error('recognition-start-timeout')) }, 10_000) })
      await Promise.race([context.audioWorklet.addModule(workletUrl), aborted, deadline])
      if (stopped || disposed) throw new Error('recognition-disposed')
      await Promise.race([context.resume(), aborted, deadline])
      if (stopped || disposed) throw new Error('recognition-disposed')
      node = new scope.AudioWorkletNode(context, 'meeting-capture', { numberOfInputs: 1, numberOfOutputs: 1, outputChannelCount: [1] })
      node.port.onmessage = event => {
        if (stopped || !started) return
        if (event.data?.type === 'speech-start') session.onspeechstart?.()
        else if (event.data?.type === 'chunk') chunk(event.data.audio)
        else if (event.data?.type === 'finished' && finishing) {
          captureFinished = true
          if (finishTimer !== null) clearTimeout(finishTimer)
          closeGraph(); complete()
        }
      }
      source = context.createMediaStreamSource(stream)
      source.connect(node)
      // The worklet writes only zeros to its output, so captured audio never echoes.
      node.connect(context.destination)
      return session
    }
    catch (error) { session.abort(); throw error }
    finally { if (setupTimer !== null) clearTimeout(setupTimer); rejectSetup = null }
  }

  function dispose() {
    if (disposed) return
    activeSession?.abort(); disposed = true
    terminateWorker(); publish()
  }
  publish()
  return { getState: () => ({ ...state }), support, prepare, createSession, dispose }
}
