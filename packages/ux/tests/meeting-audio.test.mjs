import test from 'node:test'
import assert from 'node:assert/strict'
import { createMeetingAudio } from '../src/controllers/createMeetingAudio.mjs'

const profile = (agentId = 'AG-CEO-001', voiceURI = 'synthetic-ar-local') => ({
  agentId, voiceURI, supportedLanguages: ['ar', 'en'], rate: 1, pitch: 1, fallbackPolicy: 'none',
})
const contribution = (generationId = 'generation:1', agentId = 'AG-CEO-001') => ({ turnId: 'turn:1', generationId, agentId })

function browser({ permission, voices, vad = false } = {}) {
  const recognizers = [], utterances = [], requests = [], frames = new Map(), trackListeners = new Map()
  let cancelCalls = 0, stops = 0, contextCloses = 0, nextFrame = 0, destinationConnections = 0
  const track = {
    stop() { stops += 1 },
    addEventListener(name, listener) { trackListeners.set(name, listener) },
    removeEventListener(name, listener) { if (trackListeners.get(name) === listener) trackListeners.delete(name) },
  }
  const stream = { getTracks: () => [track] }
  class Recognition {
    constructor() { recognizers.push(this); this.aborts = 0 }
    start() { this.onstart?.() }
    abort() { this.aborts += 1 }
  }
  class Utterance { constructor(text) { this.text = text } }
  const environment = {
    SpeechRecognition: Recognition,
    SpeechSynthesisUtterance: Utterance,
    navigator: { mediaDevices: { getUserMedia: async constraints => {
      requests.push(constraints)
      return permission ? permission() : stream
    } } },
    speechSynthesis: {
      getVoices: () => voices ?? [
        { voiceURI: 'synthetic-ar-local', name: 'Arabic local', lang: 'ar-SA', localService: true },
        { voiceURI: 'synthetic-en-local', name: 'English local', lang: 'en-US', localService: true },
        { voiceURI: 'synthetic-ar-remote', name: 'Arabic network', lang: 'ar-EG', localService: false },
      ],
      speak(utterance) { utterances.push(utterance); utterance.onstart?.() },
      cancel() { cancelCalls += 1 },
    },
  }
  if (vad) {
    environment.requestAnimationFrame = callback => { const id = ++nextFrame; frames.set(id, callback); return id }
    environment.cancelAnimationFrame = id => frames.delete(id)
    environment.AudioContext = class {
      destination = { destination: true }
      createMediaStreamSource() { return { connect: target => { if (target.destination) destinationConnections += 1 }, disconnect() {} } }
      createAnalyser() { return { fftSize: 512, getFloatTimeDomainData(array) { array.fill(0.1) }, disconnect() {} } }
      close() { contextCloses += 1; return Promise.resolve() }
    }
  }
  return { environment, stream, recognizers, utterances, requests,
    counts: () => ({ cancelCalls, stops, contextCloses, destinationConnections }),
    endTrack() { trackListeners.get('ended')?.() },
    nextVadFrame() { const entry = frames.entries().next().value; if (entry) { frames.delete(entry[0]); entry[1]() } },
  }
}

function result(text, isFinal = true, confidence = 0.92) {
  const item = [{ transcript: text, confidence }]
  item.isFinal = isFinal
  return { resultIndex: 0, results: [item] }
}
const consent = { userInitiated: true, recognitionDisclosureAccepted: true }

test('construction is SSR safe and unsupported recognition retains text fallback', async () => {
  const controller = createMeetingAudio({ environment: {} })
  assert.equal(controller.getState().captureActive, false)
  assert.equal(await controller.startCapture(consent), false)
  assert.equal(controller.getState().error, 'recognition-unavailable')
  controller.close()
})

test('microphone requires both explicit action and recognition disclosure', async () => {
  const fixture = browser()
  const controller = createMeetingAudio({ environment: fixture.environment })
  assert.equal(fixture.requests.length, 0)
  assert.equal(await controller.startCapture({ userInitiated: true }), false)
  assert.equal(await controller.startCapture({ recognitionDisclosureAccepted: true }), false)
  assert.equal(fixture.requests.length, 0)
  assert.equal(await controller.startCapture(consent), true)
  assert.equal(fixture.requests.length, 1)
  assert.equal(fixture.requests[0].audio.echoCancellation, true)
  assert.equal(fixture.requests[0].video, false)
  assert.equal(controller.getState().captureActive, true)
  controller.close()
  assert.equal(fixture.counts().stops, 1)
})

test('recognition replaces interim drafts, marks uncertainty and never authorizes a command', async () => {
  const fixture = browser(), drafts = []
  const controller = createMeetingAudio({ environment: fixture.environment, onDraft: value => drafts.push(value) })
  await controller.startCapture(consent)
  const recognition = fixture.recognizers[0]
  assert.equal(recognition.lang, 'ar')
  recognition.onresult(result('موافقة', false, 0.4))
  recognition.onresult(result('خطة تحتاج مراجعة', true, 0.75))
  assert.deepEqual(drafts.map(draft => [draft.text, draft.final, draft.uncertain]), [
    ['موافقة', false, true], ['خطة تحتاج مراجعة', true, true],
  ])
  assert.equal(fixture.utterances.length, 0)
  controller.close()
})

