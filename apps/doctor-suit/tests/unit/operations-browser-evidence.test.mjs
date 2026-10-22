import test from 'node:test'
import assert from 'node:assert/strict'
import {doctorOperationsBrowserEvidence as evidence, doctorOperationsTaskIds} from '../operations-browser-evidence.mjs'

function report() {
  return {
    stats: {expected: 10, unexpected: 0, flaky: 0, skipped: 0}, errors: [],
    suites: [{specs: [], suites: doctorOperationsTaskIds.map(task => ({specs: [{
      title: `${task}: synthetic actual-service journey`, file: `/fixture/${task.toLowerCase()}.spec.ts`, ok: true,
      tests: [{expectedStatus: 'passed', status: 'expected', results: [{status: 'passed', retry: 0, errors: []}]}],
    }]}))}],
  }
}
const spec = (value, index = 0) => value.suites[0].suites[index].specs[0]

test('accepts exactly ten independently passed M3 journeys in nested Playwright JSON', () => {
  const result = evidence(report(), 0)
  assert.equal(result.accepted, true)
  assert.deepEqual(result.passed, doctorOperationsTaskIds)
  assert.deepEqual(result.issues, [])
})

test('a successful process and misleading aggregate count cannot hide missing or duplicate tasks', () => {
  for (const mutate of [
    value => value.suites[0].suites.pop(),
    value => {value.suites[0].suites[9] = structuredClone(value.suites[0].suites[0])},
    value => {spec(value).title = 'DOS-M3-099: unexpected'},
    value => {spec(value).file = '/fixture/unrelated.spec.ts'},
  ]) {
    const value = report(); mutate(value)
    assert.equal(evidence(value, 0).accepted, false)
  }
})

test('skips, failures, interruptions and expected failures cannot count as passed', () => {
  for (const status of ['skipped', 'failed', 'timedOut', 'interrupted']) {
    const value = report(); spec(value).tests[0].results[0].status = status
    assert.equal(evidence(value, 0).accepted, false)
  }
  const value = report(); spec(value).tests[0].expectedStatus = 'failed'
  assert.equal(evidence(value, 0).accepted, false)
})

test('retries, flaky outcomes and duplicate projects cannot satisfy the exact population', () => {
  for (const mutate of [
    value => {spec(value).tests[0].results[0].retry = 1},
    value => {spec(value).tests[0].results.push({...spec(value).tests[0].results[0]})},
    value => {spec(value).tests[0].status = 'flaky'},
    value => {spec(value).tests.push(structuredClone(spec(value).tests[0]))},
  ]) {
    const value = report(); mutate(value)
    assert.equal(evidence(value, 0).accepted, false)
  }
})

test('nonzero, killed or absent browser processes fail even with a complete report', () => {
  for (const code of [1, null, undefined]) assert.equal(evidence(report(), code).accepted, false)
})

test('aggregate errors, skips and flakiness fail closed', () => {
  for (const key of ['unexpected', 'skipped', 'flaky', 'expected']) {
    const value = report(); value.stats[key]++
    assert.equal(evidence(value, 0).accepted, false)
  }
  const value = report(); value.errors.push({message: 'private sentinel'})
  const result = evidence(value, 0)
  assert.equal(result.accepted, false)
  assert.equal(JSON.stringify(result).includes('private sentinel'), false)
})

test('redacted output never includes arbitrary browser titles, paths or exception bodies', () => {
  const value = report()
  spec(value).title = 'private token sentinel'
  spec(value, 1).tests[0].results[0].errors.push({message: 'private token sentinel'})
  const result = evidence(value, 0)
  assert.equal(result.accepted, false)
  assert.equal(JSON.stringify(result).includes('private token sentinel'), false)
})

test('missing or malformed structured results fail closed', () => {
  for (const value of [null, {}, {suites: [], errors: []}]) assert.equal(evidence(value, 0).accepted, false)
  const value = report(); delete spec(value).tests
  assert.equal(evidence(value, 0).accepted, false)
})

test('failed-case diagnostics expose only fixed categories and allowlisted source coordinates', () => {
  const value = report(), row = spec(value, 5).tests[0].results[0]
  row.status = 'failed'
  row.error = {message: 'expect(locator).toBeVisible() failed: private token sentinel'}
  row.errorLocation = {file: '/private/token/sentinel/dos-m3-006.spec.ts', line: 14, column: 240}
  const result = evidence(value, 1)
  assert.deepEqual(result.failed, [{task: 'DOS-M3-006', category: 'locator-visible', location: {file: 'dos-m3-006.spec.ts', line: 14, column: 240}}])
  assert.equal(JSON.stringify(result).includes('sentinel'), false)
})

test('arbitrary source paths and invalid coordinates cannot enter redacted evidence', () => {
  for (const location of [
    {file: '/private/sentinel.txt', line: 1, column: 1},
    {file: 'dos-m3-006.spec.ts', line: 'private sentinel', column: 1},
    {file: 'dos-m3-006.spec.ts', line: 1, column: -1},
  ]) {
    const value = report(), row = spec(value, 5).tests[0].results[0]
    row.status = 'failed'; row.errorLocation = location
    const result = evidence(value, 1)
    assert.equal(result.failed[0].location, null)
    assert.equal(JSON.stringify(result).includes('sentinel'), false)
  }
})

test('ANSI-coloured Playwright matchers remain fixed diagnostic categories', () => {
  const value = report(), row = spec(value, 5).tests[0].results[0]
  row.status = 'failed'; row.error = {message: 'expect(value).\u001b[31mtoBe\u001b[39m(true): private sentinel'}
  const result = evidence(value, 1)
  assert.equal(result.failed[0].category, 'value-equality')
  assert.equal(JSON.stringify(result).includes('sentinel'), false)
})
