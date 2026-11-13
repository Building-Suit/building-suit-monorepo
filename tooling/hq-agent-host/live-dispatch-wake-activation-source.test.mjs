/** Guard and exact-body source smoke; no scheduler emulation. */
import test from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { readFile } from 'node:fs/promises'
import { setup } from './live-dispatch-native-fixture.mjs'
import { readAdaptiveActivation,adaptiveCatalogQuery } from './live-dispatch-wake-activation-fixture.mjs'
const require=createRequire(new URL('../../apps/company-hq/package.json',import.meta.url)),{PGlite}=require('@electric-sql/pglite')
test('guarded adaptive migration preserves exact proposal and rejects unverified runtime atomically',async()=>{
  const pg=new PGlite(),db={query:async(sql,args)=>{
    sql=sql.replace('create extension pg_cron;','')
    return args?pg.query(sql,args):(await pg.exec(sql)).at(-1)
  }}
  const one=async(sql,args)=>(await db.query(sql,args)).rows[0]
  try {
    await setup(db)
    await db.query(await readFile(new URL('./proposed-migrations/hq_live_dispatch.sql',import.meta.url),'utf8'))
    const source=await readAdaptiveActivation()
    assert.equal(source.proposalSha256,'e996f6bc9522cbedd2db50236bc6974226d1a35e9bdb1a9983133ede042d9238')
    // Validate production metadata against real repository-generated catalogs.
    // Cron isn't mocked: only its missing function entries are excluded here.
    for(const spec of source.metadata.functions.filter(x=>!x.signature.startsWith('cron.'))) {
      assert.ok((await one('select to_regprocedure($1) routine',[spec.signature])).routine,`invalid production routine ${spec.signature}`)
      if(!spec.signature.startsWith('realtime.')) {
        const actual=Object.values(await one(adaptiveCatalogQuery(source,'FUNCTIONS'),[spec.signature]))[0]
        const access=Object.fromEntries(Object.entries(actual).filter(([key])=>!['body_md5','definition_md5'].includes(key)))
        const expectedAccess=Object.fromEntries(Object.entries(spec).filter(([key])=>!['body_md5','definition_md5'].includes(key)))
        assert.deepEqual(access,expectedAccess,`production routine authority ${spec.signature}`)
      }

    }
    for(const name of ['SCHEMA','TABLES','COLUMNS','CONSTRAINTS','INDEXES']) {
      assert.deepEqual(Object.values(await one(adaptiveCatalogQuery(source,name)))[0],source.metadata[name.toLowerCase()],`production ${name} metadata matches source baseline`)
    }
    const before=await one('select to_jsonb(s) state from hq_private.live_dispatch_state s')
    await db.query('begin')
    try {await assert.rejects(db.query(source.original),/HQ_ADAPTIVE_OWNER_DATABASE_MISMATCH|HQ_ADAPTIVE_RUNTIME_CONFIG_DRIFT/)}
    finally {await db.query('rollback')}
    assert.deepEqual(await one('select to_jsonb(s) state from hq_private.live_dispatch_state s'),before)
    assert.equal((await one("select to_regprocedure('hq_private.live_dispatch_watchdog()') routine")).routine,null)
    assert.equal((await one("select to_regnamespace('cron') scheduler")).scheduler,null)
  } finally {await pg.close()}
})
