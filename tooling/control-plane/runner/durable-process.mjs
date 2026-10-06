import { workerProcessClassification } from './dot.mjs'
import { spawn, spawnSync } from 'node:child_process'
import { mkdirSync, readFileSync, writeFileSync, renameSync, existsSync, readdirSync } from 'node:fs'
import { createHash } from 'node:crypto'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const self = fileURLToPath(import.meta.url)
export function atomicJson(file, data) {
  const temp = `${file}.${process.pid}.tmp`
  writeFileSync(temp, JSON.stringify(data), { mode: 0o600 })
  renameSync(temp, file)
}
export function readJson(file) {
  try { return JSON.parse(readFileSync(file, 'utf8')) }
  catch { return null }
}
export function processStamp(pid) {
  try {
    const stat = readFileSync(`/proc/${pid}/stat`, 'utf8')
    const fields = stat.slice(stat.lastIndexOf(')') + 2).split(' ')
    // An unreaped exit retains its PID/start stamp but cannot finish a receipt.
    return ['Z', 'X'].includes(fields[0]) ? null : fields[19]
  }
  catch { return null }
}
export function receiptProcessAlive(state) {
  return !!state?.pid && !!state.start_stamp && processStamp(state.pid) === state.start_stamp
}
export function receiptPaths(root, key, generation = 0) {
  const dir = path.join(root, createHash('sha256').update(key).digest('hex'), String(generation))
  mkdirSync(dir, { recursive: true, mode: 0o700 })
  return { dir, request: path.join(dir, 'request.json'), state: path.join(dir, 'state.json'), result: path.join(dir, 'result.json'), lock: path.join(dir, 'process.lock') }
}
// Codex explicitly supports '-' as an exact stdin prompt. Never persist env or
// include prompt text in error diagnostics; requests remain private audit records.
export function stdinPromptRequest(program, args, options = {}) {
  if (path.basename(program) !== 'codex' || args[0] !== 'exec' || args.at(-1) === '-') return { args, options }
  const prompt = args.at(-1)
  return { args: [...args.slice(0, -1), '-'], options: { ...options, input: prompt } }
}
export function storedPrompt(text) {
  // The audit file appends exactly one newline; preserve all original whitespace.
  return text.endsWith('\n') ? text.slice(0, -1) : text
}
export function interruptedReceipt(paths) {
  const state = readJson(paths.state)
  return !existsSync(paths.result) && !!state && !receiptProcessAlive(state.child)
    && !receiptProcessAlive(state) && !receiptLocked(paths)
}
export function settleInterruptedReceipt(paths) {
  if (!interruptedReceipt(paths)) return false
  atomicJson(paths.result, { code: 1, stdout: '', stderr: '', error: 'receipt_writer_interrupted',
    classification: { failure_class: 'transient-infrastructure', recovery_action: 'wait-external', component: 'worker-transport' },
    finished_at: new Date().toISOString() })
  return true
}
// An old outer runner can be alive in waitReceipt after its inner writer died
// before spawn. Stop only that PID-stamped task invocation; Dot replays the same
// reserved execution through its normal infrastructure-generation mechanism.
export function recoverInterruptedHandoff(root, operationId, outerPaths) {
  const base = path.join(root, createHash('sha256').update(`${operationId}:codex`).digest('hex'))
  if (!existsSync(base)) return false
  const generations = readdirSync(base).filter(n => /^\d+$/.test(n)).map(Number).sort((a,b)=>a-b)
  if (!generations.length) return false
  const inner = receiptPaths(root, `${operationId}:codex`, generations.at(-1))
  const state = readJson(inner.state)
  if (state?.child || !interruptedReceipt(inner)) return false
  const outer = readJson(outerPaths.state)
  if (receiptProcessAlive(outer?.child)) {
    // The invocation is detached, but kill just it (never another worker group).
    try { process.kill(outer.child.pid, 'SIGTERM') } catch (error) { if(error.code !== 'ESRCH') throw error }
  }
  settleInterruptedReceipt(inner)
  return true
}
export function startReceipt(paths, request, env = process.env) {
  if (existsSync(paths.result)) return { started: false, settled: true }
  const previous = readJson(paths.state)
  if (receiptProcessAlive(previous?.child)) return { started: false, child_alive: true }
  if (settleInterruptedReceipt(paths)) return { started: false, settled: true }
  if (receiptProcessAlive(previous) || receiptLocked(paths)) return { started: false, writer_alive: true }
  // Kernel flock, held across spawn and receipt write, prevents duplicate children.
  // A crashed process releases it; PID+boot process start stamp is only advisory.
  if (!existsSync(paths.request)) atomicJson(paths.request, request)
  const child = spawn('flock', ['-n', paths.lock, process.execPath, self, '--worker', paths.dir], {
    cwd: request.cwd, detached: true, stdio: 'ignore', env,
  })
  child.on('error', error => {
    atomicJson(paths.result, { code: 1, stdout: '', stderr: '', error: error.code ?? 'worker_launcher_failed',
      classification: { failure_class: 'transient-infrastructure', recovery_action: 'wait-external', component: 'worker-transport' }, finished_at: new Date().toISOString() })
  })
  child.unref()
  return { started: true, pid: child.pid }
}
export function receiptLocked(paths) {
  return spawnSync('flock', ['-n', paths.lock, 'true'], { stdio: 'ignore' }).status !== 0
}
export function waitReceipt(paths, timeout = 75 * 60_000) {
  const start = Date.now()
  while (Date.now() - start < timeout) {
    settleInterruptedReceipt(paths)
    const result = readJson(paths.result)
    if (result) return result
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 100)
  }
  return { code: 1, stdout: '', stderr: '', error: 'durable_operation_pending' }
}
export function durableExecute(root, key, program, args, options = {}) {
  ;({ args, options } = stdinPromptRequest(program, args, options))
  let generation = 0
  for (;;) {
    const paths = receiptPaths(root, key, generation)
    const settled = readJson(paths.result)
    // Failed process invocations are immutable receipts. Retry as a new INFRA
    // generation, never a new product execution. Successful output is replayed.
    if (settled && settled.code !== 0 && options.retryProcessFailure && workerProcessClassification(settled).failure_class!=='operator-wait') { generation++; continue }
    startReceipt(paths, { program, args, cwd: options.cwd, timeout: options.timeout, input: options.input }, options.env)
    return waitReceipt(paths, options.timeout ? options.timeout + 60_000 : undefined)
  }
}

