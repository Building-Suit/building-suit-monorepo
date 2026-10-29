// Independent exact-candidate document/contract comparison. No network, SDK, database or official submission.
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { createHash, randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
const started = new Date().toISOString(), argv = process.argv.slice(2)
assert.equal(argv.length, 4, 'Supply exact --base SHA --head SHA')
assert.equal(argv[0], '--base'); assert.equal(argv[2], '--head')
const base = argv[1], head = argv[3]
assert.match(base, /^[a-f0-9]{40}$/); assert.match(head, /^[a-f0-9]{40}$/)
const git = (...args) => execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim()
const root = git('rev-parse', '--show-toplevel'), hash = value => createHash('sha256').update(value).digest('hex')
const source = (revision, file) => execFileSync('git', ['show', `${revision}:${file}`], { cwd: root })
const directory = 'docs/work-packages/doctor-suit/implementation/', packetPath = directory + 'dos-m6-008-packet.json', scriptPath = directory + 'dos-m6-008-verify.mjs'
const assertions = [], inputs = {}
const check = (id, value) => { assertions.push({ id, status: value ? 'passed' : 'failed' }); return Boolean(value) }
function boundSource(file) { const content = source(head, file); inputs[file] = hash(content); check('working-source-matches-candidate:' + file, hash(readFileSync(path.join(root, file))) === inputs[file]); return content }
try {
 check('executing-exact-candidate', git('rev-parse', 'HEAD') === head)
 check('parent-is-ancestor', git('merge-base', base, head) === base)
 boundSource(scriptPath)
 const packet = JSON.parse(boundSource(packetPath).toString())
 boundSource(directory + 'dos-m6-008.md')
 check('canonical-task-decision-and-parent', packet.task_id === 'DOS-M6-008' && packet.decision_id === 'DOS-M6-GATE-TAX' && packet.parent_pr === 495 && packet.parent_head === base)
 check('genuine-approval-not-invented', packet.qualified_applicability_review === null && packet.accountable_reviewer === null && packet.decision_approval === null && packet.task_acceptance === false)
 check('separate-taxpayer-ledgers', packet.businesses?.length === 2 && packet.businesses[0].id === 'saas-operator' && packet.businesses[0].ledger_family === 'doctor_saas_*' && packet.businesses[1].id === 'independent-practice' && packet.businesses[1].ledger_family === 'doctor_practice_*')
 check('entity-and-service-applicability-unavailable', packet.businesses.every(item => ['supplier_legal_entity', 'tax_residence', 'tax_registration', 'customer_classification', 'service_classification', 'approved_applicability', 'approved_official_document_profile'].every(key => item[key] === null)))
 check('no-unverified-official-profile', ['selected_interface', 'selected_type_version', 'verified_enrollment', 'approved_environment', 'credential_custodian', 'signing_authority', 'approved_required_fields', 'official_test_receipt'].every(key => packet.official_profile[key] === null))
 check('dependent-tax-actions-disabled', ['enabled', 'submissions_enabled', 'compliance_claims_enabled', 'official_validation_claimed', 'real_taxpayer_data_allowed', 'credentials_configured', 'production_operations_allowed'].every(key => packet.adapter[key] === false) && packet.adapter.approved_scope === null && packet.adapter.implementation === 'blocked-no-approved-scope')
 check('synthetic-records-never-official-documents', packet.existing_synthetic_documents.practice_receipt_prefix === 'SYN-' && packet.existing_synthetic_documents.eta_document === false && packet.existing_synthetic_documents.legal_invoice_claim === false && packet.existing_synthetic_documents.refund_is_official_return_receipt === false && packet.existing_synthetic_documents.saas_notice_establishes_tax_compliance === false && packet.existing_synthetic_documents.tax_applicability === 'unreviewed' && packet.existing_synthetic_documents.tax_amount === 'unconfigured-not-fabricated-zero')
 check('qualified-review-cases-remain-unavailable', ['DOS-M6-008-C01', 'DOS-M6-008-C02', 'DOS-M6-008-C04'].every(id => packet.case_dispositions[id].startsWith('unavailable-')))
 const hosts = new Set(['sdk.invoicing.eta.gov.eg', 'www.eta.gov.eg'])
 check('public-sources-are-references-only', packet.public_document_sources.length >= 4 && packet.public_document_sources.every(item => { const url = new URL(item.url); return url.protocol === 'https:' && hosts.has(url.hostname) && typeof item.verified_public_observation === 'string' }) && Number.isFinite(Date.parse(packet.public_sources_retrieved_at_utc)))
 const changed = git('diff', '--name-only', base, head).split('\n').filter(Boolean)
 check('no-product-provider-native-or-live-implementation-introduced', changed.length > 0 && changed.every(file => file.startsWith('docs/work-packages/doctor-suit/') || file === 'release-fragments/dos-m6-008.json'))
 for (let n = 1; n <= 9; n++) { const file = `docs/work-packages/doctor-suit/planning-v0.4/DOS-M${n}.json`; inputs[file] = hash(source(head, file)); check(`canonical-packet-${n}-unchanged`, inputs[file] === hash(source(base, file))) }
 const modulePath = 'apps/doctor-suit/app/utils/practiceMoney.ts'
 boundSource(modulePath)
 for (const dependency of ['locationContext.ts', 'administrativeEdition.ts', 'entitlement.ts']) boundSource('apps/doctor-suit/app/utils/' + dependency)
 check('financial-boundary-unchanged-from-parent', hash(source(base, modulePath)) === inputs[modulePath])
 const { practicePaymentIntent } = await import(pathToFileURL(path.join(root, modulePath)).href)
 const id = n => `d2080008-0000-4000-8000-${String(n).padStart(12, '0')}`, scope = { userId: id(1), practiceId: id(21), locationId: id(31), chargeId: id(60), patientId: id(42) }
 const raw = { id: id(70), practice_id: scope.practiceId, location_id: scope.locationId, doctor_user_id: scope.userId, patient_id: scope.patientId, charge_id: scope.chargeId, charge_version_id: id(61), kind: 'collection', original_entry_id: null, original_receipt_label: null, amount_minor: '100', currency: 'EGP', currency_exponent: 2, reason: 'Synthetic tax-boundary contract probe', actor_user_id: scope.userId, created_at: '2026-10-26T12:00:00Z', revision: 1, state: 'pending', reason_code: 'prepared', state_at: '2026-10-26T12:00:00Z', entry: null, data_mode: 'synthetic', external_transport_enabled: false, live_collection: false, tax_invoice_available: false, tax_applicability: 'unreviewed' }
 const decoded = practicePaymentIntent({ ...raw, compliance_badge: 'UNTRUSTED_CLAIM' }, scope)
 check('pure-current-contract-drops-unsupported-compliance-claim', !Object.hasOwn(decoded, 'compliance_badge') && decoded.entry === null)
 for (const [id, patch] of [['tax-invoice', { tax_invoice_available: true }], ['exemption', { tax_applicability: 'exempt' }], ['compliant', { tax_applicability: 'compliant' }], ['live-funds', { live_collection: true }], ['external-transport', { external_transport_enabled: true }]]) {
  let denied = false; try { practicePaymentIntent({ ...raw, ...patch }, scope) } catch { denied = true }
  check('pure-current-contract-rejects:' + id, denied)
 }
} catch { check('verifier-input-or-contract-unavailable', false) }
const passed = assertions.every(item => item.status === 'passed')
console.log(JSON.stringify({ schema: 'doctor-tax-independent-verifier/v1', execution_id: randomUUID(), task_id: 'DOS-M6-008', case_id: 'DOS-M6-008-C03', exact_base: base, exact_candidate: head, started_at_utc: started, ended_at_utc: new Date().toISOString(), argv: ['node', scriptPath, ...argv], node: process.versions.node, evaluated_input_sha256: inputs, existing_decision_approval: null, assertions, result: passed ? 'passed-blocked-disposition-and-pure-contract-only' : 'failed', qualified_review_cases: { C01: 'unavailable', C02: 'unavailable', C04: 'unavailable' }, government_api_validation: 'unrun', database_acceptance: 'unrun', legal_or_provider_authority_granted: false, task_acceptance: false }))
process.exitCode = passed ? 0 : 1
