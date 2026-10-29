import assert from 'node:assert/strict'
import { copyFileSync,constants,readFileSync,readdirSync,writeFileSync,existsSync,realpathSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import path from 'node:path'
const root=process.cwd(),directory=path.join(root,'.local/verification/journal-precision')
const fixtureDirectory=realpathSync(process.env.LEDGER_BROWSER_FIXTURE_DIRECTORY)
const name='20261028195440_exact_dashboard_summary_transport.sql'
const source=path.join(root,'apps/ledger-suit/supabase/migrations',name),target=path.join(fixtureDirectory,'supabase/migrations',name)
const owner=JSON.parse(readFileSync(path.join(fixtureDirectory,'owned-test-project.json'),'utf8'))
assert.equal(owner.task,'LS-BROWSER-001');assert.equal(owner.project,'ledger-browser-20261026')
assert.equal(realpathSync(owner.workdir),fixtureDirectory);assert.equal(owner.database_port,61022);assert.equal(owner.api_port,61021)
if(existsSync(target))assert.deepEqual(readFileSync(target),readFileSync(source));else copyFileSync(source,target,constants.COPYFILE_EXCL)
const {browserContext}=await import(path.join(root,'apps/ledger-suit/scripts/native-browser-runtime.mjs'))
const c=browserContext(false)
const info=JSON.parse(c.docker(['inspect',c.database]))[0]
assert.equal(realpathSync(info.Config.Labels['com.supabase.cli.workdir']),fixtureDirectory)
assert.ok(info.NetworkSettings.Ports['5432/tcp'].some(p=>p.HostPort==='61022'))
const versions=readdirSync(path.dirname(source)).filter(n=>n.endsWith('.sql')).sort().map(n=>n.split('_')[0])
assert.equal(versions.length,108)
const beforeVersions=c.sql('select version from supabase_migrations.schema_migrations order by version;').split('\n')
assert.deepEqual(beforeVersions,versions.slice(0,107))
const tables=JSON.parse(c.sql("select jsonb_agg(jsonb_build_object('schema',n.nspname,'table',t.relname) order by n.nspname,t.relname) from pg_class t join pg_namespace n on n.oid=t.relnamespace where n.nspname in ('public','app') and t.relkind in ('r','p');"))
assert.equal(tables.length,122)
function snapshot(){return tables.map(t=>{assert.match(t.schema,/^[a-z_][a-z0-9_]*$/);assert.match(t.table,/^[a-z_][a-z0-9_]*$/);const value=JSON.parse(c.sql(`select jsonb_build_object('rows',count(*),'md5',md5(coalesce(jsonb_agg(to_jsonb(row_value) order by to_jsonb(row_value)::text),'[]'::jsonb)::text)) from "${t.schema}"."${t.table}" row_value;`));return {...t,...value}})}
const before=snapshot();writeFileSync(path.join(directory,'before-migration.json'),JSON.stringify(before,null,2)+'\n',{mode:0o600,flag:'wx'})
const migrated=spawnSync('pnpm',['exec','supabase','--workdir',fixtureDirectory,'migration','up','--local'],{cwd:root,env:c.env,encoding:'utf8',timeout:120000,maxBuffer:8*1024*1024})
writeFileSync(path.join(directory,'migration.log'),(migrated.stdout||'')+(migrated.stderr||''),{mode:0o600})
assert.equal(migrated.status,0,'Inspect owned private migration log')
browserContext()
const after=snapshot();assert.deepEqual(after,before)
writeFileSync(path.join(directory,'after-migration.json'),JSON.stringify(after,null,2)+'\n',{mode:0o600})
const hash=createHash('sha256').update(JSON.stringify(after)).digest('hex')
console.log(JSON.stringify({before_migrations:107,after_migrations:108,public_app_tables:tables.length,table_fingerprints_identical:true,sha256:hash,financial_reset_or_delete:false}))
