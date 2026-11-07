/* global AudioWorkletProcessor, sampleRate, registerProcessor */
/** Bounded mono 16kHz PCM, local VAD and a silent output. No recording/persistence. */
class MeetingCapture extends AudioWorkletProcessor {
  constructor() {
    super()
    this.active = false
    this.finished = false
    this.frames = []
    this.preRoll = []
    this.preRollLength = 0
    this.length = 0
    this.silence = 0
    this.voiced = 0
    this.speaking = false
    this.port.onmessage = event => {
      const type = event.data?.type
      if (type === 'start') { this.active = true; this.finished = false; return }
      if (type === 'finish') {
        if (this.finished) return
        this.active = false; this.finished = true
        this.flush()
        // Port messages are FIFO: any final chunk precedes this acknowledgement.
        this.port.postMessage({ type: 'finished' })
        return
      }
      // Hard stop/unknown messages discard speech and invalidate a late finish.
      this.active = false; this.finished = true; this.clear()
    }
  }
  clear() {
    for (const frame of this.frames) frame.fill(0)
    for (const frame of this.preRoll) frame.fill(0)
    this.preRoll = []; this.preRollLength = 0
    this.frames = []; this.length = 0; this.silence = 0; this.voiced = 0; this.speaking = false
  }
  rememberQuiet(input) {
    const limit = Math.floor(sampleRate * 0.2)
    const frame = input.slice(-limit)
    this.preRoll.push(frame); this.preRollLength += frame.length
    while (this.preRollLength > limit) {
      const oldest = this.preRoll[0]
      const remove = Math.min(oldest.length, this.preRollLength - limit)
      if (remove === oldest.length) this.preRoll.shift()
      else this.preRoll[0] = oldest.slice(remove)
      oldest.fill(0); this.preRollLength -= remove
    }
  }
  flush() {
    if (this.voiced >= sampleRate * 0.15 && this.length) {
      const audio = new Float32Array(this.length)
      let offset = 0
      for (const frame of this.frames) { audio.set(frame, offset); offset += frame.length; frame.fill(0) }
      this.port.postMessage({ type: 'chunk', audio }, [audio.buffer])
    }
    this.clear()
  }
  process(inputs, outputs) {
    for (const output of outputs) for (const channel of output) channel.fill(0)
    const input = inputs[0]?.[0]
    if (!this.active || !input?.length) return true
    let power = 0
    for (const value of input) power += value * value
    const voice = Math.sqrt(power / input.length) >= 0.015
    if (!this.speaking && !voice) { this.rememberQuiet(input); return true }
    if (!this.speaking) {
      // Preserve quiet initial phonemes while keeping the total chunk cap at 15s.
      this.frames = this.preRoll; this.length = this.preRollLength
      this.preRoll = []; this.preRollLength = 0
      this.speaking = true; this.port.postMessage({ type: 'speech-start' })
    }
    const remaining = Math.max(0, 15 * sampleRate - this.length)
    const frame = input.slice(0, remaining)
    this.frames.push(frame); this.length += frame.length
    if (voice) { this.voiced += frame.length; this.silence = 0 }
    else this.silence += frame.length
    if (this.length >= 15 * sampleRate || this.silence >= sampleRate * 0.6) this.flush()
    return true
  }
}
registerProcessor('meeting-capture', MeetingCapture)
