/** Fast SQL/fixture smoke only. Native lock and real pg_cron evidence is separate. */
import test from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { readFile } from 'node:fs/promises'
import { setup, enqueue, asWorker, worker, activationPath } from './live-dispatch-native-fixture.mjs'
const require=createRequire(new URL('../../apps/company-hq/package.json',import.meta.url))
const { PGlite }=require('@electric-sql/pglite')

test('native fixture claims a real migrated job and proposed SQL compiles (not scheduler proof)',async()=>{
  const pg=new PGlite()
  // pg_cron is intentionally unavailable here. Do not mock cron.job/schedule:
  // compile validation does not execute the proposed producer or dispatcher.
  const db={query:async(sql,args)=>{
    sql=sql.replace('create extension pg_cron;','')
    return args ? pg.query(sql,args) : (await pg.exec(sql)).at(-1)
  }}
  try {
    await setup(db)
    const id=await enqueue(db)
    await asWorker(db)
    const result=(await db.query('select public.hq_worker_repository_claim($1,300,1) result',[worker])).rows[0].result
    assert.equal(result.job.id,id)
    assert.ok(result.job.lease_token)
    await db.query('reset role')
    const activation=await readFile(activationPath,'utf8')
    const exactBody=activation.split('-- BEGIN EXACT REVIEWED PROPOSAL BODY\n')[1]?.split('-- END EXACT REVIEWED PROPOSAL BODY')[0]
    assert.equal(exactBody,await readFile(new URL('./proposed-migrations/hq_live_dispatch.sql',import.meta.url),'utf8'))
    await db.query('begin')
    try { await assert.rejects(db.query(activation),/HQ_LIVE_ACTIVATION_OWNER_DATABASE_MISMATCH|HQ_LIVE_ACTIVATION_UNVERIFIED_RUNTIME/) }
    finally { await db.query('rollback') }
    assert.equal((await db.query("select to_regclass('hq_private.live_dispatch_state') state")).rows[0].state,null)
    assert.equal((await db.query("select count(*)::int n from pg_attribute where attrelid='hq_private.live_invalidations'::regclass and attnum>0 and not attisdropped")).rows[0].n,4)
    // Inherited defaults must not expose newly created private objects.
    await db.query(`alter default privileges in schema hq_private grant all on tables to anon,authenticated,service_role;
      alter default privileges in schema hq_private grant execute on functions to anon,authenticated,service_role;`)
    await db.query(await readFile(new URL('./proposed-migrations/hq_live_dispatch.sql',import.meta.url),'utf8'))
    const routine=(await db.query(`select prosecdef,proconfig,prokind from pg_proc where oid='hq_private.live_dispatch_tick()'::regprocedure`)).rows[0]
    assert.deepEqual(routine,{prosecdef:false,proconfig:null,prokind:'p'})
    assert.equal((await db.query("select to_regclass('cron.job') as scheduler")).rows[0].scheduler,null)
    for(const role of ['anon','authenticated','service_role']) {
      assert.equal((await db.query("select has_table_privilege($1,'hq_private.live_dispatch_state','SELECT,INSERT,UPDATE,DELETE') allowed",[role])).rows[0].allowed,false)
      for(const signature of ['hq_private.live_dispatch_tick()','hq_private.live_dispatch_reconcile(uuid,uuid,bigint)']) {
        assert.equal((await db.query("select has_function_privilege($1,$2,'EXECUTE') allowed",[role,signature])).rows[0].allowed,false)
      }
    }
  } finally { await pg.close() }
})
