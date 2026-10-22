// Only fixed task IDs and diagnostic categories leave the private browser report.
export const doctorOperationsTaskIds = Object.freeze(
  Array.from({length: 10}, (_, index) => `DOS-M3-${String(index + 1).padStart(3, '0')}`),
)

export function doctorOperationsBrowserEvidence(report, exitCode) {
  const issues = new Set()
  const passed = new Set()
  const seen = new Set()
  if (exitCode !== 0) issues.add('browser-process-failed')
  if (!report || !Array.isArray(report.suites) || !Array.isArray(report.errors)) {
    return {accepted: false, expected: doctorOperationsTaskIds, passed: [], issues: ['browser-report-invalid']}
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
        } else {
          passed.add(task)
        }
      }
      visit(suite.suites ?? [])
    }
  }
  visit(report.suites)
  if (doctorOperationsTaskIds.some(task => !seen.has(task))) issues.add('browser-task-missing')
  return {accepted: issues.size === 0, expected: doctorOperationsTaskIds, passed: doctorOperationsTaskIds.filter(task => passed.has(task)), issues: [...issues].sort()}
}
