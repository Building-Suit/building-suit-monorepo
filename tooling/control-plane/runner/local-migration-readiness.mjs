import { readFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import path from 'node:path'

// Ignore formatting/comments outside quoted SQL. Dollar bodies and string
// contents remain exact: a source change must never be treated as fresh.
export function canonicalMigrationSql(sql) {
  const tokens = []
  let i = 0
  while (i < sql.length) {
    if (/\s/.test(sql[i])) { i++; continue }
    if (sql.startsWith('--', i)) {
      const end = sql.indexOf('\n', i); i = end < 0 ? sql.length : end + 1; continue
    }
    if (sql.startsWith('/*', i)) {
      let depth = 1; i += 2
      while (depth && i < sql.length) {
        if (sql.startsWith('/*', i)) { depth++; i += 2 }
        else if (sql.startsWith('*/', i)) { depth--; i += 2 }
        else i++
      }
      if (depth) throw new Error('unterminated_sql_comment')
      continue
    }
    const dollar = sql.slice(i).match(/^\$(?:[A-Za-z_][A-Za-z0-9_]*)?\$/)?.[0]
    if (dollar) {
      const end = sql.indexOf(dollar, i + dollar.length)
      if (end < 0) throw new Error('unterminated_sql_dollar_body')
      tokens.push(sql.slice(i, end + dollar.length)); i = end + dollar.length; continue
    }
    if (sql[i] === "'" || sql[i] === '"') {
      const start = i; const quote = sql[i++]
      let closed = false
      while (i < sql.length) {
        if (sql[i] === quote) {
          if (sql[i + 1] === quote) { i += 2; continue }
          i++; closed = true; break
        }
        i++
      }
      if (!closed) throw new Error('unterminated_sql_quote')
      tokens.push(sql.slice(start, i)); continue
    }
    const word = sql.slice(i).match(/^[A-Za-z_0-9]+/)?.[0]
    if (word) { tokens.push(word); i += word.length }
    else tokens.push(sql[i++])
  }
  while (tokens.at(-1) === ';') tokens.pop()
  return JSON.stringify(tokens)
}

function queryLocalShopVersions(versions) {
  // Fixed disposable local container; never accept a DSN, hosted ref or URL.
  const sql = `SELECT COALESCE(jsonb_agg(to_jsonb(m)), '[]'::jsonb) FROM supabase_migrations.schema_migrations m WHERE version IN (${versions.map(v => `'${v}'`).join(',')});`
  const result = spawnSync('docker', ['exec', 'supabase_db_building-suit-shop', 'psql', '-U', 'postgres', '-d', 'postgres', '-At', '-v', 'ON_ERROR_STOP=1', '-c', sql], {encoding:'utf8',timeout:30000,maxBuffer:20*1024*1024})
  if (result.status !== 0 || result.error) throw new Error('local_shop_migration_history_unavailable')
  return JSON.parse(result.stdout)
}

export function localShopMigrationReadiness({ worktreePath, changedFiles, query = queryLocalShopVersions }) {
  const migrations = changedFiles.filter(file => /^apps\/shop-suit\/supabase\/migrations\/\d+_[A-Za-z0-9_-]+\.sql$/.test(file))
  if (!migrations.length) return {ready:true,checked:[]}
  try {
    const versions = migrations.map(f => path.basename(f).split('_')[0])
    const rows = query(versions)
    const stale = migrations.filter(file => {
      const row = rows.find(r => r.version === path.basename(file).split('_')[0])
      if (!row) return false // migration up may apply a new version normally.
      if (!Array.isArray(row.statements) || !row.statements.length) return true
      return canonicalMigrationSql(readFileSync(path.join(worktreePath,file),'utf8')) !== canonicalMigrationSql(row.statements.join(';\n'))
    })
    return stale.length ? {ready:false,reason:'local_applied_migration_source_changed',files:stale,failure_class:'verification-infrastructure'} : {ready:true,checked:migrations}
  } catch {
    return {ready:false,reason:'local_migration_freshness_unavailable',files:migrations,failure_class:'verification-infrastructure'}
  }
}
