import type { Reporter, TestCase, TestResult } from '@playwright/test/reporter'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
/** Every record is tied to an actually passing browser test, rather than source-name inference. */
export default class AtomicRouteCoverageReporter implements Reporter {
 private cases: { title: string; routes: { suit: string; path: string }[]; shells: object[] }[] = []
 private failures: string[] = []
 private skipped: string[] = []
 onTestEnd(test: TestCase, result: TestResult) {
  if (result.status === 'skipped') { this.skipped.push(test.titlePath().join(' / ')); return }
  if (result.status !== 'passed') { this.failures.push(test.titlePath().join(' / ')); return }
  this.cases.push({ title: test.titlePath().join(' / '), routes: test.annotations.filter(item => item.type === 'verified-route' && item.description).map(item => JSON.parse(item.description!)), shells: test.annotations.filter(item => item.type === 'verified-shell' && item.description).map(item => JSON.parse(item.description!)) })
 }
 async onEnd() {
  const directory = path.resolve('.local/atomic-template-evidence/route-coverage')
  await mkdir(directory, { recursive: true })
  const name = process.env.BS_ROUTE_COVERAGE_RUN ?? 'browser'
  if (!/^[a-z0-9-]+$/.test(name)) throw new Error('Invalid route coverage run name')
  await writeFile(path.join(directory, `${name}.json`), JSON.stringify({ cases: this.cases, failures: this.failures, skipped: this.skipped }, null, 2) + '\n')
 }
}
