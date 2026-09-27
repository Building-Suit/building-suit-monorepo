import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve, sep } from 'node:path'
import { pathToFileURL } from 'node:url'

const PAGE_SIZE = 1000
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

// Every entry is tenant-owned and readable only through its existing RLS and
// capability policy. Billing-provider payloads, platform secrets and other
// tenants are deliberately absent.
export const tenantTables = [
  ['organizations', 'id'],
  ['organization_settings', 'organization_id', '*', 'organization_id.asc'],
  ['organization_members', 'organization_id'],
  ['organization_invitations', 'organization_id'],
  ['profiles', 'organization_members.organization_id', '*,organization_members!inner(organization_id)'],
  ['organization_roles', 'organization_id'],
  ['organization_system_roles', 'organization_id', '*', 'role.asc'],
  ['organization_system_role_capabilities', 'organization_id', '*', 'role.asc,capability_key.asc'],
  ['role_capabilities', 'organization_roles.organization_id', '*,organization_roles!inner(organization_id)', 'role_id.asc,capability_key.asc'],
  ['accounts', 'organization_id'],
  ['account_label_versions', 'organization_id'],
  ['account_statement_classifications', 'organization_id'],
  ['account_financial_mappings', 'organization_id'],
  ['control_account_bindings', 'organization_id', '*', 'account_id.asc'],
  ['control_adjustments', 'organization_id'],
  ['control_variance_explanations', 'organization_id'],
  ['categories', 'organization_id'],
  ['counterparties', 'organization_id'],
  ['tags', 'organization_id'],
  ['transactions', 'organization_id'],
  ['transaction_entries', 'organization_id'],
  ['transaction_tags', 'organization_id', '*', 'transaction_id.asc,tag_id.asc'],
  ['transaction_entry_dimension_allocations', 'organization_id'],
  ['commitments', 'organization_id'],
  ['commitment_settlements', 'organization_id'],
  ['recurring_rules', 'organization_id'],
  ['recurring_occurrences', 'organization_id'],
  ['import_batches', 'organization_id'],
  ['import_rows', 'organization_id'],
  ['attachments', 'organization_id'],
  ['saved_views', 'organization_id'],
  ['accounting_periods', 'organization_id'],
  ['accounting_period_transitions', 'organization_id'],
  ['fiscal_year_closes', 'organization_id'],
  ['opening_balance_batches', 'organization_id'],
  ['opening_balance_rows', 'organization_id'],
  ['ar_documents', 'organization_id'],
  ['ar_allocations', 'organization_id'],
  ['ap_documents', 'organization_id'],
  ['ap_allocations', 'organization_id'],
  ['bank_reconciliations', 'organization_id'],
  ['bank_statement_lines', 'organization_id'],
  ['bank_match_groups', 'organization_id'],
  ['bank_match_lines', 'organization_id'],
  ['bank_match_transactions', 'organization_id'],
  ['bank_adjustments', 'organization_id'],
  ['bank_outstanding_items', 'organization_id'],
  ['bank_reconciliation_events', 'organization_id'],
  ['fixed_assets', 'organization_id'],
  ['asset_policy_versions', 'organization_id'],
  ['asset_depreciation_schedule', 'organization_id'],
  ['asset_events', 'organization_id'],
  ['asset_disposals', 'organization_id'],
  ['accounting_dimension_values', 'organization_id'],
  ['account_dimension_policies', 'organization_id', '*', 'account_id.asc,kind.asc'],
  ['dimension_value_requests', 'organization_id', '*', 'request_id.asc'],
  ['organization_vat_profiles', 'organization_id', '*', 'organization_id.asc'],
  ['vat_documents', 'organization_id'],
  ['inventory_accounting_sources', 'organization_id'],
  ['inventory_accounting_facts', 'organization_id'],
  ['cash_flow_allocation_decisions', 'organization_id'],
  ['cash_flow_allocations', 'cash_flow_allocation_decisions.organization_id', '*,cash_flow_allocation_decisions!inner(organization_id)', 'decision_id.asc,section.asc'],
  ['notifications', 'organization_id'],
  ['subscriptions', 'organization_id'],
  ['subscription_customers', 'organization_id'],
]

export function assertTenantStoragePath(organizationId, storageKey) {
  if (!storageKey.startsWith(`${organizationId}/`)) throw new Error(`foreign attachment path: ${storageKey}`)
  const normalized = storageKey.split('/')
  if (normalized.some(part => part === '' || part === '.' || part === '..')) {
    throw new Error(`unsafe attachment path: ${storageKey}`)
  }
  return normalized
}

function sha256(value) {
  return createHash('sha256').update(value).digest('hex')
}

function requiredEnv(name) {
  const value = process.env[name]?.trim()
  if (!value) throw new Error(`${name} is required`)
  return value
}

