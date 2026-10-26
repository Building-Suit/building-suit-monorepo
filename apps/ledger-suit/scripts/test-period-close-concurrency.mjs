// Actual public posting commands versus close, with observed independent locks.
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { randomUUID, createHash } from 'node:crypto'
import { periodContext, privateResult, root } from './native-period-close-runtime.mjs'
assert.equal(process.argv.length, 2)
const c = periodContext()
const quote = value => "'" + String(value).replaceAll("'", "''") + "'"
const hash = value => createHash('sha256').update(value).digest('hex')
const sessions = []
const results = []
const run = randomUUID()
const tables = c.sql("select table_schema||'.'||table_name from information_schema.columns col where exists(select 1 from information_schema.tables tbl where tbl.table_schema=col.table_schema and tbl.table_name=col.table_name and tbl.table_type='BASE TABLE') and column_name='organization_id' and table_schema in ('public','app') and table_name not in ('accounting_periods','accounting_period_transitions','audit_log','audit_logs') order by 1;").split('\n')
for (const name of tables) assert.match(name, /^(public|app)\.[a-z0-9_]+$/)
const snapshot = org => hash(c.sql(tables.map(name => `select '${name}',coalesce(jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text),'[]'::jsonb)::text from ${name} t where organization_id=${quote(org)};`).join('\n')))
const financial = org => JSON.parse(c.sql(`select json_build_object('journals',(select count(*) from public.transactions where organization_id=${quote(org)} and posted_at is not null),'entries',count(*),'debit',coalesce(sum(base_amount_minor) filter(where side='debit'),0)::text,'credit',coalesce(sum(base_amount_minor) filter(where side='credit'),0)::text) from public.transaction_entries where organization_id=${quote(org)} and posted_at is not null;`))
const identity = actor => `set request.jwt.claims=${quote(JSON.stringify({ sub: actor, role: 'authenticated' }))}; set role authenticated;`
function setup(source, order) {
  const actor = randomUUID()
  c.sql(`insert into auth.users(id,email,raw_user_meta_data,raw_app_meta_data) values(${quote(actor)},${quote(actor + '@example.test')},'{}','{}');`)
  const auth = identity(actor)
  const command = query => c.sql(`${auth} ${query}`)
  const org = command(`select public.create_organization(${quote('Close matrix ' + source + ' ' + order)},'EGP');`)
  const account = (name, type, subtype, extra = '') => command(`select public.create_account(${quote(org)},${quote(name)},${quote(type)},${quote(subtype)}${extra});`)
  const bank = account('Matrix bank', 'asset', 'bank')
  const revenue = account('Matrix revenue', 'revenue', 'service_revenue')
  const period = command(`select public.create_accounting_period(${quote(org)},'2099-01-01','2099-12-31');`)
  let close = `select public.transition_accounting_period(${quote(period)},'soft_closed','Reviewed matrix close'); select public.transition_accounting_period(${quote(period)},'hard_closed','Reviewed matrix final close');`
  let rejection = /ACCOUNTING_PERIOD_HARD_CLOSED/
  let post, debit = '100', entries = 2
  if (source === 'manual') post = `select public.record_income(${quote(org)},100,${quote(bank)},p_revenue_account_id=>${quote(revenue)},p_transaction_date=>'2099-12-31',p_idempotency_key=>${quote('matrix-' + run)});`
  else if (source === 'opening') {
    const capital = account('Matrix capital', 'equity', 'other_equity')
    const rows = JSON.stringify([{ source_row: 1, debit: '10.00', credit: '', account_id: bank }, { source_row: 2, debit: '', credit: '10.00', account_id: capital }])
    const batch = command(`select public.create_opening_balance_batch(${quote(org)},'year_start','2099-12-31','matrix.csv',${quote(rows)}::jsonb);`)
    post = `select public.approve_opening_balance_batch(${quote(batch)});`; debit = '1000'
  } else if (source === 'bank') {
    const expense = account('Matrix bank fee', 'expense', 'bank_fees')
    const rows = JSON.stringify([{ date: '2099-12-31', amount_minor: '-100', description: 'Matrix fee' }])
    const rec = command(`select public.import_bank_statement(${quote(org)},${quote(bank)},'matrix.csv',${quote(hash(actor))},'2099-12-01','2099-12-31',0,-100,'EGP',${quote(rows)}::jsonb);`)
    const line = command(`select id from public.bank_statement_lines where reconciliation_id=${quote(rec)};`)
    post = `select public.create_bank_adjustment(${quote(org)},${quote(rec)},${quote(line)},${quote(expense)},'Reviewed matrix fee',${quote('matrix-' + run)});`
  } else if (source === 'vat') {
    const output = account('Matrix output VAT', 'liability', 'taxes_payable')
    const input = account('Matrix input VAT', 'asset', 'other_asset')
    const receivable = account('Matrix VAT receivable', 'asset', 'other_asset')
    command(`select public.configure_egypt_vat(${quote(org)},'SYNTHETIC-VAT','2099-01-01',${quote(output)},${quote(input)});`)
    post = `select public.post_egypt_vat_document(${quote(org)},'output','invoice','2099-12-31','2099-12-31','SYNTHETIC-1',100,${quote(revenue)},${quote(receivable)},${quote('matrix-' + run)});`
    debit = '114'; entries = 3
  } else if (source === 'ar' || source === 'ap') {
    const ar = source === 'ar'
    const control = account('Matrix control', ar ? 'asset' : 'liability', ar ? 'accounts_receivable' : 'accounts_payable', `,p_account_role=>'control',p_control_subledger_type=>${quote(ar ? 'customer' : 'supplier')}`)
    const counterparty = command(`select public.create_counterparty(${quote(org)},'Matrix counterparty',${quote(ar ? 'customer' : 'vendor')});`)
    const offset = ar ? revenue : account('Matrix supplies', 'expense', 'other_expense')
    post = `select public.post_${source}_document(${quote(org)},${quote(ar ? 'invoice' : 'bill')},${quote(counterparty)},${quote(control)},'2099-12-31',100,${quote(offset)},'MATRIX-1',${quote('matrix-' + run)},'2100-01-31');`
  } else if (source === 'asset') {
    const cost = account('Matrix equipment', 'asset', 'equipment')
    const expense = account('Matrix depreciation', 'expense', 'depreciation')
    const impairment = account('Matrix impairment', 'expense', 'other_expense')
    const gainloss = account('Matrix gain loss', 'expense', 'other_expense')
    const accumulated = account('Matrix accumulated', 'asset', 'equipment', `,p_normal_balance=>'credit',p_contra_account_id=>${quote(cost)}`)
    const acquisition = command(`select public.record_asset_purchase(${quote(org)},1000,${quote(cost)},${quote(bank)},p_transaction_date=>'2099-12-01',p_idempotency_key=>'matrix-acquisition');`)
    const asset = command(`select public.register_fixed_asset(${quote(org)},'MATRIX-1','Matrix equipment',${quote(acquisition)},${quote(cost)},${quote(accumulated)},${quote(expense)},${quote(impairment)},${quote(gainloss)},1000,'2099-12-01','2099-12-01',12,0,'straight_line',null,null,null,'matrix-register');`)
    const schedule = command(`select id from public.asset_depreciation_schedule where asset_id=${quote(asset)} and period_end='2099-12-31';`)
    assert.equal(command(`select depreciation_minor from public.asset_depreciation_schedule where id=${quote(schedule)};`), '85', 'round(1000 * 31 / 365)')
    post = `select public.post_asset_depreciation(${quote(org)},${quote(schedule)},${quote('matrix-' + run)});`
    debit = '85'
  } else if (source === 'inventory') {
    const control = command(`select public.create_inventory_control_account(${quote(org)},'Matrix inventory');`)
    const cogs = account('Matrix cost of sales', 'expense', 'cost_of_sales')
    const clearing = account('Matrix clearing', 'liability', 'other_liability')
    const stream = command(`select public.configure_inventory_source(${quote(org)},'matrix-source',${quote(actor)},'2099-01-01',${quote(control)},${quote(cogs)},${quote(clearing)});`)
    const fact = JSON.stringify({ schema_version: 1, currency: 'EGP', negative_stock: false, sequence: '1', movement_id: 'MATRIX-1', movement_version: 1, valuation_id: 'MATRIX-VALUE-1', valuation_version: 1, costing_method: 'source-approved', policy_version: '1', kind: 'purchase', effective_date: '2099-12-31', accounting_date: '2099-12-31', stock_quantity_after: '10', inventory_delta_minor: '10000', cogs_delta_minor: '0', inventory_balance_after_minor: '10000', cogs_balance_after_minor: '0' })
    post = `select public.ingest_inventory_fact(${quote(org)},${quote(stream)},${quote(fact)}::jsonb);`
    debit = '10000'
  } else if (source === 'dimensioned') {
    const dimension = command(`select public.save_dimension_value(${quote(org)},'cost_center','MATRIX','Matrix cost center',null,${quote(randomUUID())});`)
    const lines = JSON.stringify([{ account_id: bank, side: 'debit', amount_minor: 100, allocations: [{ dimension_value_id: dimension, amount_minor: '100', base_amount_minor: '100' }] }, { account_id: revenue, side: 'credit', amount_minor: 100 }])
    const draft = command(`select public.create_draft_transaction(${quote(org)},'income','2099-12-31',${quote(lines)}::jsonb,p_description=>'Matrix dimensioned income',p_idempotency_key=>${quote('matrix-' + run)});`)
    post = `select public.post_transaction(${quote(draft)});`
  } else if (source === 'year_close') {
    command(`select public.record_income(${quote(org)},100,${quote(bank)},p_revenue_account_id=>${quote(revenue)},p_transaction_date=>'2099-12-31',p_idempotency_key=>'matrix-annual-income');`)
    c.sql(`set request.jwt.claims=${quote(JSON.stringify({ sub: actor, role: 'authenticated' }))}; select app.seed_chart_of_accounts(${quote(org)});`)
    command(`select public.transition_accounting_period(${quote(period)},'soft_closed','Reviewed annual source');`)
    close = `select public.transition_accounting_period(${quote(period)},'hard_closed','Reviewed annual final close');`
    post = `select public.close_fiscal_year(${quote(org)},'2099-01-01','Reviewed annual result',${quote('matrix-' + run)});`
    rejection = /FISCAL_YEAR_HARD_CLOSED/
  }
  assert.ok(post, 'Explicit supported posting source required')
  return { actor, auth, org, bank, revenue, period, command, close, post, debit, entries, rejection }
}
function session(actor, label, query, hold) {
  const name = 'period-' + label + '-' + randomUUID()
  const child = spawn('docker', [...c.dockerArgs, ...c.base], { cwd: root, env: c.env, stdio: ['pipe', 'pipe', 'pipe'] })
  const state = { name, child, output: '', error: '', exited: false }
  child.stdout.on('data', chunk => { state.output += chunk }); child.stderr.on('data', chunk => { state.error += chunk })
  state.done = new Promise(resolve => child.on('close', code => { state.exited = true; resolve(code) }))
  child.stdin.write(`set application_name=${quote(name)}; set statement_timeout='15s'; ${identity(actor)} ${hold ? 'begin;' : ''} ${query} ${hold ? "select 'matrix_ready';" : ''}\n`)
  if (!hold) child.stdin.end('\\q\n')
  sessions.push(state)
  return state
}
async function until(predicate, message) {
  const deadline = Date.now() + 10000
  while (!predicate()) { assert.ok(Date.now() < deadline, message); await new Promise(resolve => setTimeout(resolve, 30)) }
}
async function paired(actor, first, second, reject) {
  const winner = session(actor, 'winner', first, true)
  await until(() => winner.output.includes('matrix_ready') || winner.exited, 'Winner did not reach its real command barrier')
  assert.equal(winner.exited, false, winner.error)
  const loser = session(actor, 'loser', second, false)
  let wait
  await until(() => {
    if (loser.exited) throw new Error('Competing command exited before an observed lock wait: ' + loser.error)
    const value = c.sql(`select json_build_object('type',wait_event_type,'event',wait_event)::text from pg_stat_activity where application_name=${quote(loser.name)} and wait_event_type='Lock';`)
    if (value) wait = JSON.parse(value)
    return !!wait
  }, 'Competing native command did not serialize')
  winner.child.stdin.end('commit;\n\\q\n')
  assert.equal(await winner.done, 0, winner.error)
  assert.equal(await loser.done, reject ? 3 : 0, loser.error)
  if (reject) assert.match(loser.error, reject)
  return { wait, winner: winner.output, loser: loser.output }
}
try {
  for (const source of ['manual', 'opening', 'bank', 'vat', 'ar', 'ap', 'asset', 'inventory', 'dimensioned', 'year_close']) for (const order of ['post_first', 'close_first']) {
    const f = setup(source, order)
    const before = snapshot(f.org)
    const initial = financial(f.org)
    const race = await paired(f.actor, order === 'post_first' ? f.post : f.close, order === 'post_first' ? f.close : f.post, order === 'close_first' ? f.rejection : false)
    assert.equal(f.command(`select status from public.accounting_periods where id=${quote(f.period)};`), 'hard_closed')
    assert.equal(c.sql(`select count(*)=2 and bool_and(actor_id=${quote(f.actor)}::uuid) from public.accounting_period_transitions where period_id=${quote(f.period)};`), 't')
    const totals = financial(f.org)
    if (order === 'close_first') {
      assert.equal(snapshot(f.org), before, 'Rejected posting changed a source/ledger/numbering row')
      assert.deepEqual(totals, initial)
    } else {
      assert.deepEqual(totals, { journals: initial.journals + 1, entries: initial.entries + f.entries, debit: String(BigInt(initial.debit) + BigInt(f.debit)), credit: String(BigInt(initial.credit) + BigInt(f.debit)) })
      assert.equal(c.sql(`select count(*)=count(distinct journal_reference) and bool_and(journal_reference ~ '^JRN-[0-9]{4}-[0-9]{6}$') from public.transactions where organization_id=${quote(f.org)} and posted_at is not null;`), 't')
    }
    results.push({ source, order, observed_wait: race.wait, financial: totals, rejected_source_rows_preserved: order === 'close_first', result: 'pass' })
    privateResult('partial-results.json', { run, results })
  }
  const f = setup('manual', 'annual_retry')
  f.command(f.post)
  c.sql(`set request.jwt.claims=${quote(JSON.stringify({ sub: f.actor, role: 'authenticated' }))}; select app.seed_chart_of_accounts(${quote(f.org)});`)
  f.command(`select public.transition_accounting_period(${quote(f.period)},'soft_closed','Reviewed annual close');`)
  const close = `select public.close_fiscal_year(${quote(f.org)},'2099-01-01','Reviewed annual result',${quote('annual-' + run)});`
  const race = await paired(f.actor, close, close, false)
  const ids = output => output.split('\n').filter(line => /^[\da-f]{8}(?:-[\da-f]{4}){3}-[\da-f]{12}$/.test(line))
  assert.equal(ids(race.winner).length, 1)
  assert.equal(ids(race.loser).length, 1)
  assert.deepEqual(ids(race.winner), ids(race.loser))
  assert.equal(c.sql(`select count(*)||'|'||min(net_income_minor) from public.fiscal_year_closes where organization_id=${quote(f.org)};`), '1|100')
  assert.deepEqual(financial(f.org), { journals: 2, entries: 4, debit: '200', credit: '200' })
  assert.equal(f.command(`select sum(amount_minor::bigint) from public.report_profit_and_loss(${quote(f.org)},'2099-01-01','2099-12-31');`), '100')
  results.push({ source: 'annual_close', order: 'parallel_retry', observed_wait: race.wait, journals: 2, closing_journals: 1, net_income_minor: '100', historical_profit_loss_minor: '100', result: 'pass' })
  const evidence = { task: 'LS-REL-CLOSE-001', date: new Date().toISOString().slice(0, 10), run, source_matrix: results, native_paired_cases: results.length, assertions: 'Actual public RPCs; observed pg_stat_activity Lock waits; restricted source rows, numbering and ledger unchanged after rejection.', fixture_preserved: true, result: 'pass' }
  privateResult('result.json', evidence)
  console.log(JSON.stringify(evidence))
} finally {
  for (const state of sessions.filter(state => !state.exited)) {
    c.sql(`select pg_terminate_backend(pid) from pg_stat_activity where application_name=${quote(state.name)} and pid<>pg_backend_pid();`)
    state.child.kill('SIGTERM')
  }
}
