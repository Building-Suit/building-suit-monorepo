// Only fixed case IDs/status/source metadata. No errors, DOM, attachments, form values or Auth state.
export default class FinancialReporter {
  cases = []
  onTestEnd(test, result) {
    const id = test.title.match(/^DOS-M6-(?:003-C02|004-C01|006-C02|007-C03|009-C02)-(EN|AR)$/)?.[0] ?? 'unexpected-case'
    const phases = ['fixture', 'source_binding', 'context', 'route', 'notice_row', 'notice_detail', 'report_totals', 'report_source', 'report_refunds', 'report_read_only', 'quote_identity', 'money', 'direction_and_viewport', 'review_history', 'entitlement', 'price_create','price_button','price_form','price_save','price_saved', 'charge_create', 'price_change', 'charge_history', 'read_only', 'collection_prepare', 'payment_unknown', 'payment_reconcile', 'refund_prepare', 'refund_failure', 'money_read_only']
    const phase = (test.annotations ?? []).filter(a => a.type === 'financial-stage' && phases.includes(a.description)).at(-1)?.description ?? 'unknown'
    const match = (result.error?.stack ?? '').match(/(dos-m6-00[34679]\.spec\.ts):(\d+):(\d+)/)
    let diagnostic
    try { const raw=JSON.parse(test.annotations.filter(a=>a.type==='financial-notice-diagnostic').at(-1)?.description??'null'), allowed=['controller_present','ready','loading','pending','uncertain','selected_present','selected_resolves','has_rows','capture_unavailable','selected_location','has_locations','has_board','can_write','price_open','charge_open'];if(raw&&typeof raw==='object'&&!Array.isArray(raw)){diagnostic={};for(const k of allowed)if(typeof raw[k]==='boolean')diagnostic[k]=raw[k];if(['denied','network','invalid','session','stale','inactive','other','none'].includes(raw.error))diagnostic.error=raw.error;if(['preview','trial','paid','expired','suspended','unconfigured','grace','other'].includes(raw.entitlement))diagnostic.entitlement=raw.entitlement} }catch{ /* No raw annotations or error text are published. */ }
    this.cases.push({ ...(diagnostic?{diagnostic}:{}), id, status: ['passed', 'failed', 'timedOut', 'skipped', 'interrupted'].includes(result.status) ? result.status : 'unknown', phase, ...(match ? { source_location: { file: match[1], line: Number(match[2]), column: Number(match[3]) } } : {}) })
  }
  onEnd(result) {
    for (const task of ['DOS-M6-003', 'DOS-M6-004', 'DOS-M6-006', 'DOS-M6-007', 'DOS-M6-009']) {
      const cases = this.cases.filter(c => c.id.startsWith(task + '-') || c.id === 'unexpected-case')
      if (!cases.length) continue
      console.log(JSON.stringify({ kind: 'doctor-financial-browser/v1', task, source_head: process.env.DOCTOR_FINANCIAL_SOURCE_HEAD, status: cases.every(c => c.status === 'passed') ? 'passed' : result.status === 'passed' ? 'failed' : result.status, cases, actual_service: true, synthetic_only: true, clinical_approval: false, live_payment_acceptance: false }))
    }
  }
}
