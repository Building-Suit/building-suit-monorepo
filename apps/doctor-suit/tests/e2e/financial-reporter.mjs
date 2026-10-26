// Only fixed case IDs/status/source metadata. No errors, DOM, attachments, form values or Auth state.
export default class FinancialReporter {
  cases = []
  onTestEnd(test, result) {
    const id = test.title.match(/^DOS-M6-(?:003-C02|004-C01|006-C02)-(EN|AR)$/)?.[0] ?? 'unexpected-case'
    const phases = ['fixture', 'source_binding', 'context', 'route', 'notice_row', 'quote_identity', 'money', 'direction_and_viewport', 'review_history', 'entitlement', 'price_create', 'charge_create', 'price_change', 'charge_history', 'read_only']
    const phase = (test.annotations ?? []).filter(a => a.type === 'financial-stage' && phases.includes(a.description)).at(-1)?.description ?? 'unknown'
    const match = (result.error?.stack ?? '').match(/(dos-m6-00[346]\.spec\.ts):(\d+):(\d+)/)
    this.cases.push({ id, status: ['passed', 'failed', 'timedOut', 'skipped', 'interrupted'].includes(result.status) ? result.status : 'unknown', phase, ...(match ? { source_location: { file: match[1], line: Number(match[2]), column: Number(match[3]) } } : {}) })
  }
  onEnd(result) {
    for (const task of ['DOS-M6-003', 'DOS-M6-004', 'DOS-M6-006']) {
      const cases = this.cases.filter(c => c.id.startsWith(task + '-') || c.id === 'unexpected-case')
      if (!cases.length) continue
      console.log(JSON.stringify({ kind: 'doctor-financial-browser/v1', task, source_head: process.env.DOCTOR_FINANCIAL_SOURCE_HEAD, status: cases.every(c => c.status === 'passed') ? 'passed' : result.status === 'passed' ? 'failed' : result.status, cases, actual_service: true, synthetic_only: true, clinical_approval: false, live_payment_acceptance: false }))
    }
  }
}
