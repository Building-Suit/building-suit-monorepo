import assert from 'node:assert/strict'
import { execFileSync, spawn } from 'node:child_process'
import { readFileSync, readdirSync, realpathSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

assert.equal(process.env.LEDGER_CLASSIFICATION_DISPOSABLE_TEST, '1', 'Disposable test opt-in required')
const root = fileURLToPath(new URL('../../../', import.meta.url))
const workdir = '.local/verification/statement-classification'
const container = 'supabase_db_ledger-statement-classification-20260919'
const run = (file, args) => execFileSync(file, args, { cwd: root, encoding: 'utf8', stdio: 'pipe', timeout: 180_000 }).trim()
assert.equal(realpathSync(run('docker', ['inspect', container, '--format', '{{index .Config.Labels "com.supabase.cli.workdir"}}'])), realpathSync(root + workdir))
const config = readFileSync(root + workdir + '/supabase/config.toml', 'utf8')
assert.match(config, /^project_id = "ledger-statement-classification-20260919"$/m)
assert.match(config, /^port = 64322$/m)
const baseArgs = ['exec', '-i', container, 'psql', '-X', '-U', 'postgres', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1', '-Atq']
const sql = query => run('docker', [...baseArgs, '-c', query])
const source = root + 'apps/ledger-suit/supabase/migrations/'
const files = readdirSync(source).filter(n => n.endsWith('.sql')).sort()
assert.deepEqual(sql('select version from supabase_migrations.schema_migrations order by version').split('\n'), files.map(n => n.split('_')[0]))
for (const name of files) assert.deepEqual(readFileSync(source + name), readFileSync(root + workdir + '/supabase/migrations/' + name))
const identity = `select set_config('request.jwt.claims','{"sub":"a0000000-0000-4000-8000-000000000001","role":"authenticated"}',false);`
const org = sql("select id from public.organizations where name='Alpha Trading'")
const accounts = [1, 2, 3].map(i => sql(`${identity} select public.create_account('${org}','Concurrency classification ${i}','asset','other_asset');`).split('\n').at(-1))
function session(name, query) {
  const child = spawn('docker', baseArgs, { cwd: root, stdio: ['pipe', 'pipe', 'pipe'] })
  const state = { child, output: '', error: '', exited: false, done: null }
  child.stdout.on('data', chunk => { state.output += chunk })
  child.stderr.on('data', chunk => { state.error += chunk })
  state.done = new Promise(resolve => child.on('close', code => { state.exited = true; resolve(code) }))
  child.stdin.write(`set application_name='${name}'; ${identity}\n${query}\n`)
  return state
}
async function until(predicate, message) {
  const deadline = Date.now() + 10_000
  while (!predicate()) {
    if (Date.now() > deadline) throw new Error(message)
    await new Promise(resolve => setTimeout(resolve, 30))
  }
}
const call = (id, request, reason = 'Concurrent classification') => `select public.schedule_account_statement_classification('${org}','${id}','current_assets',current_date+4,'${reason}','${request}');`
const sessions = []
try {
  for (const [i, sameRequest] of [[0, false], [1, true]]) {
    const request = `34000000-0000-4000-8000-00000000000${i + 1}`
    const winner = session(`classification-winner-${i}`, `begin; ${call(accounts[i], request)} select 'winner-ready';`)
    sessions.push(winner)
    await until(() => winner.output.includes('winner-ready') || winner.exited, 'winner did not acquire account')
    assert.equal(winner.exited, false, winner.error)
    const otherRequest = sameRequest ? request : '34000000-0000-4000-8000-000000000099'
    const loser = session(`classification-loser-${i}`, call(accounts[i], otherRequest))
    sessions.push(loser)
    loser.child.stdin.end('\\q\n')
    await until(() => sql(`select count(*) from pg_stat_activity where application_name='classification-loser-${i}' and wait_event_type='Lock'`) === '1', 'competing request did not serialize')
    winner.child.stdin.end('commit;\n\\q\n')
    assert.equal(await winner.done, 0, winner.error)
    const status = await loser.done
    if (sameRequest) {
      assert.equal(status, 0, loser.error)
      assert.equal(loser.output.trim().split('\n').at(-1), winner.output.trim().split('\n').at(-2), 'retry must return winner revision')
    }
    else {
      assert.equal(status, 3)
      assert.match(loser.error, /CLASSIFICATION_STALE/)
    }
    assert.equal(sql(`select count(*) from public.account_statement_classifications where account_id='${accounts[i]}'`), '1')
  }
  const locker = session('classification-locker', `begin; update public.organization_settings set books_locked_until=current_date+5 where organization_id='${org}'; select 'lock-ready';`)
  sessions.push(locker)
  await until(() => locker.output.includes('lock-ready') || locker.exited, 'settings writer did not acquire lock')
  assert.equal(locker.exited, false, locker.error)
  const writer = session('classification-writer', call(accounts[2], '34000000-0000-4000-8000-000000000098'))
  sessions.push(writer)
  writer.child.stdin.end('\\q\n')
  await until(() => sql("select count(*) from pg_stat_activity where application_name='classification-writer' and wait_event_type='Lock'") === '1', 'classification did not wait for books lock')
  locker.child.stdin.end('commit;\n\\q\n')
  assert.equal(await locker.done, 0, locker.error)
  assert.equal(await writer.done, 3)
  assert.match(writer.error, /BOOKS_LOCKED/)
  assert.equal(sql(`select count(*) from public.account_statement_classifications where account_id='${accounts[2]}'`), '0')
  console.log('PASS: stale concurrent editor rejected, duplicate concurrent request returns one revision, and classification observes committed books lock')
}
finally {
  for (const state of sessions) if (!state.exited) state.child.kill('SIGTERM')
}
run('pnpm', ['exec', 'supabase', '--workdir', workdir, 'db', 'reset', '--local', '--yes'])
console.log('PASS: restored pristine seeds in the owned disposable classification-review backend')
