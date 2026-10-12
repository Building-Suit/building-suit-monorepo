import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { parsePullRequestLines } from '../github.mjs'

test('paginated PR observations retain every page with older gh and fail closed on malformed output', () => {
  const rows = [1, 2, 101].map(number => ({ number, head: { ref: `codex/shared/${number}` }, base: { ref: 'stg' } }))
  assert.deepEqual(parsePullRequestLines(rows.map(JSON.stringify).join('\n') + '\n'), rows)
  assert.deepEqual(parsePullRequestLines(''), [])
  assert.throws(() => parsePullRequestLines('{"number":1}'), /invalid_paginated/)
  assert.throws(() => parsePullRequestLines('not json'))
  const preflight = readFileSync(new URL('../preflight.mjs', import.meta.url), 'utf8')
  assert.ok(preflight.includes('refs/heads/stg:refs/remotes/origin/stg'))
})
