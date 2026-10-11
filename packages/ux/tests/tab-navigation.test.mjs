import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import ts from 'typescript'
const source = readFileSync(new URL('../src/tabNavigation.ts', import.meta.url), 'utf8')
const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext } }).outputText
const { tabNavigationTarget: target } = await import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}`)
test('tab navigation wraps, respects direction and ignores unrelated keys', () => {
  const keys = ['members', 'roles', 'invitations']
  assert.equal(target(keys, 'invitations', 'ArrowRight'), 'members')
  assert.equal(target(keys, 'members', 'ArrowLeft'), 'invitations')
  assert.equal(target(keys, 'members', 'ArrowLeft', 'rtl'), 'roles')
  assert.equal(target(keys, 'roles', 'Home'), 'members')
  assert.equal(target(keys, 'roles', 'End'), 'invitations')
  assert.equal(target(keys, 'roles', 'Enter'), undefined)
  assert.equal(target([], 'roles', 'Home'), undefined)
})
