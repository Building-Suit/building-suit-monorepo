import { parseSicsCapability, parseSicsIdentity, parseSicsWeight, sicsNetReading } from '../utils/mtSics.js'

export interface ScaleSerialOptions { baudRate: number; dataBits: 7 | 8; stopBits: 1 | 2; parity: 'none' | 'even' | 'odd'; flowControl: 'none' | 'hardware' }
export interface ScaleSerialPort { readable: ReadableStream<Uint8Array> | null; writable: WritableStream<Uint8Array> | null; open: (options: ScaleSerialOptions) => Promise<void>; close: () => Promise<void> }
export interface ScaleSerialAccess { requestPort: () => Promise<ScaleSerialPort>; addEventListener?: (type: string, listener: EventListener) => void; removeEventListener?: (type: string, listener: EventListener) => void }
export interface SicsReading { net: string; tare: string; gross: string; unit: 'kg' | 'g'; tareBefore: string; stable: string; tareAfter: string; readAt: string; serial: string }
export interface SicsScaleState { status: 'disconnected' | 'connecting' | 'ready' | 'reading' | 'taring' | 'disconnecting' | 'error'; serial: string | null; canTare: boolean; canConnect: boolean; reading: SicsReading | null; error: string | null }
type Flight = { consume: (frame: string) => void; reject: (error: Error) => void; timer: ReturnType<typeof setTimeout>; frames: number; bytes: number }
const softErrors = new Set(['SCALE_NOT_READY', 'SCALE_UNSTABLE', 'SCALE_OVERLOAD', 'SCALE_UNDERLOAD'])
function knownError(cause: unknown) { return cause instanceof Error && /^SCALE_[A-Z_]+$/.test(cause.message) ? cause : new Error('SCALE_CONNECTION_FAILED') }

