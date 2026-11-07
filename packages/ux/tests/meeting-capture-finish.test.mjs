import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import vm from 'node:vm'

async function fixture() {
  const source = await readFile(new URL('../src/worklets/meetingCapture.worklet.mjs', import.meta.url), 'utf8')
  let Constructor
  const messages = []
  vm.runInNewContext(source, { sampleRate: 16_000, Float32Array,
    AudioWorkletProcessor: class { port = { onmessage: null, postMessage(value) { messages.push(value) } } },
    registerProcessor(name, value) { assert.equal(name, 'meeting-capture'); Constructor = value } })
  const processor = new Constructor()
  const output = new Float32Array(128)
  const command = type => processor.port.onmessage({ data: { type } })
  const frames = (count, amplitude = 0.05) => {
    for (let index = 0; index < count; index++) {
      output.fill(0.9)
      processor.process([[new Float32Array(128).fill(amplitude)]], [[output]])
      assert.equal(output.every(sample => sample === 0), true)
    }
  }
  command('start')
  return { processor, messages, command, frames }
}

test('manual finish publishes a partial voiced utterance once before its acknowledgement', async () => {
  const f = await fixture()
  f.frames(25)
  const retained = [...f.processor.frames]
  assert.deepEqual(f.messages.map(message => message.type), ['speech-start'])
  f.command('finish')
  assert.deepEqual(f.messages.map(message => message.type), ['speech-start', 'chunk', 'finished'])
  assert.equal(f.messages[1].audio.length, 25 * 128)
  assert.equal(f.messages[1].audio.every(sample => Math.abs(sample - 0.05) < 0.000001), true)
  assert.equal(retained.every(frame => frame.every(sample => sample === 0)), true)
  assert.equal(f.processor.frames.length, 0)
  assert.equal(f.processor.active, false)
  f.command('finish')
  f.frames(25)
  assert.deepEqual(f.messages.map(message => message.type), ['speech-start', 'chunk', 'finished'])
})

test('hard stop clears voiced PCM and a queued finish cannot publish or acknowledge it', async () => {
  const f = await fixture()
  f.frames(25)
  const retained = [...f.processor.frames]
  f.command('stop')
  f.command('finish')
  f.frames(25)
  assert.deepEqual(f.messages.map(message => message.type), ['speech-start'])
  assert.equal(retained.every(frame => frame.every(sample => sample === 0)), true)
  assert.equal(f.processor.frames.length, 0)
  assert.equal(f.processor.active, false)
})

test('finish acknowledges short noise without admitting it as a speech chunk', async () => {
  const f = await fixture()
  f.frames(5)
  const retained = [...f.processor.frames]
  f.command('finish')
  assert.deepEqual(f.messages.map(message => message.type), ['speech-start', 'finished'])
  assert.equal(retained.every(frame => frame.every(sample => sample === 0)), true)
  assert.equal(f.processor.frames.length, 0)
})

test('finish after silence already flushed the utterance does not duplicate it', async () => {
  const f = await fixture()
  f.frames(25)
  f.frames(76, 0)
  assert.equal(f.messages.filter(message => message.type === 'chunk').length, 1)
  f.command('finish')
  assert.deepEqual(f.messages.map(message => message.type), ['speech-start', 'chunk', 'finished'])
  assert.equal(f.processor.frames.length, 0)
})

test('bounded quiet preroll preserves the latest 200ms before the voiced onset', async () => {
  const f = await fixture()
  f.frames(1, 0.003)
  const discarded = f.processor.preRoll[0]
  f.frames(100, 0.003)
  assert.equal(f.processor.preRollLength, 3_200)
  assert.equal(discarded.every(sample => sample === 0), true)
  f.frames(25, 0.006)
  const retained = [...f.processor.preRoll]
  f.frames(25)
  f.command('finish')
  const chunks = f.messages.filter(message => message.type === 'chunk')
  assert.equal(chunks.length, 1)
  assert.equal(chunks[0].audio.length, 6_400)
  assert.equal(chunks[0].audio.subarray(0, 3_200).every(sample => Math.abs(sample - 0.006) < 0.000001), true)
  assert.equal(chunks[0].audio.subarray(3_200).every(sample => Math.abs(sample - 0.05) < 0.000001), true)
  assert.equal(retained.every(frame => frame.every(sample => sample === 0)), true)
  assert.equal(f.processor.preRollLength, 0)
})

test('hard abort clears quiet preroll without admitting a speech chunk', async () => {
  const f = await fixture()
  f.frames(50, 0.005)
  const retained = [...f.processor.preRoll]
  assert.equal(f.processor.preRollLength, 3_200)
  f.command('stop')
  f.command('finish')
  assert.deepEqual(f.messages, [])
  assert.equal(retained.every(frame => frame.every(sample => sample === 0)), true)
  assert.equal(f.processor.preRollLength, 0)
  assert.equal(f.processor.preRoll.length, 0)
})

test('the 15s PCM cap includes preroll rather than extending the chunk budget', async () => {
  const f = await fixture()
  f.frames(25, 0.005)
  f.frames(1_900)
  const chunks = f.messages.filter(message => message.type === 'chunk')
  assert.equal(chunks.length, 1)
  assert.equal(chunks[0].audio.length, 15 * 16_000)
  assert.equal(chunks[0].audio.subarray(0, 3_200).every(sample => Math.abs(sample - 0.005) < 0.000001), true)
  f.command('stop')
})
