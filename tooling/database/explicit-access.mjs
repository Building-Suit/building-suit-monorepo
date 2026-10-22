import { readFile, writeFile } from 'node:fs/promises'
import { pathToFileURL } from 'node:url'

const clients = ['anon', 'authenticated', 'service_role']
const unsafeTablePrivileges = new Set(['TRUNCATE', 'REFERENCES', 'TRIGGER', 'MAINTAIN'])
const literal = value => `'${String(value).replaceAll("'", "''")}'`
const identifier = value => `"${String(value).replaceAll('"', '""')}"`
const array = values => `ARRAY[${values.map(literal).join(',')}]::text[]`

// Reviewed schema/ACL metadata only. Concrete grants support replay with no auto grants.
export function renderExplicitAccess(snapshot, schemas) {
  if (!Array.isArray(schemas) || !schemas.length || schemas.some(s => !/^[a-z][a-z0-9_]*$/.test(s))) throw new Error('Explicit application schemas required')
  if (schemas.some(s => ['auth', 'storage', 'realtime', 'vault', 'extensions', 'graphql', 'graphql_public', 'supabase_migrations'].includes(s))) throw new Error('Provider schema changes forbidden')
  const relations = (snapshot.relations ?? []).filter(r => schemas.includes(r.schema)).sort((a, b) => `${a.schema}.${a.name}`.localeCompare(`${b.schema}.${b.name}`))
  const functions = (snapshot.functions ?? []).filter(f => schemas.includes(f.schema)).sort((a, b) => `${a.schema}.${a.name}(${a.signature})`.localeCompare(`${b.schema}.${b.name}(${b.signature})`))
  const owners = [...new Set(['postgres', ...relations.map(o => o.owner), ...functions.map(o => o.owner)])].sort()
  if (owners.some(o => !['postgres', 'bs_control_migration_owner'].includes(o))) throw new Error('Unreviewed object owner')
  const rows = []
  for (const relation of relations) {
    if (!['r', 'p', 'v', 'm', 'S'].includes(relation.kind)) throw new Error('Unexpected relation kind')
    for (const grant of relation.grants ?? []) if (!['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER', 'MAINTAIN', 'USAGE'].includes(grant.privilege)) throw new Error('Unexpected relation privilege')
    const grants = new Map()
    for (const grant of relation.grants ?? []) for (const role of grant.role === 'PUBLIC' ? clients : [grant.role]) {
      if (role === relation.owner) continue
      if (['anon', 'authenticated'].includes(role) && relation.kind !== 'S' && unsafeTablePrivileges.has(grant.privilege)) continue
      if (!grants.has(role)) grants.set(role, new Set())
      grants.get(role).add(grant.privilege)
    }
    for (const [role, privileges] of [...grants].sort()) rows.push(`    (${literal(relation.schema)},${literal(relation.name)},${literal(relation.kind === 'S' ? 'SEQUENCE' : 'TABLE')},${literal([...privileges].sort().join(','))},${literal(role)})`)
  }
  const routineRows = []
  for (const fn of functions) {
    const roles = new Set()
    for (const grant of fn.grants ?? []) {
      if (grant.privilege !== 'EXECUTE') throw new Error('Unexpected routine privilege')
      for (const role of grant.role === 'PUBLIC' ? clients : [grant.role]) if (role !== fn.owner) roles.add(role)
    }
    // Trigger execution is checked at CREATE TRIGGER, not each time it fires.
    if (['trigger', 'event_trigger'].includes(fn.returns)) { roles.delete('anon'); roles.delete('authenticated') }
    routineRows.push(`    (${literal(fn.schema)},${literal(fn.name)},${literal(fn.signature)},${array([...roles].sort())})`)
  }
  const schemaNames = schemas.map(identifier).join(',')
  const defaults = owners.flatMap(owner => [
    `ALTER DEFAULT PRIVILEGES FOR ROLE ${identifier(owner)} IN SCHEMA ${schemaNames} REVOKE ALL ON TABLES FROM PUBLIC,anon,authenticated,service_role;`,
    `ALTER DEFAULT PRIVILEGES FOR ROLE ${identifier(owner)} IN SCHEMA ${schemaNames} REVOKE ALL ON SEQUENCES FROM PUBLIC,anon,authenticated,service_role;`,
    `ALTER DEFAULT PRIVILEGES FOR ROLE ${identifier(owner)} IN SCHEMA ${schemaNames} REVOKE ALL ON FUNCTIONS FROM PUBLIC,anon,authenticated,service_role;`,
    // A schema-local revoke cannot remove PostgreSQL's global PUBLIC EXECUTE.
    `ALTER DEFAULT PRIVILEGES FOR ROLE ${identifier(owner)} REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;`,
  ]).join('\n')
  return `-- Explicit Data API access: compatible with the 2026-10-30 Supabase defaults.\n-- Audited grants preserve application/RLS access on clean replay. No row changes.\n-- Absent objects belong to pending releases; this migration does not deploy them.\nBEGIN;\nSET LOCAL lock_timeout='5s';\nSET LOCAL statement_timeout='60s';\n${defaults}\n\nDO $access$\nDECLARE item record;\nBEGIN\n${rows.length ? `  FOR item IN SELECT * FROM (VALUES\n${rows.join(',\n')}\n  ) AS allowed(schema_name,object_name,object_kind,privileges,role_name) LOOP\n    IF to_regclass(format('%I.%I',item.schema_name,item.object_name)) IS NOT NULL THEN\n      EXECUTE format('GRANT %s ON %s %I.%I TO %I',item.privileges,item.object_kind,item.schema_name,item.object_name,item.role_name);\n    END IF;\n  END LOOP;` : ''}\n  FOR item IN SELECT n.nspname,c.relname FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace\n    WHERE n.nspname=ANY(${array(schemas)}) AND c.relkind IN ('r','p','v','m')\n  LOOP\n    EXECUTE format('REVOKE TRUNCATE,REFERENCES,TRIGGER ON TABLE %I.%I FROM PUBLIC,anon,authenticated',item.nspname,item.relname);\n    IF current_setting('server_version_num')::integer>=170000 THEN\n      EXECUTE format('REVOKE MAINTAIN ON TABLE %I.%I FROM PUBLIC,anon,authenticated',item.nspname,item.relname);\n    END IF;\n  END LOOP;\nEND $access$;\n\nDO $routines$\nDECLARE item record; target text; role_name text;\nBEGIN\n${routineRows.length ? `  FOR item IN SELECT * FROM (VALUES\n${routineRows.join(',\n')}\n  ) AS allowed(schema_name,routine_name,arguments,roles) LOOP\n    IF EXISTS(SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace\n      WHERE n.nspname=item.schema_name AND p.proname=item.routine_name\n        AND pg_get_function_identity_arguments(p.oid)=item.arguments) THEN\n      target:=format('%I.%I(%s)',item.schema_name,item.routine_name,item.arguments);\n      FOREACH role_name IN ARRAY item.roles LOOP\n        EXECUTE format('GRANT EXECUTE ON ROUTINE %s TO %I',target,role_name);\n      END LOOP;\n      EXECUTE format('REVOKE EXECUTE ON ROUTINE %s FROM PUBLIC',target);\n    END IF;\n  END LOOP;` : ''}\n  FOR item IN SELECT p.oid::regprocedure AS signature FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace\n    WHERE n.nspname=ANY(${array(schemas)}) AND p.prorettype IN ('trigger'::regtype,'event_trigger'::regtype)\n      AND NOT EXISTS(SELECT 1 FROM pg_depend d WHERE d.classid='pg_proc'::regclass AND d.objid=p.oid AND d.deptype='e')\n  LOOP EXECUTE format('REVOKE EXECUTE ON ROUTINE %s FROM PUBLIC,anon,authenticated',item.signature); END LOOP;\nEND $routines$;\nNOTIFY pgrst,'reload schema';\nCOMMIT;\n`
}

async function main() {
  const [input, output, ...schemas] = process.argv.slice(2)
  if (!input || !output) throw new Error('Usage: node tooling/database/explicit-access.mjs <reviewed-catalog.json> <migration.sql> <application-schema...>')
  await writeFile(output, renderExplicitAccess(JSON.parse(await readFile(input, 'utf8')), schemas))
}
if (import.meta.url === pathToFileURL(process.argv[1] || '').href) main().catch(error => { console.error(error.message); process.exitCode = 1 })
