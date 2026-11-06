import wasmModuleUrl from 'onnxruntime-web/ort-wasm-simd-threaded.asyncify.mjs?url'
import wasmBinaryUrl from 'onnxruntime-web/ort-wasm-simd-threaded.asyncify.wasm?url'
import { detectMeetingLanguage, validateMeetingTranscript } from '../controllers/meetingLanguageDetection.mjs'
import { meetingRecognitionModel } from '../controllers/meetingRecognitionModel.mjs'

const MAX_AUDIO_SAMPLES = 15 * 16_000
let transcriber = null
let Tensor = null
let preparing = false
let busy = false
let disposed = false
let epoch = 0
let activeSessionId = null
let activeAudio = null
const cancelledSessions = new Set()

const validToken = value => typeof value === 'string' && /^[A-Za-z0-9_.:-]{1,160}$/.test(value)
const validId = value => validToken(value) || Number.isSafeInteger(value) && value >= 0
const send = value => { if (!disposed) globalThis.postMessage(value) }
const error = (request, code) => send({ type: 'error', id: request?.id, sessionId: request?.sessionId, chunkId: request?.chunkId, code })
function clearAudio(audio) { try { if (audio instanceof Float32Array) audio.fill(0) } catch { /* A detached buffer holds no readable audio. */ } }
function disposeTensors(value) {
  if (!value || typeof value !== 'object') return
  for (const tensor of Object.values(value)) {
    if (typeof tensor?.dispose !== 'function') continue
    try { tensor.dispose() } catch { /* Inference cleanup is best effort after cancellation. */ }
  }
}

async function prepare(request) {
  if (transcriber) { send({ type: 'prepared', id: request.id }); return }
  if (preparing || busy) { error(request, 'recognition-busy'); return }
  const expected = epoch
  preparing = true
  try {
    send({ type: 'state', id: request.id, phase: 'loading' })
    // Downloading weights is reachable only through the explicit prepare message.
    // Model files are fixed ONNX/tokenizer data; no Hub JavaScript is executed.
    const runtime = await import('@huggingface/transformers')
    if (disposed || expected !== epoch) return
    runtime.env.allowLocalModels = false
    runtime.env.allowRemoteModels = true
    runtime.env.useBrowserCache = true
    // Some 4.3.2 metadata helpers omit the caller's revision. This isolated
    // worker loads one reviewed model, so even those requests use its fixed SHA.
    runtime.env.remotePathTemplate = `{model}/resolve/${meetingRecognitionModel.revision}/`
    runtime.env.backends.onnx.wasm.wasmPaths = { mjs: wasmModuleUrl, wasm: wasmBinaryUrl }
    runtime.env.backends.onnx.wasm.numThreads = 1
    runtime.env.backends.onnx.wasm.proxy = false
    Tensor = runtime.Tensor
    const progress_callback = progress => {
      if (disposed || expected !== epoch) return
      const percentage = typeof progress?.progress === 'number' && Number.isFinite(progress.progress)
        ? Math.max(0, Math.min(100, progress.progress)) : undefined
      send({ type: 'state', id: request.id, phase: percentage === undefined ? 'loading' : 'downloading',
        ...(percentage === undefined ? {} : { progress: percentage }) })
    }
    const options = { revision: meetingRecognitionModel.revision, trust_remote_code: false, progress_callback }
    // The pipeline helper performs an unpinned main-branch preflight in 4.3.2.
    // Use pinned component loaders and the explicit, reviewed model class.
    const [processor, tokenizer, model] = await Promise.all([
      runtime.AutoProcessor.from_pretrained(meetingRecognitionModel.id, options),
      runtime.AutoTokenizer.from_pretrained(meetingRecognitionModel.id, options),
      runtime.WhisperForConditionalGeneration.from_pretrained(meetingRecognitionModel.id, {
        ...options, dtype: 'q8', device: 'wasm',
      }),
    ])
    const loaded = { processor, tokenizer, model, dispose: () => model.dispose() }
    if (disposed || expected !== epoch) { await loaded.dispose(); return }
    if (loaded.model?.generation_config?.is_multilingual !== true
      || !loaded.model.generation_config.lang_to_id?.['<|ar|>']
      || !loaded.model.generation_config.lang_to_id?.['<|en|>']) {
      await loaded.dispose()
      throw new Error('invalid-model')
    }
    transcriber = loaded
    send({ type: 'prepared', id: request.id })
  }
  catch { error(request, 'model-load-failed') }
  finally { preparing = false }
}

