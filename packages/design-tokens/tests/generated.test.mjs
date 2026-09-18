import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
const css = readFileSync(new URL('../generated/tokens.css', import.meta.url), 'utf8')
const declarations = [...css.matchAll(/(--bs-[\w-]+):\s*([^;]+);/g)]
const names = new Set(declarations.map(match => match[1]))
test('generated CSS references existing variables and has no direct self-reference', () => {
  for (const [,name,value] of declarations) for (const [,reference] of value.matchAll(/var\((--bs-[\w-]+)/g)) {
    assert.ok(names.has(reference), `${name} refers to undefined ${reference}`)
    assert.notEqual(name, reference, `${name} is cyclic`)
  }
})
test('canonical radii survive generation without an overriding cyclic alias', () => {
  assert.deepEqual(declarations.filter(match => match[1] === '--bs-radius-card').map(match => match[2]), ['16px'])
  assert.deepEqual(declarations.filter(match => match[1] === '--bs-radius-modal').map(match => match[2]), ['24px'])
})
