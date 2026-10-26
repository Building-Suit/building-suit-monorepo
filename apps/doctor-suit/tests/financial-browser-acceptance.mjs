// Only called inside the existing owned actual-provider browser lifecycle. No credential artifacts.
import { spawn, execFileSync } from 'node:child_process'
export async function verifyM6FinancialBrowser({ root, fixture }) {
  if (fixture.origin !== 'http://127.0.0.1:4341' || fixture.api !== 'http://127.0.0.1:65321' || !Array.isArray(fixture.storageState?.cookies)) throw Error('Owned financial browser fixture required')
  const sourceHead = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim()
  if (!/^[a-f0-9]{40}$/.test(sourceHead)) throw Error('Financial browser source binding invalid')
  const result = await new Promise(resolve => {
    let output = '', finished = false
    const child = spawn('pnpm', ['exec', 'playwright', 'test', '-c', 'apps/doctor-suit/tests/e2e/playwright.financial.config.ts'], { cwd: root, env: { ...process.env, DOCTOR_FINANCIAL_ACCEPTANCE: 'owned-actual-provider', DOCTOR_FINANCIAL_SOURCE_HEAD: sourceHead, DOCTOR_FINANCIAL_FIXTURE: JSON.stringify(fixture) }, detached: true, stdio: ['ignore', 'pipe', 'pipe'] })
    const kill = () => { try { process.kill(-child.pid, 'SIGKILL') } catch { /* Owned child already exited. */ } }
    const timer = setTimeout(kill, 390000) // Six unchanged 60-second cases plus bounded runner startup/cleanup.
    const finish = code => { if (finished) return; finished = true; clearTimeout(timer); kill(); resolve({ code, output }) }
    child.stdout.on('data', bytes => { if (output.length + bytes.length > 1048576) kill(); else output += bytes.toString() })
    child.stderr.resume() // Never publish raw runner/Auth/DOM failure text.
    child.once('error', () => finish(-1)); child.once('close', code => finish(code))
  })
  let receipts
  try { receipts = result.output.trim().split('\n').filter(line => line.startsWith('{"kind":"doctor-financial-browser/v1"')).map(line => JSON.parse(line)) } catch { throw Error('Financial browser redacted receipt unavailable') }
  if (receipts.length !== 3 || new Set(receipts.map(r => r.task)).size !== 3) throw Error('Financial browser task receipts missing or duplicated')
  for (const task of ['DOS-M6-003', 'DOS-M6-004', 'DOS-M6-006']) {
    const receipt = receipts.find(r => r.task === task), caseId = task === 'DOS-M6-004' ? 'C01' : 'C02'
    if (!receipt || receipt.source_head !== sourceHead || receipt.cases?.length !== 2 || new Set(receipt.cases.map(c => c.id)).size !== 2 || receipt.cases.some(c => ![`${task}-${caseId}-EN`, `${task}-${caseId}-AR`].includes(c.id))) throw Error('Financial browser receipt binding invalid')
    console.log(JSON.stringify(receipt))
  }
  if (result.code !== 0 || receipts.some(r => r.status !== 'passed' || r.cases.some(c => c.status !== 'passed'))) throw Error('Owned M6 financial browser assertions failed')
}