async function transcribe(request) {
  const audio = request.audio
  if (!validToken(request.sessionId) || !validId(request.chunkId)
    || !(audio instanceof Float32Array) || audio.length < 1 || audio.length > MAX_AUDIO_SAMPLES
    || audio.some(sample => !Number.isFinite(sample))) {
    clearAudio(audio); error(request, 'recognition-input-invalid'); return
  }
  if (!transcriber) { clearAudio(audio); error(request, 'model-not-ready'); return }
  if (preparing || busy) { clearAudio(audio); error(request, 'recognition-busy'); return }
  if (cancelledSessions.has(request.sessionId)) { clearAudio(audio); error(request, 'recognition-cancelled'); return }
  const expected = epoch
  const current = () => !disposed && expected === epoch && !cancelledSessions.has(request.sessionId)
  busy = true
  activeSessionId = request.sessionId
  activeAudio = audio
  let features, decoderInput, detection, generated
  try {
    features = await transcriber.processor(audio)
    // PCM is unnecessary after feature extraction and must not linger during
    // decoding. Neither PCM nor features are written to the model/browser cache.
    clearAudio(audio)
    activeAudio = null
    if (!current()) return
    const config = transcriber.model.generation_config
    if (!Number.isSafeInteger(config.decoder_start_token_id)) throw new Error('recognition-inference-failed')
    decoderInput = new Tensor('int64', BigInt64Array.of(BigInt(config.decoder_start_token_id)), [1, 1])
    detection = await transcriber.model({ ...features, decoder_input_ids: decoderInput })
    if (!current()) return
    const { language } = detectMeetingLanguage(detection.logits, config.lang_to_id)
    disposeTensors(detection); detection = null
    decoderInput.dispose(); decoderInput = null
    // Transformers.js 4.3.2 defaults missing language to English. Explicitly use
    // the language predicted above, independently for every bounded speech chunk.
    generated = await transcriber.model.generate({ ...features, language, task: 'transcribe',
      return_timestamps: false, max_new_tokens: 440 })
    if (!current()) return
    const tokens = generated?.data
    const finalToken = tokens?.length ? Number(tokens[tokens.length - 1]) : null
    const eos = Array.isArray(config.eos_token_id) ? config.eos_token_id : [config.eos_token_id]
    if (!eos.includes(finalToken)) throw new Error('recognition-result-limit')
    const text = validateMeetingTranscript(transcriber.tokenizer.batch_decode(generated, { skip_special_tokens: true })?.[0])
    send({ type: 'result', id: request.id, sessionId: request.sessionId, chunkId: request.chunkId,
      text, language, confidence: null })
  }
  catch (failure) {
    if (!current()) return
    const known = new Set(['recognition-language-unsupported', 'recognition-result-limit', 'recognition-no-speech', 'recognition-repetition'])
    error(request, known.has(failure?.message) ? failure.message : 'recognition-inference-failed')
  }
  finally {
    clearAudio(audio)
    disposeTensors(features)
    disposeTensors(detection)
    try { decoderInput?.dispose(); generated?.dispose() } catch { /* Worker termination also releases these tensors. */ }
    activeAudio = null
    activeSessionId = null
    busy = false
  }
}

globalThis.addEventListener('message', event => {
  const request = event.data
  if (!request || typeof request !== 'object' || Array.isArray(request)) return
  if (request.type === 'dispose') {
    epoch++; disposed = true
    clearAudio(activeAudio); activeAudio = null
    void transcriber?.dispose().catch(() => {})
    transcriber = null
    cancelledSessions.clear()
    globalThis.close()
    return
  }
  if (disposed) return
  if (request.type === 'cancel' && validToken(request.sessionId)) {
    if (cancelledSessions.size >= 512 && !cancelledSessions.has(request.sessionId)) {
      error(request, 'recognition-session-limit')
      disposed = true; clearAudio(activeAudio); globalThis.close(); return
    }
    cancelledSessions.add(request.sessionId)
    if (activeSessionId === request.sessionId) { epoch++; clearAudio(activeAudio); activeAudio = null }
    return
  }
  if (!validId(request.id)) { clearAudio(request.audio); error(request, 'recognition-input-invalid'); return }
  if (request.type === 'prepare') void prepare(request)
  else if (request.type === 'transcribe') void transcribe(request)
  else { clearAudio(request.audio); error(request, 'recognition-input-invalid') }
})
