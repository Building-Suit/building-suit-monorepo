// Only fixed case IDs/status/source metadata. No errors, DOM, attachments, form values or Auth state.
export default class FinancialReporter {
  cases = []
  onTestEnd(test, result) {
    const id = test.title.match(/^DOS-M6-003-C02-(EN|AR)$/)?.[0] ?? 'unexpected-case'
    this.cases.push({ id, status: ['passed', 'failed', 'timedOut', 'skipped', 'interrupted'].includes(result.status) ? result.status : 'unknown' })
  }
  onEnd(result) {
    console.log(JSON.stringify({ kind: 'doctor-financial-browser/v1', task: 'DOS-M6-003', source_head: process.env.DOCTOR_FINANCIAL_SOURCE_HEAD, status: result.status, cases: this.cases, actual_service: true, synthetic_only: true, clinical_approval: false, live_payment_acceptance: false }))
  }
}