if (process.argv[2] === '--worker') {
  const dir = process.argv[3]
  const resultPath = path.join(dir, 'result.json')
  if (!existsSync(resultPath)) {
    const request = readJson(path.join(dir, 'request.json'))
    atomicJson(path.join(dir, 'state.json'), { pid: process.pid, start_stamp: processStamp(process.pid), started_at: new Date().toISOString() })
    let child, timer, heartbeatTimer, error = null, stdout = '', stderr = '', settled = false
    const identity={pid:process.pid,start_stamp:processStamp(process.pid),started_at:new Date().toISOString(),worker_state:'spawning',heartbeat_at:new Date().toISOString(),deadline_at:request.timeout?new Date(Date.now()+request.timeout).toISOString():null}
    const heartbeat=()=>{identity.heartbeat_at=new Date().toISOString();try{atomicJson(path.join(dir,'state.json'),identity)}catch{/* result receipt remains the lifecycle authority */}}
    const finish = (code, failure = error) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      clearInterval(heartbeatTimer)
      identity.worker_state='exited';identity.exit_code=typeof code==='number'?code:1;heartbeat()
      atomicJson(resultPath, { code: typeof code === 'number' ? code : 1, stdout: stdout.trim(), stderr: stderr.trim(), error: failure,
        ...(failure ? { classification: { failure_class: 'transient-infrastructure', recovery_action: 'wait-external', component: 'worker-transport' } } : {}),
        finished_at: new Date().toISOString() })
    }
    try {
      // Also normalizes immutable legacy requests when re-entered after restart.
      const normalized = stdinPromptRequest(request.program, request.args, { input: request.input })
      child = spawn(request.program, normalized.args, { cwd: request.cwd, env: process.env, detached: true, stdio: ['pipe', 'pipe', 'pipe'] })
      if(child.pid)identity.child={pid:child.pid,start_stamp:processStamp(child.pid)}
      identity.worker_state=child.pid?'running':'spawning';heartbeat();heartbeatTimer=setInterval(heartbeat,5000)
      const maxBytes = 50 * 1024 * 1024
      child.stdout.on('data', chunk => { stdout = (stdout + chunk).slice(-maxBytes); identity.last_output_at=new Date().toISOString() })
      child.stderr.on('data', chunk => { stderr = (stderr + chunk).slice(-maxBytes); identity.last_output_at=new Date().toISOString() })
      child.on('error', value => { finish(1, value.code ?? 'worker_spawn_failed') })
      child.stdin.on('error', value => { error = value.code ?? 'worker_stdin_failed' })
      child.on('close', code => { finish(code) })
      if (request.timeout) timer = setTimeout(() => {
        error = 'ETIMEDOUT'
        try { process.kill(-child.pid, 'SIGKILL') } catch { /* already exited */ }
      }, request.timeout)
      child.stdin.end(normalized.options.input ?? '')
    }
    catch (value) {
      // spawn() can throw E2BIG synchronously, before a ChildProcess exists.
      // Error code only: messages may include arguments or sensitive content.
      finish(1, value.code ?? 'worker_spawn_failed')
    }
  }
}