/** User-initiated, on-demand MT-SICS transport. No product or financial rules. */
export function createSicsScale(options: { serial?: ScaleSerialAccess; timeoutMs?: number; staleMs?: number; now?: () => number; onState?: (state: SicsScaleState) => void } = {}) {
  const now = options.now ?? Date.now, timeout = options.timeoutMs ?? 5000, stale = options.staleMs ?? 10000
  let state: SicsScaleState = { status: 'disconnected', serial: null, canTare: false, canConnect: true, reading: null, error: null }
  let port: ScaleSerialPort | null = null, reader: ReadableStreamDefaultReader<Uint8Array> | null = null, writer: WritableStreamDefaultWriter<Uint8Array> | null = null
  let access: ScaleSerialAccess | undefined, pending: Flight | null = null, generation = 0, closing: Promise<void> | null = null, cleanupFailed = false
  let expiry: ReturnType<typeof setTimeout> | null = null, readAt = 0, buffer = ''
  const getState = (): SicsScaleState => ({ ...state, reading: state.reading ? { ...state.reading } : null })
  function emit(change: Partial<SicsScaleState>) { state = { ...state, ...change }; options.onState?.(getState()) }
  function clearReading() { if (expiry) clearTimeout(expiry); expiry = null; readAt = 0; emit({ reading: null }) }
  function rejectFlight(error: Error) { const flight = pending; pending = null; if (flight) { clearTimeout(flight.timer); flight.reject(error) } }
  async function bounded(work: Promise<unknown>) {
    let timer: ReturnType<typeof setTimeout> | undefined
    try { await Promise.race([work, new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('SCALE_CLOSE_FAILED')), 2000) })]) }
    finally { if (timer) clearTimeout(timer) }
  }
  function shutdown(error: string | null = null): Promise<void> {
    if (closing) return closing
    generation++; rejectFlight(new Error(error ?? 'SCALE_DISCONNECTED')); clearReading()
    emit({ status: 'disconnecting', canConnect: false, canTare: false, serial: null, error })
    const oldReader = reader, oldWriter = writer, oldPort = port, oldAccess = access
    reader = null; writer = null; port = null; access = undefined; buffer = ''
    oldAccess?.removeEventListener?.('disconnect', disconnected)
    closing = Promise.resolve().then(async () => {
      try {
        await bounded(Promise.all([oldReader?.cancel().catch(() => {}), oldWriter?.abort().catch(() => {})]))
        oldReader?.releaseLock(); oldWriter?.releaseLock()
        if (oldPort) await bounded(oldPort.close())
      } catch { cleanupFailed = true }
      finally { closing = null; emit({ status: cleanupFailed || error ? 'error' : 'disconnected', canConnect: !cleanupFailed, error: cleanupFailed ? 'SCALE_CLOSE_FAILED' : error }) }
    })
    return closing
  }
  const disconnected: EventListener = event => {
    const value = event as Event & { port?: ScaleSerialPort }
    if (value.port === port || event.target === port as unknown || event.target === access as unknown) void shutdown('SCALE_DISCONNECTED')
  }
  function active(token: number) { if (token !== generation || !reader || !writer || closing) throw new Error('SCALE_DISCONNECTED') }
  function exchange<T>(command: 'I4' | 'I0' | 'TA' | 'S' | 'T', parse: (frame: string) => { done: boolean; value?: T }, token: number): Promise<T> {
    active(token)
    if (pending) return Promise.reject(new Error('SCALE_BUSY'))
    return new Promise<T>((resolve, reject) => {
      const flight: Flight = {
        frames: 0, bytes: 0, reject,
        timer: setTimeout(() => { if (pending === flight && token === generation) void shutdown('SCALE_TIMEOUT') }, timeout),
        consume(frame) {
          if (++flight.frames > 512 || (flight.bytes += frame.length) > 16384) throw new Error('SCALE_FRAME_LIMIT')
          const result = parse(frame)
          if (result.done) { clearTimeout(flight.timer); if (pending === flight) pending = null; resolve(result.value as T) }
        },
      }
      pending = flight
      void writer!.write(new TextEncoder().encode(command + '\r\n')).catch(() => { if (token === generation) void shutdown('SCALE_CONNECTION_FAILED') })
    })
  }
  async function pump(token: number) {
    try {
      while (token === generation && reader) {
        const received = await reader.read()
        if (token !== generation) return
        if (received.done) throw new Error('SCALE_DISCONNECTED')
        if (!received.value || received.value.byteLength > 16384 || [...received.value].some(b => b !== 13 && b !== 10 && (b < 32 || b > 126))) throw new Error('SCALE_INVALID_FRAME')
        buffer += new TextDecoder().decode(received.value)
        for (let end = buffer.indexOf('\r\n'); end >= 0; end = buffer.indexOf('\r\n')) {
          const frame = buffer.slice(0, end + 2); buffer = buffer.slice(end + 2)
          if (frame.length > 128 || !pending) throw new Error('SCALE_UNEXPECTED_RESPONSE')
          try { pending.consume(frame) }
          catch (cause) { const error = knownError(cause); if (!softErrors.has(error.message)) throw error; rejectFlight(error) }
        }
        if (buffer.length > 128 || /\n/.test(buffer) || /\r./.test(buffer)) throw new Error('SCALE_INVALID_FRAME')
      }
    } catch (cause) { if (token === generation) await shutdown(knownError(cause).message) }
  }
  async function connect(serialOptions: ScaleSerialOptions, expectedSerial: string) {
    if (!state.canConnect || state.status === 'connecting' || closing || cleanupFailed) throw new Error('SCALE_BUSY')
    const candidate = options.serial ?? (typeof navigator !== 'undefined' ? (navigator as Navigator & { serial?: ScaleSerialAccess }).serial : undefined)
    if (!candidate) throw new Error('SCALE_BROWSER_UNSUPPORTED')
    if (!serialOptions || typeof serialOptions !== 'object' || typeof expectedSerial !== 'string' || !expectedSerial || expectedSerial.length > 64 || Object.keys(serialOptions).some(key => !['baudRate','dataBits','stopBits','parity','flowControl'].includes(key))
      || ![1200,2400,4800,9600,19200,38400,57600,115200].includes(serialOptions.baudRate) || ![7,8].includes(serialOptions.dataBits)
      || ![1,2].includes(serialOptions.stopBits) || !['none','even','odd'].includes(serialOptions.parity) || !['none','hardware'].includes(serialOptions.flowControl)) throw new Error('SCALE_INVALID_OPTIONS')
    const token = ++generation; emit({ status: 'connecting', canConnect: false, error: null, reading: null })
    try {
      const selected = await candidate.requestPort()
      if (token !== generation) throw new Error('SCALE_DISCONNECTED')
      port = selected; access = candidate; await selected.open(serialOptions)
      if (token !== generation) { await selected.close().catch(() => {}); throw new Error('SCALE_DISCONNECTED') }
      if (!selected.readable || !selected.writable) throw new Error('SCALE_CONNECTION_FAILED')
      reader = selected.readable.getReader(); writer = selected.writable.getWriter(); candidate.addEventListener?.('disconnect', disconnected); buffer = ''
      void pump(token)
      const serial = await exchange('I4', frame => ({ done: true, value: parseSicsIdentity(frame) }), token)
      if (serial !== expectedSerial) throw new Error('SCALE_IDENTITY_MISMATCH')
      const commands = new Set<string>()
      await exchange('I0', frame => { const result = parseSicsCapability(frame); if (typeof result.command !== 'string') throw new Error('SCALE_CAPABILITIES_UNAVAILABLE'); commands.add(result.command); return { done: result.final, value: true } }, token)
      active(token)
      if (!commands.has('S') || !commands.has('TA')) throw new Error('SCALE_CAPABILITIES_UNAVAILABLE')
      emit({ status: 'ready', serial, canTare: commands.has('T'), error: null })
    } catch (cause) { const error = knownError(cause); if (token === generation) await shutdown(error.message); else if (closing) await closing; throw error }
  }
  async function read() {
    if (state.status !== 'ready') throw new Error('SCALE_NOT_READY')
    const token = generation; clearReading(); emit({ status: 'reading', error: null })
    try {
      const response = async (command: 'TA' | 'S') => exchange(command, frame => { parseSicsWeight(frame, command); return { done: true, value: frame } }, token)
      const before = await response('TA'), net = await response('S'), after = await response('TA'); active(token)
      const value = sicsNetReading(before, net, after), capturedAt = now()
      const reading: SicsReading = { ...value, unit: value.unit as 'kg' | 'g', readAt: new Date(capturedAt).toISOString(), serial: state.serial! }
      readAt = capturedAt; emit({ status: 'ready', reading, error: null })
      expiry = setTimeout(() => { if (token === generation && state.reading) { clearReading(); emit({ error: 'SCALE_READING_EXPIRED' }) } }, stale)
      return { ...reading }
    } catch (cause) {
      const error = knownError(cause)
      if (token === generation) { clearReading(); if (softErrors.has(error.message)) emit({ status: 'ready', error: error.message }); else await shutdown(error.message) }
      else if (closing) await closing
      throw error
    }
  }
  async function tare(confirmed = false) {
    if (!confirmed) throw new Error('SCALE_TARE_CONFIRMATION_REQUIRED')
    if (state.status !== 'ready' || !state.canTare) throw new Error('SCALE_NOT_READY')
    const token = generation; clearReading(); emit({ status: 'taring', error: null })
    try {
      const result = await exchange('T', frame => ({ done: true, value: parseSicsWeight(frame, 'T') }), token); active(token)
      if (result.value.startsWith('-')) throw new Error('SCALE_INVALID_TARE')
      emit({ status: 'ready', error: null })
    } catch (cause) { const error = knownError(cause); if (token === generation) { if (softErrors.has(error.message)) emit({ status: 'ready', error: error.message }); else await shutdown(error.message) } else if (closing) await closing; throw error }
  }
  function currentReading() {
    const age = now() - readAt
    if (state.status !== 'ready' || !state.reading || age < 0 || age > stale) throw new Error('SCALE_READING_EXPIRED')
    return { ...state.reading }
  }
  return { connect, read, tare, currentReading, getState, forgetReading: clearReading, disconnect: () => shutdown() }
}
