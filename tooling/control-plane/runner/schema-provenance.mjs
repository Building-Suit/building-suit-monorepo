import { createHash } from 'node:crypto'
import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { healthQuery } from './dot-health-collector.mjs'

export const schemaFingerprintSql = `
WITH objects AS (
 SELECT 'relation:'||c.relname AS identity, jsonb_build_object('kind',c.relkind,'owner',pg_get_userbyid(c.relowner),'rls',c.relrowsecurity,'force_rls',c.relforcerowsecurity,'acl',coalesce(c.relacl::text,''),'index',CASE WHEN c.relkind IN ('i','I') THEN pg_get_indexdef(c.oid) ELSE NULL END,'view',CASE WHEN c.relkind IN ('v','m') THEN pg_get_viewdef(c.oid,true) ELSE NULL END) definition
 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='control'
 UNION ALL
 SELECT 'column:'||c.relname||':'||a.attname,jsonb_build_object('type',format_type(a.atttypid,a.atttypmod),'required',a.attnotnull,'identity',a.attidentity,'generated',a.attgenerated,'default',pg_get_expr(d.adbin,d.adrelid))
 FROM pg_attribute a JOIN pg_class c ON c.oid=a.attrelid JOIN pg_namespace n ON n.oid=c.relnamespace LEFT JOIN pg_attrdef d ON d.adrelid=a.attrelid AND d.adnum=a.attnum WHERE n.nspname='control' AND a.attnum>0 AND NOT a.attisdropped
 UNION ALL
 SELECT 'function:'||p.oid::regprocedure::text,jsonb_build_object('definition',pg_get_functiondef(p.oid),'owner',pg_get_userbyid(p.proowner),'acl',coalesce(p.proacl::text,'')) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='control' AND p.prokind IN ('f','p')
 UNION ALL
 SELECT 'constraint:'||c.conrelid::regclass::text||':'||c.conname,to_jsonb(pg_get_constraintdef(c.oid,true)) FROM pg_constraint c JOIN pg_namespace n ON n.oid=c.connamespace WHERE n.nspname='control' AND c.contype<>'n'
 UNION ALL
 SELECT 'trigger:'||t.tgrelid::regclass::text||':'||t.tgname,jsonb_build_object('definition',pg_get_triggerdef(t.oid,true),'enabled',t.tgenabled) FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='control' AND NOT t.tgisinternal
 UNION ALL
 SELECT 'policy:'||schemaname||'.'||tablename||':'||policyname,to_jsonb(p) FROM pg_policies p WHERE schemaname='control'
 UNION ALL
 SELECT 'schema:control',jsonb_build_object('owner',pg_get_userbyid(nspowner),'acl',coalesce(nspacl::text,'')) FROM pg_namespace WHERE nspname='control'
 UNION ALL
 SELECT 'role:'||rolname,jsonb_build_object('superuser',rolsuper,'create_role',rolcreaterole,'create_database',rolcreatedb,'bypass_rls',rolbypassrls,'replication',rolreplication,'memberships',(SELECT coalesce(jsonb_agg(parent.rolname ORDER BY parent.rolname),'[]') FROM pg_auth_members m JOIN pg_roles parent ON parent.oid=m.roleid WHERE m.member=r.oid)) FROM pg_roles r WHERE rolname LIKE 'bs_control_%'
 UNION ALL
 SELECT 'default-acl:'||pg_get_userbyid(d.defaclrole)||':'||d.defaclobjtype::text,jsonb_build_object('owner',pg_get_userbyid(d.defaclrole),'acl',d.defaclacl::text) FROM pg_default_acl d JOIN pg_namespace n ON n.oid=d.defaclnamespace WHERE n.nspname='control'
)
SELECT jsonb_agg(jsonb_build_object('identity',identity,'definition',definition) ORDER BY identity) FROM objects;
`
const digest = value => createHash('sha256').update(value).digest('hex')
export function migrationChecksums(sourceRoot) {
 const directory=path.join(sourceRoot,'tooling/control-plane/sql')
 return readdirSync(directory).filter(name=>/^\d{3}_.+\.sql$/.test(name)).sort().map(name=>({version:Number(name.slice(0,3)),file:name,sha256:digest(readFileSync(path.join(directory,name)))}))
}
export function fingerprintSchema(snapshot) {
 if(!Array.isArray(snapshot)||snapshot.length===0)throw Error('complete_control_schema_snapshot_required')
 return digest(JSON.stringify(normalizeSchemaSnapshot(snapshot)))
}
export function normalizeSchemaSnapshot(snapshot) {
 return snapshot.map(item=>{
  const definition=structuredClone(item.definition)
  if(definition&&typeof definition==='object'&&typeof definition.acl==='string'){
   let entries=definition.acl.slice(1,-1).split(',').filter(Boolean)
   // NULL function ACL means PostgreSQL's PUBLIC EXECUTE default. Owners have
   // intrinsic rights; omitting their redundant ACL also permits PG17/PG18
   // attestation without inventing a PG18 MAINTAIN privilege on PG17.
   if(!definition.acl&&item.identity.startsWith('function:'))entries=['=X/'+definition.owner]
   definition.acl=entries.filter(entry=>!entry.startsWith(definition.owner+'=')).map(entry=>{
    const [subject,rights]=entry.split('='),[permissions,grantor]=rights.split('/')
    return subject+'='+(permissions.match(/[^*]\*?/g)??[]).sort().join('')+'/'+grantor
   }).sort()
  }
  return {...item,definition}
 }).sort((a,b)=>a.identity.localeCompare(b.identity,'en'))
}
export function compareSchemaSnapshots(canonical,live) {
 const expected=new Map(normalizeSchemaSnapshot(canonical).map(item=>[item.identity,item.definition]))
 const actual=new Map(normalizeSchemaSnapshot(live).map(item=>[item.identity,item.definition]))
 return [...new Set([...expected.keys(),...actual.keys()])].sort().filter(key=>JSON.stringify(expected.get(key))!==JSON.stringify(actual.get(key))).map(identity=>({identity,canonical:expected.get(identity)??null,live:actual.get(identity)??null}))
}
if(process.argv[1]===fileURLToPath(import.meta.url)) {
 const snapshot=healthQuery(schemaFingerprintSql,process.env)
 process.stdout.write(JSON.stringify({schema_fingerprint:fingerprintSchema(snapshot),snapshot})+'\n')
}

