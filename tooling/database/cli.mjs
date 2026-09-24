import { spawnSync } from 'node:child_process'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
const [product, ...args] = process.argv.slice(2)
const registry = JSON.parse(await readFile(new URL('../../docs/architecture/environments.json', import.meta.url), 'utf8'))
const products = Object.keys(registry.products).join('|')
if (!Object.hasOwn(registry.products, product || '') || args.length === 0) {
  console.error(`Usage: pnpm db <${products}> <Supabase CLI command...>`); process.exit(1)
}
if (args.includes('--workdir') || args.some(arg => arg.startsWith('--workdir='))) throw new Error('The product determines the CLI working directory')
// A convenience selector, not deployment authorization. Remote operations require preflight.
const result = spawnSync('pnpm', ['exec', 'supabase', '--workdir', registry.products[product].cliWorkdir, ...args], { stdio: 'inherit', cwd: fileURLToPath(new URL('../../', import.meta.url)) })
if (result.error) throw result.error
process.exitCode = result.status ?? 1
