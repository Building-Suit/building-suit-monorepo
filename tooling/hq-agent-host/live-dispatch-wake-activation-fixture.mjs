/** Explicit disposable metadata adapter, never imported by a deployer. */
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
export const adaptiveActivationPath=new URL('../../apps/company-hq/supabase/migrations/20261109182552_hq_live_dispatch_adaptive_activation.sql',import.meta.url)
export const adaptiveProposalPath=new URL('./proposed-migrations/hq_live_dispatch_adaptive.sql',import.meta.url)
export async function readAdaptiveActivation() {
  const original=await readFile(adaptiveActivationPath,'utf8'),proposal=await readFile(adaptiveProposalPath,'utf8')
  const begin='-- BEGIN EXACT ADAPTIVE PROPOSAL BODY\n',end='-- END EXACT ADAPTIVE PROPOSAL BODY'
  assert.equal(original.split(begin).length,2); assert.equal(original.split(end).length,2)
  const [prefix,tail]=original.split(begin),[body,suffix]=tail.split(end)
  assert.equal(body,proposal,'guarded migration must embed the unchanged reviewed source bytes')
  const metadata=prefix.match(/\$hosted\$([\s\S]*?)\$hosted\$/)
  assert.ok(metadata,'hosted baseline JSON must be explicit')
  const baseline=JSON.parse(metadata[1])
  for(const spec of baseline.functions) assert.match(spec.signature,/^(?:hq_private|public|cron|realtime)\.[^.()]+\(/,'malformed production function signature must not be normalized by the fixture')
  return {original,prefix,body,suffix,begin,end,metadata:baseline,proposalSha256:createHash('sha256').update(body).digest('hex')}
}
export function adaptiveCatalogQuery(source,name) {
  const begin=`-- BEGIN ADAPTIVE CATALOG ${name}`,end=`-- END ADAPTIVE CATALOG ${name}`
  assert.equal(source.prefix.split(begin).length,2);assert.equal(source.prefix.split(end).length,2)
  let sql=source.prefix.split(begin)[1].split(end)[0]
  assert.equal(sql.match(/ into actual/g)?.length,1)
  sql=sql.replace(' into actual','')
  if(name==='FUNCTIONS')sql=sql.replaceAll("spec->>'signature'",'$1::text')
  if(name==='ROLES')sql=sql.replaceAll("spec->>'name'",'$1::text').replaceAll('owner_id',"(select oid from pg_catalog.pg_roles where rolname='postgres')")
  return sql
}
export async function adaptiveActivationForFixture(db) {
  const source=await readAdaptiveActivation(),expected=structuredClone(source.metadata),substitutions=[]
  const one=async(sql,args=[])=>(await db.query(sql,args)).rows[0]
  for(const spec of expected.functions) {
    const actual=Object.values(await one(adaptiveCatalogQuery(source,'FUNCTIONS'),[spec.signature]))[0]
    // Never replace owner/security/ACL expectations for application routines.
    // Only the explicitly copied provider and real extension packaging differ.
    const allowed=spec.signature.startsWith('cron.')||spec.signature.startsWith('realtime.')
      ? ['owner','acl','body_md5','definition_md5'] : ['body_md5','definition_md5']
    for(const key of Object.keys(spec)) {
      if(JSON.stringify(actual[key])===JSON.stringify(spec[key])) continue
      assert.ok(allowed.includes(key),`unapproved fixture metadata difference ${spec.signature}.${key}`)
      substitutions.push({field:`functions.${spec.signature}.${key}`,before:spec[key],after:actual[key],reason:'explicit synthetic provider/extension or repository SQL text baseline'})
      spec[key]=actual[key]
    }
  }
  // Preserve the actual authority/table contracts rather than substituting
  // them to whatever the fixture happens to contain.
  for(const role of expected.roles) {
    assert.deepEqual(Object.values(await one(adaptiveCatalogQuery(source,'ROLES'),[role.name]))[0],role,`role authority ${role.name}`)
  }
  for(const name of ['SCHEMA','TABLES','COLUMNS','CONSTRAINTS','INDEXES']) {
    assert.deepEqual(Object.values(await one(adaptiveCatalogQuery(source,name)))[0],expected[name.toLowerCase()],`unchanged hosted ${name} contract`)
  }
  const cronTable=Object.values(await one(adaptiveCatalogQuery(source,'CRON_TABLE')))[0]
  assert.equal(cronTable.rls,expected.cron_table.rls,'provider RLS must match')
  assert.deepEqual(await one("select has_table_privilege('postgres','cron.job','SELECT') read,has_table_privilege('postgres','cron.job','INSERT,UPDATE,DELETE,TRUNCATE') write"),{read:true,write:false})
  for(const key of ['owner','acl']) {
    substitutions.push({field:`cron_table.${key}`,before:expected.cron_table[key],after:cronTable[key],reason:'real extension installed by disposable provider, with owner SELECT-only authority'})
    expected.cron_table[key]=cronTable[key]
  }
  let prefix=source.prefix.replace(/\$hosted\$[\s\S]*?\$hosted\$/,()=>'$hosted$\n'+JSON.stringify(expected,null,2)+'\n$hosted$')
  let suffix=source.suffix
  const quote=value=>"'"+value.replaceAll("'","''")+"'"
  function replace(text,before,after,count,reason) {
    assert.equal(text.split(before).length-1,count,`expected exact substitution occurrence count: ${reason}`)
    substitutions.push({field:reason,before,after})
    return text.replaceAll(before,after)
  }
  const config=await one(`select current_database() database,current_setting('port') port,
    current_setting('cron.host') host,current_setting('cron.use_background_workers') mode,
    (select extversion from pg_extension where extname='pg_cron') version`)
  assert.equal((await one("select current_setting('server_version_num') version")).version,'170011','do not substitute PostgreSQL minor version')
  prefix=replace(prefix,"pg_catalog.current_database()<>'postgres'",`pg_catalog.current_database()<>${quote(config.database)}`,1,'disposable database name')
  prefix=replace(prefix,"extname='pg_cron') is distinct from '1.6.4'",`extname='pg_cron') is distinct from ${quote(config.version)}`,1,'actual upstream SQL extension version, not hosted package version')
  for(const [name,before,after] of [['cron.database_name','postgres',config.database],['cron.use_background_workers','off',config.mode],['cron.host','localhost',config.host]]) {
    prefix=replace(prefix,`current_setting('${name}',true) is distinct from '${before}'`,`current_setting('${name}',true) is distinct from ${quote(after)}`,1,`actual disposable ${name}`)
  }
  prefix=replace(prefix,"current_setting('port')<>'5432'",`current_setting('port')<>${quote(config.port)}`,1,'actual disposable server port')
  const port=Number(config.port);assert.equal(port,55439,'only the fixed isolated fixture is supported')
  prefix=replace(prefix,"database<>'postgres' or nodename<>'localhost' or nodeport<>5432",
    `database<>${quote(config.database)} or nodename<>${quote(config.host)} or nodeport<>${port}`,1,'hot destination expected metadata only')
  suffix=replace(suffix,"database='postgres' and nodename='localhost' and nodeport=5432",
    `database=${quote(config.database)} and nodename=${quote(config.host)} and nodeport=${port}`,1,'installed cold destination expected metadata only')
  return {...source,sql:prefix+source.begin+source.body+source.end+suffix,substitutions,config}
}