function requestHeaders(key, token, extra = {}) {
  return { apikey: key, Authorization: `Bearer ${token}`, ...extra }
}

function contentRangePage(value, table) {
  if (value === '*/0') return { end: -1, total: 0 }
  const match = value?.match(/^(\d+)-(\d+)\/(\d+)$/)
  if (!match) throw new Error(`missing exact Content-Range for ${table}`)
  return { end: Number(match[2]), total: Number(match[3]) }
}

async function checkedFetch(url, options) {
  const response = await fetch(url, options)
  if (!response.ok) {
    const detail = (await response.text()).slice(0, 500)
    throw new Error(`${response.status} ${response.statusText} for ${new URL(url).pathname}: ${detail}`)
  }
  return response
}

async function exportTable({ baseUrl, key, token, organizationId, output, table, filter, select = '*', order = 'id.asc' }) {
  const directory = join(output, 'tables', table)
  mkdirSync(directory, { recursive: true })
  const files = []
  let start = 0
  let total
  do {
    const url = new URL(`${baseUrl}/rest/v1/${table}`)
    url.searchParams.set('select', select)
    url.searchParams.set(filter, `eq.${organizationId}`)
    url.searchParams.set('order', order)
    const response = await checkedFetch(url, {
      headers: requestHeaders(key, token, {
        Accept: 'application/json', Prefer: 'count=exact', Range: `${start}-${start + PAGE_SIZE - 1}`,
        'Range-Unit': 'items',
      }),
    })
    const raw = await response.text()
    const range = contentRangePage(response.headers.get('content-range'), table)
    total = range.total
    const pageName = `page-${String(files.length + 1).padStart(6, '0')}.json`
    writeFileSync(join(directory, pageName), `${raw}\n`, { mode: 0o600 })
    files.push({ path: `tables/${table}/${pageName}`, sha256: sha256(raw) })
    start = range.end + 1
  } while (start < total)
  return { table, rows: String(total), files }
}

async function rpcText({ baseUrl, key, token, rpc, body }) {
  const response = await checkedFetch(`${baseUrl}/rest/v1/rpc/${rpc}`, {
    method: 'POST',
    headers: requestHeaders(key, token, { 'Content-Type': 'application/json', Accept: 'application/json' }),
    body: JSON.stringify(body),
  })
  const value = JSON.parse(await response.text())
  if (typeof value !== 'string') throw new Error(`${rpc} did not return text`)
  return value
}

async function exportReports(context, fromDate, toDate) {
  const directory = join(context.output, 'reports')
  mkdirSync(directory, { recursive: true })
  const definitions = [
    ['profit-loss.csv', { p_report: 'profit_loss', p_from_date: fromDate, p_to_date: toDate }],
    ['balance-sheet.csv', { p_report: 'balance_sheet', p_as_of_date: toDate }],
    ['trial-balance.csv', { p_report: 'trial_balance', p_from_date: fromDate, p_to_date: toDate }],
    ['cash-flow.csv', { p_report: 'cash_flow', p_from_date: fromDate, p_to_date: toDate }],
  ]
  const files = []
  for (const [name, parameters] of definitions) {
    const csv = await rpcText({ ...context, rpc: 'export_financial_report_csv', body: {
      p_organization_id: context.organizationId, p_from_date: null, p_to_date: null,
      p_as_of_date: null, p_account_id: null, ...parameters,
    } })
    writeFileSync(join(directory, name), csv, { mode: 0o600 })
    files.push({ path: `reports/${name}`, sha256: sha256(csv) })
  }
  return files
}

async function fetchAttachmentRows(context) {
  const rows = []
  let start = 0
  let total
  do {
    const url = new URL(`${context.baseUrl}/rest/v1/attachments`)
    url.searchParams.set('select', 'id,organization_id,storage_bucket,storage_key,file_name,mime_type,size_bytes,checksum')
    url.searchParams.set('organization_id', `eq.${context.organizationId}`)
    url.searchParams.set('order', 'storage_key.asc')
    const response = await checkedFetch(url, {
      headers: requestHeaders(context.key, context.token, {
        Accept: 'application/json', Prefer: 'count=exact', Range: `${start}-${start + PAGE_SIZE - 1}`,
        'Range-Unit': 'items',
      }),
    })
    const page = JSON.parse(await response.text())
    const range = contentRangePage(response.headers.get('content-range'), 'attachments')
    total = range.total
    rows.push(...page)
    start = range.end + 1
  } while (start < total)
  return rows
}

