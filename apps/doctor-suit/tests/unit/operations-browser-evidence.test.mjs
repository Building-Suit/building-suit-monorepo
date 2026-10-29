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

test('reception action diagnostics admit only fixed phases, bounded counts and boolean states',()=>{
 const value=report(),entry=spec(value,2),state={phase:'stale-reorder-reason',dialogCount:0,reasonCount:0,reasonDisabled:null,refreshDisabled:false}
 entry.tests[0].results[0].status='failed'
 entry.tests[0].annotations=[{type:'doctor-reception-action-state',description:JSON.stringify(state)}]
 assert.deepEqual(evidence(value,1).failed[0].actionState,state)
 for(const input of [{...state,patient:'private sentinel'},{...state,phase:'private sentinel'},{...state,reasonDisabled:'private sentinel'},{...state,dialogCount:11},{...state,reasonCount:-1},null]){
  entry.tests[0].annotations[0].description=JSON.stringify(input)
  const actual=evidence(value,1);assert.equal('actionState'in actual.failed[0],false);assert.equal(JSON.stringify(actual).includes('private sentinel'),false)
 }
 const other=report(),foreign=spec(other,3);foreign.tests[0].results[0].status='failed';foreign.tests[0].annotations=[{type:'doctor-reception-action-state',description:JSON.stringify(state)}]
 assert.equal('actionState'in evidence(other,1).failed[0],false)
})

test('failed reception retains only bounded numeric geometry and fixed viewport flags',()=>{
 const value=report(),entry=spec(value,2),geometry={clientWidth:330,scrollWidth:1200,left:-868.5,width:390,rtl:true,dark:false}
 entry.tests[0].results[0].status='failed'
 entry.tests[0].annotations=[{type:'doctor-scroll-geometry',description:JSON.stringify(geometry)}]
 assert.deepEqual(evidence(value,1).failed[0].geometry,geometry)
 for(const input of [{...geometry,patient:'private sentinel'},{...geometry,left:'private sentinel'},{...geometry,scrollWidth:1000001},{...geometry,width:555},null]){
  entry.tests[0].annotations[0].description=JSON.stringify(input)
  const actual=evidence(value,1);assert.equal('geometry'in actual.failed[0],false);assert.equal(JSON.stringify(actual).includes('private sentinel'),false)
 }
})

test('action diagnostics retain fixed categories without private locator or screenshot text', () => {
  for (const [message, category] of [
    ['locator.scrollIntoViewIfNeeded: strict mode violation: private sentinel', 'locator-ambiguous'],
    ['locator.scrollIntoViewIfNeeded: Element is not attached to the DOM: private sentinel', 'locator-detached'],
    ['locator.scrollIntoViewIfNeeded: private sentinel', 'scroll-into-view'],
    ['locator.screenshot: private sentinel', 'screenshot'],
  ]) {
    const value = report(), result = spec(value).tests[0].results[0]
    result.status = 'failed'; result.error = {message}
    const actual = evidence(value, 1)
    assert.equal(actual.accepted, false)
    assert.equal(actual.failed[0].category, category)
    assert.equal(JSON.stringify(actual).includes('private sentinel'), false)
  }
})

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