test('oversized recognition rejects the whole alternative and preserves the exact previous draft', async () => {
  const fixture = browser(), drafts = []
  const controller = createMeetingAudio({ environment: fixture.environment, onDraft: value => drafts.push(value) })
  await controller.startCapture(consent)
  const recognition = fixture.recognizers[0], late = recognition.onresult
  const reviewed = 'Keep this reviewed draft exactly 👩🏽‍💻 — لا توافق بعد.'
  recognition.onresult(result(reviewed, true, 0.95))
  // The former slice at 8000 accepted a partial alternative and split this emoji.
  recognition.onresult(result(`${'a'.repeat(7_999)}😀 retain this consequential suffix`, true, 0.95))
  assert.deepEqual(drafts.map(draft => draft.text), [reviewed])
  assert.equal(controller.getState().error, 'recognition-limit')
  assert.equal(controller.getState().captureActive, false)
  assert.equal(recognition.aborts, 1)
  assert.equal(fixture.counts().stops, 1)
  late(result('This obsolete recognition callback must stay rejected'))
  assert.deepEqual(drafts.map(draft => draft.text), [reviewed])
  controller.close()
})

test('pending permission is invalidated on close and late tracks are released', async () => {
  let allow
  const fixture = browser({ permission: () => new Promise(resolve => { allow = resolve }) })
  const controller = createMeetingAudio({ environment: fixture.environment })
  const capture = controller.startCapture(consent)
  controller.close()
  allow(fixture.stream)
  assert.equal(await capture, false)
  assert.equal(fixture.recognizers.length, 0)
  assert.equal(fixture.counts().stops, 1)
  assert.equal(controller.getState().captureActive, false)
})

test('language change releases microphone and fences stale recognition callbacks', async () => {
  const fixture = browser(), drafts = []
  const controller = createMeetingAudio({ environment: fixture.environment, onDraft: value => drafts.push(value) })
  await controller.startCapture(consent)
  const old = fixture.recognizers[0], late = old.onresult
  controller.setLanguage('en-US')
  late(result('late approve all'))
  assert.deepEqual(drafts, [])
  assert.equal(old.aborts, 1)
  assert.equal(fixture.counts().stops, 1)
  assert.equal(controller.getState().language, 'en-US')
  await controller.startCapture(consent)
  assert.equal(fixture.recognizers[1].lang, 'en-US')
  controller.close()
})

test('permission denial and recognition failure release audio with explicit fallback reason', async () => {
  const denied = browser({ permission: () => { throw Object.assign(new Error('synthetic denial'), { name: 'NotAllowedError' }) } })
  const first = createMeetingAudio({ environment: denied.environment })
  assert.equal(await first.startCapture(consent), false)
  assert.equal(first.getState().error, 'microphone-denied')
  assert.equal(first.getState().captureActive, false)
  first.close()
  const fixture = browser(), controller = createMeetingAudio({ environment: fixture.environment })
  await controller.startCapture(consent)
  fixture.recognizers[0].onerror({ error: 'network' })
  assert.equal(controller.getState().error, 'recognition-network')
  assert.equal(fixture.counts().stops, 1)
  controller.close()
})

test('speech uses an exact local voice assignment across meetings and has no provider fallback', () => {
  const fixture = browser()
  for (let index = 0; index < 2; index += 1) {
    const controller = createMeetingAudio({ environment: fixture.environment, profiles: [profile()] })
    controller.beginContribution(contribution(`generation:${index}`))
    assert.equal(controller.speakChunk({ ...contribution(`generation:${index}`), text: 'مرحبا' }), true)
    assert.equal(fixture.utterances[index].voice.voiceURI, 'synthetic-ar-local')
    assert.equal(fixture.utterances[index].lang, 'ar-SA')
    controller.close()
  }
  const controller = createMeetingAudio({ environment: fixture.environment, profiles: [profile('AG-CEO-001', 'synthetic-ar-remote')] })
  controller.beginContribution(contribution())
  assert.equal(controller.voiceAvailable('AG-CEO-001'), false)
  assert.equal(controller.speakChunk({ ...contribution(), text: 'لا يوجد صوت مصرح' }), false)
  assert.equal(controller.getState().error, 'voice-unavailable')
  assert.deepEqual(controller.voiceOptions().map(voice => voice.voiceURI), ['synthetic-ar-local'])
  controller.close()
})

