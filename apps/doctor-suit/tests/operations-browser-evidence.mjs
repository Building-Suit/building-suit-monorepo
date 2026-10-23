// Only fixed task IDs and diagnostic categories leave the private browser report.
export const doctorOperationsTaskIds = Object.freeze(
  Array.from({length: 10}, (_, index) => `DOS-M3-${String(index + 1).padStart(3, '0')}`),
)

function failureLocation(task, result) {
  const value = result?.errorLocation
  const file = typeof value?.file === 'string' ? value.file.split(/[\\/]/).at(-1) : ''
  const allowed = [`${task.toLowerCase()}.spec.ts`, 'operations-actual-fixture.ts']
  if (!allowed.includes(file) || !Number.isSafeInteger(value.line) || value.line < 1 || value.line > 100000 ||
      !Number.isSafeInteger(value.column) || value.column < 1 || value.column > 100000) return null
  return {file, line: value.line, column: value.column}
}

function failureCategory(result) {
  const message = typeof result?.error?.message === 'string' ? result.error.message.replace(/\u001b\[[0-9;]*m/g, '') : ''
  for (const [pattern, category] of [
    [/strict mode violation/, 'locator-ambiguous'],
    [/not attached to the DOM|element was detached/i, 'locator-detached'],
    [/scrollIntoViewIfNeeded/, 'scroll-into-view'], [/screenshot/, 'screenshot'],
    [/toBeVisible\(\)/, 'locator-visible'], [/toBeEnabled\(\)/, 'locator-enabled'],
    [/toHaveCount\(/, 'locator-count'], [/toBeNull\(\)/, 'null-value'],
    [/toEqual\(|toBe\(/, 'value-equality'], [/Timeout|timed out/i, 'timeout'],
  ]) if (pattern.test(message)) return category
  return 'assertion-or-runtime'
}

function scrollGeometry(task,test){
 if(task!=='DOS-M3-003'||!Array.isArray(test?.annotations))return null
 const annotation=test.annotations.find(value=>value?.type==='doctor-scroll-geometry')
 if(typeof annotation?.description!=='string'||annotation.description.length>512)return null
 try{
  const value=JSON.parse(annotation.description)
  if(!value||Object.keys(value).sort().join(',')!=='clientWidth,dark,left,rtl,scrollWidth,width'||
   !Number.isSafeInteger(value.clientWidth)||value.clientWidth<1||value.clientWidth>1000000||
   !Number.isSafeInteger(value.scrollWidth)||value.scrollWidth<value.clientWidth||value.scrollWidth>1000000||
   !Number.isFinite(value.left)||Math.abs(value.left)>value.scrollWidth||![390,1280].includes(value.width)||
   typeof value.rtl!=='boolean'||typeof value.dark!=='boolean')return null
  return{clientWidth:value.clientWidth,scrollWidth:value.scrollWidth,left:Math.round(value.left*1000)/1000,width:value.width,rtl:value.rtl,dark:value.dark}
 }catch{return null}
}

export function doctorOperationsBrowserEvidence(report, exitCode) {
  const issues = new Set()
  const passed = new Set()
  const seen = new Set()
  const failed = []
  if (exitCode !== 0) issues.add('browser-process-failed')
  if (!report || !Array.isArray(report.suites) || !Array.isArray(report.errors)) {
    return {accepted: false, expected: doctorOperationsTaskIds, passed: [], failed: [], issues: ['browser-report-invalid']}
  }
  if (report.errors.length) issues.add('browser-global-error')
  const stats = report.stats
  if (!stats || stats.expected !== doctorOperationsTaskIds.length || stats.unexpected !== 0 || stats.flaky !== 0 || stats.skipped !== 0) {
    issues.add('browser-population-not-passed')
  }
  function visit(suites) {
    for (const suite of suites) {
      if (!suite || !Array.isArray(suite.specs) || (suite.suites !== undefined && !Array.isArray(suite.suites))) {
        issues.add('browser-report-invalid')
        continue
      }
      for (const spec of suite.specs) {
        const task = typeof spec?.title === 'string' ? /^DOS-M3-\d{3}(?=:)/.exec(spec.title)?.[0] : undefined
        if (!doctorOperationsTaskIds.includes(task)) {
          issues.add('browser-task-unexpected')
          continue
        }
        if (seen.has(task)) issues.add('browser-task-duplicate')
        seen.add(task)
        const filename = typeof spec.file === 'string' ? spec.file.split(/[\\/]/).at(-1) : ''
        if (filename !== `${task.toLowerCase()}.spec.ts`) issues.add('browser-task-file-mismatch')
        const test = spec.tests?.[0]
        const result = test?.results?.[0]
        if (spec.ok !== true || !Array.isArray(spec.tests) || spec.tests.length !== 1 || test?.expectedStatus !== 'passed' || test?.status !== 'expected' ||
            test.results?.length !== 1 || result?.status !== 'passed' || result?.retry !== 0 || !Array.isArray(result?.errors) || result.errors.length) {
          issues.add('browser-task-not-passed-once')
          const geometry=scrollGeometry(task,test)
          failed.push({task, category: failureCategory(result), location: failureLocation(task, result),...(geometry?{geometry}:{})})
        } else {
          passed.add(task)
        }
      }
      visit(suite.suites ?? [])
    }
  }
  visit(report.suites)
  if (doctorOperationsTaskIds.some(task => !seen.has(task))) issues.add('browser-task-missing')
  return {accepted: issues.size === 0, expected: doctorOperationsTaskIds, passed: doctorOperationsTaskIds.filter(task => passed.has(task)), failed, issues: [...issues].sort()}
}