export function exactMigrationTransaction({migrationName,sql,expectedChecksum,sourceCommit,projectRef,baselineId}) {
 if(!/^\d{3}_[a-z0-9_]+\.sql$/.test(migrationName)||digest(sql)!==expectedChecksum||!/^[a-f0-9]{40}$/.test(sourceCommit)||!/^[a-z]{20}$/.test(projectRef)||!/^[a-f0-9-]{36}$/.test(baselineId))throw Error('exact_environment_bound_migration_provenance_required')
 const body=sql.trim().replace(/^BEGIN;\s*/i,'').replace(/\s*COMMIT;$/i,'')
 const topLevel=body.replace(/\$([a-zA-Z_][a-zA-Z_0-9]*|)\$[\s\S]*?\$\1\$/g,'').replace(/'(?:''|[^'])*'/g,"''").replace(/--[^\n]*/g,'').replace(/\/\*[\s\S]*?\*\//g,'')
 if(/(?:^|;)\s*(?:BEGIN|COMMIT|ROLLBACK)\b/i.test(topLevel)||/^\s*\\/m.test(topLevel))throw Error('single_migration_transaction_required')
 // No ON CONFLICT overwrite: a repeated or different checksum is an explicit
 // reconciliation case, never a silent assertion that SQL was newly applied.
 return `BEGIN;\nSELECT pg_advisory_xact_lock(hashtextextended('control-schema-migration',0));\nSET LOCAL ROLE bs_control_migration_owner;\nDO $guard$ BEGIN\nIF NOT EXISTS(SELECT 1 FROM control.control_schema_adoption_baselines WHERE baseline_id='${baselineId}'::uuid AND project_ref='${projectRef}') THEN RAISE EXCEPTION 'verified_control_adoption_baseline_required';END IF;\nIF EXISTS(SELECT 1 FROM control.migration_release_ledger WHERE migration_name='${migrationName}') THEN RAISE EXCEPTION 'migration_already_recorded_requires_checksum_reconciliation';END IF;\nEND $guard$;\n${body}\nINSERT INTO control.migration_release_ledger(migration_name,source_sha256,source_commit,project_ref,evidence_kind,evidence) VALUES('${migrationName}','${expectedChecksum}','${sourceCommit}','${projectRef}','applied_transaction',jsonb_build_object('baseline_id','${baselineId}','serialized',true));\nCOMMIT;\n`
}