async function exportAttachmentObjects(context) {
  const objects = []
  for (const row of await fetchAttachmentRows(context)) {
    const parts = assertTenantStoragePath(context.organizationId, row.storage_key)
    const encodedPath = parts.map(encodeURIComponent).join('/')
    const bucket = encodeURIComponent(row.storage_bucket)
    const response = await checkedFetch(
      `${context.baseUrl}/storage/v1/object/authenticated/${bucket}/${encodedPath}`,
      { headers: requestHeaders(context.key, context.token) },
    )
    const bytes = Buffer.from(await response.arrayBuffer())
    if (BigInt(bytes.length) !== BigInt(row.size_bytes)) throw new Error(`attachment size mismatch: ${row.storage_key}`)
    const target = resolve(context.output, 'attachments', ...parts)
    const attachmentRoot = `${resolve(context.output, 'attachments')}${sep}`
    if (!target.startsWith(attachmentRoot)) throw new Error(`attachment escaped export root: ${row.storage_key}`)
    mkdirSync(dirname(target), { recursive: true })
    writeFileSync(target, bytes, { mode: 0o600 })
    objects.push({
      storage_bucket: row.storage_bucket,
      storage_key: row.storage_key,
      size_bytes: String(bytes.length),
      sha256: sha256(bytes),
    })
  }
  return objects.sort((left, right) => left.storage_key.localeCompare(right.storage_key))
}

export async function exportOrganizationPortability(options) {
  if (!uuidPattern.test(options.organizationId)) throw new Error('LEDGER_EXPORT_ORGANIZATION_ID must be a UUID')
  if (!/^\d{4}-\d{2}-\d{2}$/.test(options.fromDate) || !/^\d{4}-\d{2}-\d{2}$/.test(options.toDate)
      || options.fromDate > options.toDate) throw new Error('export dates must be an ordered YYYY-MM-DD range')
  const baseUrl = new URL(options.baseUrl)
  if (baseUrl.protocol !== 'https:' && baseUrl.hostname !== '127.0.0.1' && baseUrl.hostname !== 'localhost') {
    throw new Error('Supabase URL must use HTTPS unless it is loopback')
  }
  const output = resolve(options.output)
  if (existsSync(output)) throw new Error(`refusing to overwrite existing export directory: ${output}`)
  const context = { ...options, baseUrl: baseUrl.href.replace(/\/$/, ''), output }
  const capabilityResponse = await checkedFetch(`${context.baseUrl}/rest/v1/rpc/my_capabilities`, {
    method: 'POST',
    headers: requestHeaders(context.key, context.token, { 'Content-Type': 'application/json', Accept: 'application/json' }),
    body: JSON.stringify({ p_organization_id: context.organizationId }),
  })
  const capabilities = JSON.parse(await capabilityResponse.text())
  if (!Array.isArray(capabilities) || !capabilities.includes('exports.create')) {
    throw new Error('exports.create is required for organization portability')
  }
  mkdirSync(output, { recursive: true, mode: 0o700 })
  const tables = []
  for (const [table, filter, select, order] of tenantTables) {
    tables.push(await exportTable({ ...context, table, filter, select, order }))
  }
  const reports = await exportReports(context, options.fromDate, options.toDate)
  const objects = await exportAttachmentObjects(context)
  const attachmentManifest = {
    schema_version: 'ls-ops-001-attachments-v1',
    environment_id: options.environmentId,
    organization_id: options.organizationId,
    objects,
  }
  writeFileSync(join(output, 'attachments-manifest.json'), `${JSON.stringify(attachmentManifest, null, 2)}\n`, { mode: 0o600 })
  const manifest = {
    schema_version: 'ls-ops-001-portability-v1',
    environment_id: options.environmentId,
    organization_id: options.organizationId,
    from_date: options.fromDate,
    to_date: options.toDate,
    tables,
    reports,
    attachment_manifest_sha256: sha256(JSON.stringify(attachmentManifest)),
  }
  writeFileSync(join(output, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`, { mode: 0o600 })
  return manifest
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const result = await exportOrganizationPortability({
      baseUrl: requiredEnv('LEDGER_SUPABASE_URL'),
      key: requiredEnv('LEDGER_SUPABASE_PUBLISHABLE_KEY'),
      token: requiredEnv('LEDGER_ACCESS_TOKEN'),
      organizationId: requiredEnv('LEDGER_EXPORT_ORGANIZATION_ID'),
      environmentId: requiredEnv('LEDGER_EXPORT_ENVIRONMENT_ID'),
      fromDate: requiredEnv('LEDGER_EXPORT_FROM_DATE'),
      toDate: requiredEnv('LEDGER_EXPORT_TO_DATE'),
      output: requiredEnv('LEDGER_EXPORT_OUTPUT'),
    })
    console.log(`Exported ${result.tables.length} tenant tables and ${result.reports.length} existing report CSVs.`)
  } catch (error) {
    console.error(`FAIL: ${error.message}`)
    process.exitCode = 1
  }
}
