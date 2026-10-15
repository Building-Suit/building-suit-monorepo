import test from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync, spawnSync } from 'node:child_process'
import { mkdtempSync, readFileSync, writeFileSync, mkdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createCatalog } from './publisher.mjs'

const workflow = readFileSync(new URL('../../.github/workflows/releases.yml', import.meta.url), 'utf8')
// Execute the actual workflow guard in isolated Git histories; never invoke a publisher or hosted endpoint.
const block = workflow.match(/ {6}- name: Check publisher adoption on the checked-out protected branch\n[\s\S]*? {8}run: \|\n([\s\S]*?)(?= {6}- uses: actions\/setup-node@v4)/)?.[1]
assert.ok(block, 'Publisher adoption must run before Node setup and publishing')
const guard = block.split('\n').filter(Boolean).map(line => line.slice(10)).join('\n')
function fixture(run) {
  const cwd = mkdtempSync(join(tmpdir(), 'release-adoption-'))
  const git = (...args) => execFileSync('git', args, { cwd, encoding: 'utf8', stdio: 'pipe' }).trim()
  const output = join(cwd, 'github-output')
  const check = () => {
    writeFileSync(output, '')
    const result = spawnSync('bash', ['-e', '-c', guard], { cwd, encoding: 'utf8', env: { ...process.env, GITHUB_OUTPUT: output } })
    return { ...result, outputs: readFileSync(output, 'utf8') }
  }
  try {
    git('init', '-q'); git('config', 'user.email', 'release-adoption@example.invalid'); git('config', 'user.name', 'Disposable release test')
    git('commit', '-q', '--allow-empty', '-m', 'Branch before publisher adoption')
    run({ cwd, git, check })
  } finally { rmSync(cwd, { recursive: true, force: true }) }
}
function addPublisher(cwd, git) {
  mkdirSync(join(cwd, 'tooling/releases'), { recursive: true })
  writeFileSync(join(cwd, 'tooling/releases/publisher.mjs'), 'throw new Error("Guard must never execute the publisher")\n')
  git('add', 'tooling/releases/publisher.mjs'); git('commit', '-qm', 'Adopt publisher')
}
test('a protected branch that never adopted the publisher exits with an explicit no-publication outcome', () => fixture(({ cwd, check }) => {
  // An untracked/stale file cannot turn a non-adopted branch into a publishing branch.
  mkdirSync(join(cwd, 'tooling/releases'), { recursive: true })
  writeFileSync(join(cwd, 'tooling/releases/publisher.mjs'), 'throw new Error("Must not execute")\n')
  const result = check()
  assert.equal(result.status, 0); assert.equal(result.outputs, 'adopted=false\n')
  assert.match(result.stdout, /has not adopted.*no publication was attempted/)
  assert.equal((workflow.match(/if: steps\.publisher\.outputs\.adopted == 'true'/g) || []).length, 2, 'Both Node setup and the real publisher remain conditional')
}))
test('an adopted branch continues to the unchanged configuration/readiness boundary and still rejects empty configuration', () => fixture(({ cwd, git, check }) => {
  addPublisher(cwd, git)
  const result = check()
  assert.equal(result.status, 0); assert.equal(result.outputs, 'adopted=true\n')
  assert.throws(() => createCatalog(undefined, undefined, 'lwecnmsosfwovlzxauml'), /Verified catalog environment binding required/)
  assert.throws(() => createCatalog('https://lwecnmsosfwovlzxauml.supabase.co', undefined, 'lwecnmsosfwovlzxauml'), /Server publishing credential required/)
}))
test('removing a previously adopted publisher fails rather than masquerading as a pre-adoption branch', () => fixture(({ cwd, git, check }) => {
  addPublisher(cwd, git)
  git('rm', '-q', 'tooling/releases/publisher.mjs'); git('commit', '-qm', 'Remove publisher')
  const result = check()
  assert.notEqual(result.status, 0); assert.equal(result.outputs, '')
  assert.match(result.stdout, /previously adopted.*entrypoint is missing/)
}))
