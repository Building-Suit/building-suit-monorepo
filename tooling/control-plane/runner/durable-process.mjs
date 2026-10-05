import { spawn, spawnSync } from 'node:child_process'
import { mkdirSync, readFileSync, writeFileSync, renameSync, existsSync } from 'node:fs'
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
    return stat.slice(stat.lastIndexOf(')') + 2).split(' ')[19]
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
export function startReceipt(paths, request, env = process.env) {
  if (existsSync(paths.result)) return { started: false, settled: true }
  const previous = readJson(paths.state)
  if (receiptProcessAlive(previous?.child)) return { started: false, child_alive: true }
  if (previous?.child && !receiptProcessAlive(previous) && !receiptLocked(paths)) {
    atomicJson(paths.result, { code: 1, stdout: '', stderr: '', error: 'receipt_writer_interrupted', finished_at: new Date().toISOString() })
    return { started: false, settled: true }
  }
  // Kernel flock, held across spawn and receipt write, prevents duplicate children.
  // A crashed process releases it; PID+boot process start stamp is only advisory.
  if (!existsSync(paths.request)) atomicJson(paths.request, request)
  const child = spawn('flock', ['-n', paths.lock, process.execPath, self, '--worker', paths.dir], {
    cwd: request.cwd, detached: true, stdio: 'ignore', env,
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
    const result = readJson(paths.result)
    if (result) return result
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 100)
  }
  return { code: 1, stdout: '', stderr: '', error: 'durable_operation_pending' }
}
export function durableExecute(root, key, program, args, options = {}) {
  let generation = 0
  for (;;) {
    const paths = receiptPaths(root, key, generation)
    const settled = readJson(paths.result)
    // Failed process invocations are immutable receipts. Retry as a new INFRA
    // generation, never a new product execution. Successful output is replayed.
    if (settled && settled.code !== 0 && options.retryProcessFailure) { generation++; continue }
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
    const child = spawn(request.program, request.args, { cwd: request.cwd, env: process.env, detached: true, stdio: ['pipe', 'pipe', 'pipe'] })
    atomicJson(path.join(dir, 'state.json'), { pid: process.pid, start_stamp: processStamp(process.pid), child: { pid: child.pid, start_stamp: processStamp(child.pid) }, started_at: new Date().toISOString() })
    let stdout = '', stderr = '', error = null
    let timer
    const maxBytes = 50 * 1024 * 1024
    child.stdout.on('data', chunk => { stdout = (stdout + chunk).slice(-maxBytes) })
    child.stderr.on('data', chunk => { stderr = (stderr + chunk).slice(-maxBytes) })
    child.on('error', value => { error = value.message })
    if (request.timeout) timer = setTimeout(() => {
      error = 'ETIMEDOUT'
      try { process.kill(-child.pid, 'SIGKILL') } catch { /* already exited */ }
    }, request.timeout)
    child.stdin.end(request.input ?? '')
    child.on('close', code => {
      clearTimeout(timer)
      atomicJson(resultPath, { code: typeof code === 'number' ? code : 1, stdout: stdout.trim(), stderr: stderr.trim(), error, finished_at: new Date().toISOString() })
    })
  }
}
