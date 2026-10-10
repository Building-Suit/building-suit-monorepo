import test, {before, after, describe} from 'node:test'
import assert from 'node:assert/strict'
import {spawnSync} from 'node:child_process'
import {existsSync, readFileSync} from 'node:fs'
import {createHash} from 'node:crypto'
import {psqlStdinRequest, MAX_PSQL_VARIABLE_BYTES} from '../lib/psql-stdin.mjs'

const hash = value => createHash('sha256').update(value).digest('hex')
test('stdin transport removes values from argv and preserves caller options', () => {
  const value = 'أ🚀\n\r\\\'"'.repeat(30000)
  const request = psqlStdinRequest(['-X', '-v', 'ON_ERROR_STOP=1', '--set', `receipt=${value}`], {input:"SELECT :'receipt';\n", timeout:5000})
  assert.deepEqual(request.args, ['-X', '-v', 'ON_ERROR_STOP=1'])
  assert.equal(request.options.timeout, 5000)
  assert(request.options.input.includes(Buffer.from(value).toString('hex')))
  assert.equal(request.args.join(' ').includes(value), false)
})
test('invalid variable names, NUL and excessive input fail closed without values in errors', () => {
  for (const assignment of ['bad-name=private', 'x";select=private', 'receipt=private\0', `receipt=${'x'.repeat(MAX_PSQL_VARIABLE_BYTES + 1)}`]) {
    assert.throws(() => psqlStdinRequest(['--set', assignment]), error => /psql_variable_/.test(error.message) && !error.message.includes('private'))
  }
})
test('all receipt writers use the shared stdin transport', () => {
  for (const name of ['bs-agent', 'task-verifier', 'task-reparent']) {
    const code = readFileSync(new URL(`../runner/${name}.mjs`, import.meta.url), 'utf8')
    assert.match(code, /import \{psqlStdinRequest\} from '\.\.\/lib\/psql-stdin.mjs'/)
    assert.match(code, /psqlStdinRequest\((?:programArgs|args),/)
  }
})

const container = process.env.CP_PSQL_TEST_CONTAINER
describe('real disposable PostgreSQL receipt transport', {skip:!container}, () => {
  const database = `cp_psql_stdin_${process.pid}`
  let port
  const base = user => ['-XqAtw', '-v', 'ON_ERROR_STOP=1', '-v', 'VERBOSITY=verbose', '-h', '127.0.0.1', '-p', port, '-U', user, '-d', database]
  const query = (sql, variables={}, user='cp_stdin_runtime') => {
    const args = base(user)
    for (const [key,value] of Object.entries(variables)) args.push('--set', `${key}=${value}`)
    const request = psqlStdinRequest(args, {input:sql+'\n', encoding:'utf8', timeout:15000, maxBuffer:32*1024*1024,
      env:{...process.env, PGPASSWORD:'', PGSSLMODE:'disable', PGOPTIONS:''}})
    return spawnSync('/usr/bin/psql', request.args, request.options)
  }
  const success = result => { assert.equal(result.status, 0, result.stderr); assert.equal(result.error, undefined); return result.stdout.trim() }
  before(() => {
    assert.match(container, /^cp-psql-stdin-disposable[-a-z0-9]*$/)
    const inspect = spawnSync('docker', ['inspect', container], {encoding:'utf8'})
    assert.equal(inspect.status,0,inspect.stderr)
    const details = JSON.parse(inspect.stdout)[0]
    assert.match(details.Config.Image, /^postgres:/)
    const binding = details.NetworkSettings.Ports['5432/tcp'][0]
    assert.equal(binding.HostIp, '127.0.0.1'); port = binding.HostPort
    assert.equal(spawnSync('docker', ['exec',container,'createdb','-U','postgres',database]).status,0)
    success(query(`CREATE ROLE cp_stdin_runtime LOGIN; CREATE SCHEMA receipt_fixture;
      CREATE TABLE receipt_fixture.receipts(id text PRIMARY KEY, execution_id bigint NOT NULL, body jsonb NOT NULL);
      REVOKE ALL ON SCHEMA receipt_fixture FROM PUBLIC;
      CREATE FUNCTION public.capture_fixture_receipt(p_id text,p_execution bigint,p_body jsonb) RETURNS jsonb
      LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,receipt_fixture AS $body$
      BEGIN
        IF p_execution<>318 THEN RAISE EXCEPTION 'execution_identity_mismatch'; END IF;
        INSERT INTO receipt_fixture.receipts VALUES(p_id,p_execution,p_body) ON CONFLICT DO NOTHING;
        IF EXISTS(SELECT 1 FROM receipt_fixture.receipts WHERE id=p_id AND (execution_id<>p_execution OR body IS DISTINCT FROM p_body)) THEN
          RAISE EXCEPTION 'immutable_receipt_conflict'; END IF;
        RETURN jsonb_build_object('role',session_user,'body',(SELECT body FROM receipt_fixture.receipts WHERE id=p_id),
          'rows',(SELECT count(*) FROM receipt_fixture.receipts WHERE id=p_id));
      END $body$;
      REVOKE ALL ON FUNCTION public.capture_fixture_receipt(text,bigint,jsonb) FROM PUBLIC;
      GRANT EXECUTE ON FUNCTION public.capture_fixture_receipt(text,bigint,jsonb) TO cp_stdin_runtime;`, {}, 'postgres'))
  })
  after(() => {
    assert.equal(spawnSync('docker',['exec',container,'dropdb','-U','postgres',database]).status,0)
    assert.equal(spawnSync('docker',['exec',container,'psql','-U','postgres','-Xq','-v','ON_ERROR_STOP=1','-c','DROP ROLE cp_stdin_runtime']).status,0)
  })
  test('reproduces Linux E2BIG at 134326 bytes and above 200KB before any SQL runs', () => {
    assert.equal(success(query('SELECT current_database()',{},'postgres')),database)
    for (const bytes of [134326, 260000]) {
      const old = spawnSync('/usr/bin/psql', [...base('cp_stdin_runtime'),'--set', 'receipt='+'x'.repeat(bytes-8)], {input:"SELECT :'receipt';",encoding:'utf8'})
      assert.equal(old.error?.code,'E2BIG')
    }
  })
  test('over 200KB JSON is exact, authorized and idempotent, including immutable replay', () => {
    const body = {operation:'same-operation',execution:318,receipt:'private'.repeat(40000),classification:'unknown-outcome'}
    const vars = {id:'same-operation',execution:'318',receipt:JSON.stringify(body)}
    const sql = "SELECT public.capture_fixture_receipt(:'id',:'execution'::bigint,:'receipt'::jsonb)"
    for (let replay=0;replay<2;replay++) {
      const result = JSON.parse(success(query(sql,vars)))
      assert.equal(result.role,'cp_stdin_runtime');assert.equal(result.rows,1);assert.deepEqual(result.body,body)
    }
    const conflict = query(sql,{...vars,receipt:JSON.stringify({...body,classification:'PRODUCT_DEFECT'})})
    assert.notEqual(conflict.status,0);assert.match(conflict.stderr,/immutable_receipt_conflict/)
    assert.deepEqual(JSON.parse(success(query(sql,vars))).body,body)
  })
  test('multi-megabyte Unicode preserves byte hashes, whitespace, quotes and backslashes', () => {
    const value = ' \n\t'+ 'أ🚀\'"\\\r\n'.repeat(250000)+'\n '
    const result = JSON.parse(success(query("SELECT to_jsonb(:'value'::text)",{value})))
    assert(Buffer.byteLength(value)>2*1024*1024);assert.equal(hash(result),hash(value))
  })
  test('SQL and psql command injection remain literal evidence', () => {
    const file = `/tmp/cp-stdin-injection-${process.pid}`
    const value = `'; DROP SCHEMA receipt_fixture CASCADE; --\n\\! touch ${file}\n\\set ON_ERROR_STOP off\n\\copy (select 1) to '${file}'\n`
    assert.equal(JSON.parse(success(query("SELECT to_jsonb(:'value'::text)",{value}))),value)
    assert.equal(existsSync(file),false)
    assert.equal(success(query("SELECT count(*) FROM receipt_fixture.receipts",{},'postgres')),'1')
  })
  test('stdin transport does not elevate role or weaken denied writes', () => {
    const denied = query("INSERT INTO receipt_fixture.receipts VALUES(:'id',318,:'body'::jsonb)",{id:'denied',body:JSON.stringify({text:'x'.repeat(250000)})})
    assert.notEqual(denied.status,0);assert.match(denied.stderr,/42501|permission denied/)
    assert.equal(success(query("SELECT count(*) FROM receipt_fixture.receipts WHERE id='denied'",{},'postgres')),'0')
  })
  test('multiple values preserve casts, empty values, duplicates and ON_ERROR_STOP', () => {
    const args = [...base('cp_stdin_runtime'),'--set','empty=','--set','n=0','--set','n=318','--set','yes=true']
    const request = psqlStdinRequest(args,{input:"SELECT jsonb_build_object('n',:'n'::bigint,'empty',NULLIF(:'empty',''),'yes',:'yes'::boolean);\n",encoding:'utf8'})
    assert.deepEqual(JSON.parse(success(spawnSync('/usr/bin/psql',request.args,request.options))),{n:318,empty:null,yes:true})
    const denied = query("SELECT nonexistent_fixture_function(); SELECT 12345")
    assert.notEqual(denied.status,0);assert.equal(denied.stdout.includes('12345'),false)
  })
})
