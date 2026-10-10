import assert from 'node:assert/strict'
import { readFileSync, existsSync } from 'node:fs'
import test from 'node:test'

const root = new URL('../../../../', import.meta.url)
const matrix = JSON.parse(readFileSync(new URL('apps/shop-suit/tests/launch-qualification.json', root)))

test('first-launch matrix binds every requirement to executable evidence', () => {
  assert.equal(matrix.task, 'SS-VAL-001')
  assert.deepEqual(matrix.requirements.map(r => r.id), Array.from({ length: 13 }, (_, i) => `SS-LAUNCH-R${String(i + 1).padStart(2, '0')}`))
  const names = matrix.commands.map(c => c.name)
  assert.equal(new Set(names).size, names.length)
  for (const requirement of matrix.requirements) {
    assert.ok(requirement.checks.length >= 2)
    for (const check of requirement.checks) assert.ok(names.includes(check), `${requirement.id}: ${check}`)
    for (const path of requirement.implementation_evidence) assert.ok(existsSync(new URL(path, root)), path)
  }
  for (const command of matrix.commands) {
    for (const arg of command.args.filter(a => /\.(?:mjs|ts|sql)$/.test(a))) {
      const path = arg.includes('/') ? `${command.cwd ? command.cwd + '/' : ''}${arg}` : `apps/shop-suit/tests/e2e/${arg}`
      assert.ok(existsSync(new URL(path, root)), arg)
    }
  }
})

test('qualification retains full regression and original browser assertions', () => {
  assert.ok(matrix.commands.some(c => c.program === 'pnpm' && c.args.join(' ') === 'db:test:shop'))
  assert.ok(matrix.commands.some(c => c.program === 'pnpm' && c.args.join(' ') === 'test'))
  assert.ok(matrix.commands.some(c => c.args.join(' ') === 'exec turbo run typecheck lint build --filter=@building-suit/shop-suit'))
  for (const c of matrix.commands.filter(c => c.args.includes('playwright'))) {
    assert.ok(c.args.includes('--workers=1'))
    assert.ok(c.args.includes('--retries=0'))
  }
  const spec = readFileSync(new URL('apps/shop-suit/tests/e2e/ss-val-001-1.spec.ts', root), 'utf8')
  for (const suite of ['team', 'cash-policy', 'fast-pay', 'pos-customer', 'sale-copy', 'realtime']) assert.ok(spec.includes(suite))
  assert.ok(!/test\.(skip|fixme)|\.only\(/.test(spec))
})
