import { readFile, readdir } from 'node:fs/promises'
import { fileURLToPath, pathToFileURL } from 'node:url'
import path from 'node:path'

// Historical migrations stay immutable. Newly added files, including backdated
// stacked features, must declare access beside CREATE, not rely on platform defaults.
export function validateMigrationAccess(sql) {
  const text = sql.replace(/\/\*[\s\S]*?\*\//g, '').replace(/--[^\n]*/g, '')
  const failures = []
  const objects = /\bcreate\s+(?:or\s+replace\s+)?(table|function|procedure)\s+(?:if\s+not\s+exists\s+)?(?:"?([a-z_][\w]*)"?\.)?"?([a-z_][\w]*)"?/gi
  for (const match of text.matchAll(objects)) {
    const [, kind, schema = 'public', name] = match
    const qualified = `(?<![\\w"])(?:"?${schema}"?\\.)?"?${name}"?(?![\\w])`
    // Direct named declarations are deliberately required for new migrations.
    // Catalog/DO loops remain valid SQL, but need a named GRANT/REVOKE declaration.
    if (!new RegExp(`\\b(?:grant|revoke)\\b[^;]*${qualified}[^;]*\\b(?:to|from)\\b[^;]*\\b(?:anon|authenticated|service_role|public)\\b`, 'i').test(text)) failures.push(`${schema}.${name}: declare explicit GRANT/REVOKE in its creating migration`)
    if (kind.toLowerCase() === 'table' && !new RegExp(`\\balter\\s+table\\s+${qualified}\\s+enable\\s+row\\s+level\\s+security`, 'i').test(text)) failures.push(`${schema}.${name}: enable RLS explicitly in its creating migration`)
  }
  return [...new Set(failures)]
}

export async function validateExplicitAccess(root) {
  const policy = JSON.parse(await readFile(path.join(root, 'tooling/database/explicit-access-baseline.json'), 'utf8'))
  const failures = []
  for (const app of await readdir(path.join(root, 'apps'))) {
    const directory = path.join(root, 'apps', app, 'supabase')
    let config
    try { config = await readFile(path.join(directory, 'config.toml'), 'utf8') }
    catch (error) { if (error.code === 'ENOENT') continue; throw error }
    const api = config.match(/\[api\]([\s\S]*?)(?=\n\[|$)/)?.[1] ?? ''
    if (!/^auto_expose_new_tables\s*=\s*false\s*$/m.test(api)) failures.push(`${app}: set api.auto_expose_new_tables=false`)
    let migrations
    try { migrations = await readdir(path.join(directory, 'migrations')) }
    catch (error) { if (error.code === 'ENOENT') continue; throw error }
    for (const file of migrations.filter(f => f.endsWith('.sql'))) {
      const relative = `apps/${app}/supabase/migrations/${file}`
      if (policy.historicalMigrations.includes(relative)) continue
      for (const failure of validateMigrationAccess(await readFile(path.join(root, relative), 'utf8'))) failures.push(`${relative}: ${failure}`)
    }
  }
  return failures
}
if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  const failures = await validateExplicitAccess(fileURLToPath(new URL('../../', import.meta.url)))
  if (failures.length) { console.error(failures.join('\n')); process.exitCode = 1 }
  else console.log('Explicit Data API configuration and new-migration access declarations passed')
}