test('founder speech clears queued audio and late chunks/callbacks cannot resume it', async () => {
  const fixture = browser(), interruptions = []
  let clock = 0
  const controller = createMeetingAudio({ environment: fixture.environment, profiles: [profile()],
    now: () => { clock += 2.5; return clock }, onInterrupt: event => interruptions.push(event) })
  controller.beginContribution(contribution())
  controller.speakChunk({ ...contribution(), text: 'first' })
  controller.speakChunk({ ...contribution(), text: 'queued' })
  const cancelled = fixture.utterances[0]
  await controller.startCapture(consent)
  fixture.recognizers[0].onspeechstart()
  cancelled.onend()
  cancelled.onstart()
  assert.equal(fixture.utterances.length, 1)
  assert.equal(controller.getState().speakingAgentId, null)
  assert.equal(controller.speakChunk({ ...contribution(), text: 'late audio' }), false)
  assert.equal(controller.beginContribution(contribution()), false)
  assert.equal(interruptions.length, 1)
  assert.equal(interruptions[0].reason, 'recognition-speech-start')
  // Synthetic clock: call duration only, not observed audible-device latency.
  assert.equal(interruptions[0].cancellationCallLatencyMs, 2.5)
  controller.close()
})

test('only one agent speaks and an old onend cannot drain a new generation', () => {
  const fixture = browser()
  const controller = createMeetingAudio({ environment: fixture.environment, profiles: [profile(), profile('AG-HR-001')] })
  controller.beginContribution(contribution())
  controller.speakChunk({ ...contribution(), text: 'Steve first' })
  const old = fixture.utterances[0]
  const next = contribution('generation:2', 'AG-HR-001')
  controller.beginContribution(next)
  controller.speakChunk({ ...next, text: 'Amaya first' })
  controller.speakChunk({ ...next, text: 'Amaya second' })
  assert.equal(controller.getState().speakingAgentId, 'AG-HR-001')
  old.onend()
  assert.equal(fixture.utterances.length, 2)
  fixture.utterances[1].onend()
  assert.equal(fixture.utterances.length, 3)
  assert.equal(fixture.utterances[2].text, 'Amaya second')
  controller.close()
})

test('synthetic local VAD interrupts without connecting microphone to speakers', async () => {
  const fixture = browser({ vad: true }), interruptions = []
  const controller = createMeetingAudio({ environment: fixture.environment, profiles: [profile()], onInterrupt: event => interruptions.push(event) })
  await controller.startCapture(consent)
  controller.beginContribution(contribution())
  controller.speakChunk({ ...contribution(), text: 'agent speaking' })
  fixture.nextVadFrame()
  assert.equal(interruptions.length, 0)
  fixture.nextVadFrame()
  assert.equal(interruptions[0].reason, 'voice-activity')
  assert.equal(fixture.counts().destinationConnections, 0)
  controller.stopCapture()
  assert.equal(fixture.counts().contextCloses, 1)
  assert.equal(fixture.counts().stops, 1)
  controller.close()
})

test('recognition ending and mute release capture rather than silently restarting', async () => {
  const fixture = browser(), controller = createMeetingAudio({ environment: fixture.environment })
  await controller.startCapture(consent)
  fixture.recognizers[0].onend()
  assert.equal(controller.getState().captureActive, false)
  assert.equal(fixture.requests.length, 1)
  await controller.startCapture(consent)
  assert.equal(controller.setMuted(true), true)
  assert.equal(fixture.counts().stops, 2)
  assert.equal(controller.setMuted(false), true)
  controller.close()
})

test('device removal updates capture status and releases the remaining resources', async () => {
  const fixture = browser({ vad: true }), controller = createMeetingAudio({ environment: fixture.environment })
  await controller.startCapture(consent)
  fixture.endTrack()
  assert.equal(controller.getState().captureActive, false)
  assert.equal(controller.getState().error, 'microphone-ended')
  assert.equal(fixture.counts().contextCloses, 1)
  assert.equal(fixture.recognizers[0].aborts, 1)
  controller.close()
})

test('interruption fence does not evict old generations after the meeting limit', () => {
  const fixture = browser(), controller = createMeetingAudio({ environment: fixture.environment, profiles: [profile()] })
  for (let index = 0; index < 512; index += 1) {
    assert.equal(controller.beginContribution(contribution(`generation:${index}`)), true)
    controller.interrupt()
  }
  assert.equal(controller.beginContribution(contribution('generation:0')), false)
  assert.equal(controller.beginContribution(contribution('generation:513')), false)
  controller.close()
})

test('local-only recognition requires installed language support and never falls back', async () => {
  const unsupported = browser()
  const first = createMeetingAudio({ environment: unsupported.environment })
  assert.equal(await first.startCapture({ ...consent, recognitionMode: 'local-only' }), false)
  assert.equal(first.getState().error, 'local-recognition-unavailable')
  assert.equal(unsupported.requests.length, 0)
  first.close()
  const fixture = browser()
  fixture.environment.SpeechRecognition.prototype.processLocally = false
  fixture.environment.SpeechRecognition.available = async request => {
    assert.deepEqual(request, { langs: ['ar'], processLocally: true })
    return 'available'
  }
  const controller = createMeetingAudio({ environment: fixture.environment })
  assert.equal(await controller.startCapture({ ...consent, recognitionMode: 'local-only' }), true)
  assert.equal(fixture.recognizers.at(-1).processLocally, true)
  assert.equal(controller.getState().recognitionMode, 'local-only')
  controller.close()
})
