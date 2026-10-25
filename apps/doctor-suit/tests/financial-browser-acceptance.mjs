// Only called inside the existing owned actual-provider browser lifecycle. No credential artifacts.
import { spawn, execFileSync } from 'node:child_process'
export async function verifyM6QuoteBrowser({ root, fixture }) {
  if (fixture.origin !== 'http://127.0.0.1:4341' || fixture.api !== 'http://127.0.0.1:65321' || !Array.isArray(fixture.storageState?.cookies)) throw Error('Owned financial browser fixture required')
  const sourceHead = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim()
  if (!/^[a-f0-9]{40}$/.test(sourceHead)) throw Error('Financial browser source binding invalid')
  const result = await new Promise(resolve => {
    let output = '', finished = false
    const child = spawn('pnpm', ['exec', 'playwright', 'test', '-c', 'apps/doctor-suit/tests/e2e/playwright.financial.config.ts'], { cwd: root, env: { ...process.env, DOCTOR_FINANCIAL_ACCEPTANCE: 'owned-actual-provider', DOCTOR_FINANCIAL_SOURCE_HEAD: sourceHead, DOCTOR_FINANCIAL_FIXTURE: JSON.stringify(fixture) }, detached: true, stdio: ['ignore', 'pipe', 'pipe'] })
    const kill = () => { try { process.kill(-child.pid, 'SIGKILL') } catch { /* Owned child already exited. */ } }
    const timer = setTimeout(kill, 180000)
    const finish = code => { if (finished) return; finished = true; clearTimeout(timer); kill(); resolve({ code, output }) }
    child.stdout.on('data', bytes => { if (output.length + bytes.length > 1048576) kill(); else output += bytes.toString() })
    child.stderr.resume() // Never publish raw runner/Auth/DOM failure text.
    child.once('error', () => finish(-1)); child.once('close', code => finish(code))
  })
  let receipt
  try { receipt = JSON.parse(result.output.trim().split('\n').findLast(line => line.startsWith('{"kind":"doctor-financial-browser/v1"'))) } catch { throw Error('Financial browser redacted receipt unavailable') }
  if (receipt.source_head !== sourceHead || receipt.task !== 'DOS-M6-003' || receipt.cases?.length !== 2 || new Set(receipt.cases.map(c => c.id)).size !== 2 || receipt.cases.some(c => !['DOS-M6-003-C02-EN', 'DOS-M6-003-C02-AR'].includes(c.id))) throw Error('Financial browser receipt binding invalid')
  console.log(JSON.stringify(receipt))
  if (result.code !== 0 || receipt.status !== 'passed' || receipt.cases.some(c => c.status !== 'passed')) throw Error('Owned M6 quote browser assertions failed')
}
