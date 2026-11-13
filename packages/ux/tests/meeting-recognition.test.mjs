import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import vm from 'node:vm'
import { createMultilingualMeetingRecognition } from '../src/controllers/createMultilingualMeetingRecognition.mjs'

function fixture() {
  const messages = [], nodes = [], contexts = []
  let captures = 0, terminations = 0
  const worker = { postMessage(message) { messages.push(message) }, terminate() { terminations++ }, onmessage: null, onerror: null }
  class AudioContext {
    sampleRate = 16_000
    destination = {}
    closed = false
    audioWorklet = { addModule: async () => {} }
    constructor() { contexts.push(this) }
    async resume() {}
    async close() { this.closed = true }
    createMediaStreamSource() { return { connect() {}, disconnect() {} } }
  }
  class AudioWorkletNode {
    port = { onmessage: null, postMessage() {}, close() {} }
    constructor() { nodes.push(this) }
    connect() {}
    disconnect() {}
  }
  const environment = { isSecureContext: true, AudioContext, AudioWorkletNode,
    navigator: { mediaDevices: { getUserMedia() { captures++; throw new Error('Forbidden real capture') } } } }
  const engine = createMultilingualMeetingRecognition({ environment, createWorker: () => worker })
  return { engine, messages, nodes, contexts, environment, counts: () => ({ captures, terminations }),
    receive(value) { worker.onmessage({ data: value }) },
    async prepare() { const pending = engine.prepare({ userInitiated: true, modelDownloadConsent: true }); this.receive({ type: 'prepared', id: messages.at(-1).id }); assert.equal(await pending, true) } }
}

test('automatic model download requires separate explicit consent and never starts a microphone', async () => {
  const f = fixture()
  assert.equal(f.messages.length, 0)
  assert.equal(await f.engine.prepare({ userInitiated: true }), false)
  assert.equal(f.messages.length, 0)
  assert.equal(f.engine.getState().error, 'model-consent-required')
  await f.prepare()
  assert.equal(f.engine.support().status, 'ready')
  assert.equal(f.counts().captures, 0)
  f.engine.dispose()
})

test('automatic results are final reviewable text with unknown confidence and detected language', async () => {
  const f = fixture(), results = []
  await f.prepare()
  const session = await f.engine.createSession({ synthetic: true })
  session.onresult = event => results.push(event)
  session.start()
  f.nodes[0].port.onmessage({ data: { type: 'chunk', audio: new Float32Array(16_000).fill(0.1) } })
  const request = f.messages.at(-1)
  f.receive({ ...request, type: 'result', text: 'هذه مسودة للمراجعة', language: 'ar', confidence: null })
  assert.equal(results[0].results[0][0].transcript, 'هذه مسودة للمراجعة')
  assert.equal(results[0].results[0][0].confidence, undefined)
  assert.equal(results[0].results[0][0].language, 'ar')
  assert.equal(results[0].results[0].isFinal, true)
  session.abort()
  assert.equal(f.contexts[0].closed, true)
  assert.equal(f.engine.getState().prepared, true)
  f.receive({ ...request, type: 'result', text: 'obsolete', language: 'en' })
  assert.equal(results.length, 1)
  f.engine.dispose()
})

test('stopping busy inference terminates worker and fences all late text without retaining a queue', async () => {
  const f = fixture(), results = []
  await f.prepare()
  const session = await f.engine.createSession({ synthetic: true })
  session.onresult = event => results.push(event)
  session.start()
  f.nodes[0].port.onmessage({ data: { type: 'chunk', audio: new Float32Array(1000) } })
  const request = f.messages.at(-1)
  session.abort()
  assert.equal(f.counts().terminations, 1)
  assert.equal(f.engine.getState().prepared, false)
  f.receive({ ...request, type: 'result', text: 'late authority', language: 'en' })
  assert.deepEqual(results, [])
  assert.equal(f.counts().captures, 0)
  f.engine.dispose()
})

test('backpressure fails explicitly and clears the extra PCM instead of silently dropping speech', async () => {
  const f = fixture(), errors = []
  await f.prepare()
  const session = await f.engine.createSession({ synthetic: true })
  session.onerror = error => errors.push(error.error)
  session.start()
  f.nodes[0].port.onmessage({ data: { type: 'chunk', audio: new Float32Array(1000) } })
  const queued = new Float32Array(1000).fill(0.25)
  f.nodes[0].port.onmessage({ data: { type: 'chunk', audio: queued } })
  assert.deepEqual(errors, [])
  const extra = new Float32Array(1000).fill(0.5)
  f.nodes[0].port.onmessage({ data: { type: 'chunk', audio: extra } })
  assert.deepEqual(errors, ['recognition-busy'])
  assert.equal(extra.every(value => value === 0), true)
  assert.equal(queued.every(value => value === 0), true)
  assert.equal(f.counts().terminations, 1)
  f.engine.dispose()
})

test('model errors and disposal resolve pending preparation without capture or leaked timers', async () => {
  const f = fixture()
  const pending = f.engine.prepare({ userInitiated: true, modelDownloadConsent: true })
  f.receive({ type: 'error', id: f.messages[0].id, code: 'unexpected raw detail' })
  assert.equal(await pending, false)
  assert.equal(f.engine.getState().error, 'recognition-inference-failed')
  const next = f.engine.prepare({ userInitiated: true, modelDownloadConsent: true })
  f.engine.dispose()
  assert.equal(await next, false)
  assert.equal(f.counts().captures, 0)
})

test('capture worklet keeps output silent, bounds PCM to15seconds and clears cancelled speech', async () => {
  const source = await readFile(new URL('../src/worklets/meetingCapture.worklet.mjs', import.meta.url), 'utf8')
  let Constructor
  const messages = []
  vm.runInNewContext(source, { sampleRate: 16_000, Float32Array,
    AudioWorkletProcessor: class { port = { onmessage: null, postMessage(value) { messages.push(value) } } },
    registerProcessor(name, value) { assert.equal(name, 'meeting-capture'); Constructor = value } })
  const processor = new Constructor()
  processor.port.onmessage({ data: { type: 'start' } })
  const output = new Float32Array(128).fill(0.75)
  for (let index = 0; index < 1900; index++) processor.process([[new Float32Array(128).fill(0.1)]], [[output]])
  assert.equal(output.every(value => value === 0), true)
  const chunks = messages.filter(message => message.type === 'chunk')
  assert.equal(chunks.length, 1)
  assert.equal(chunks[0].audio.length, 15 * 16_000)
  const retained = processor.frames[0]
  processor.port.onmessage({ data: { type: 'stop' } })
  assert.equal(processor.frames.length, 0)
  assert.equal(retained.every(value => value === 0), true)
})


test('aborting pending worklet setup closes context immediately and settles without creating a node', async () => {
  const f = fixture()
  await f.prepare()
  let releaseModule
  const original = f.environment.AudioContext
  f.environment.AudioContext = class extends original {
    constructor() { super(); this.audioWorklet.addModule = () => new Promise(resolve => { releaseModule = resolve }) }
  }
  const abort = new AbortController()
  const pending = f.engine.createSession({ synthetic: true }, { signal: abort.signal })
  const rejected = assert.rejects(pending, /recognition-disposed/)
  abort.abort()
  assert.equal(f.contexts[0].closed, true)
  await rejected
  releaseModule()
  await Promise.resolve()
  assert.equal(f.nodes.length, 0)
  assert.equal(f.counts().captures, 0)
  f.engine.dispose()
})


test('graceful stop drains current plus one queued utterance before ending and retains each final result once', async () => {
  const f = fixture(), results = []
  let ended = 0
  await f.prepare()
  const session = await f.engine.createSession({ synthetic: true })
  session.onresult = event => results.push(event.results.map(item => item[0].transcript))
  session.onend = () => { ended++ }
  session.start()
  const node = f.nodes[0]
  node.port.onmessage({ data: { type: 'chunk', audio: new Float32Array(1000) } })
  const first = f.messages.at(-1)
  node.port.onmessage({ data: { type: 'chunk', audio: new Float32Array(1000) } })
  assert.equal(f.messages.filter(message => message.type === 'transcribe').length, 1)
  assert.equal(f.engine.getState().processing, true)
  session.stop()
  node.port.onmessage({ data: { type: 'finished' } })
  assert.equal(f.contexts[0].closed, true)
  assert.equal(f.counts().terminations, 0)
  assert.equal(ended, 0)
  f.receive({ ...first, type: 'result', text: 'First reviewed utterance.', language: 'en' })
  const second = f.messages.at(-1)
  assert.equal(second.type, 'transcribe')
  assert.notEqual(second.id, first.id)
  assert.equal(ended, 0)
  f.receive({ ...second, type: 'result', text: 'المداخلة الثانية للمراجعة', language: 'ar' })
  assert.deepEqual(results, [['First reviewed utterance.'], ['First reviewed utterance.', 'المداخلة الثانية للمراجعة']])
  assert.equal(ended, 1)
  assert.equal(f.engine.getState().processing, false)
  assert.equal(f.engine.getState().prepared, true)
  f.receive({ ...second, type: 'result', text: 'obsolete duplicate', language: 'en' })
  assert.equal(results.length, 2)
  session.stop()
  assert.equal(ended, 1)
  f.engine.dispose()
})
