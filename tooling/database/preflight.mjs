import { readFile } from 'node:fs/promises'
import { parseEnv } from 'node:util'
import { fileURLToPath } from 'node:url'
import { resolve } from 'node:path'
import { validateEnvironment } from './environment.mjs'
const root = fileURLToPath(new URL('../../', import.meta.url))
const [product, environment] = process.argv.slice(2)
try {
  const registry = JSON.parse(await readFile(resolve(root, 'docs/architecture/environments.json'), 'utf8'))
  const products = Object.keys(registry.products).join('|')
  if (!Object.hasOwn(registry.products, product || '') || !['production', 'staging'].includes(environment)) throw new Error(`Usage: pnpm db:preflight <${products}> <production|staging>`)
  if (!registry.products[product][environment].projectRef) throw new Error('Enter the verified project ref in docs/architecture/environments.json first')
  const secret = parseEnv(await readFile(resolve(root, `supabase/environments/${product}/.env.${environment}`), 'utf8'))
  const app = parseEnv(await readFile(resolve(root, `apps/${product}/.env.${environment}`), 'utf8'))
  console.log(validateEnvironment(registry, product, environment, app, secret))
} catch (error) {
  console.error(`Configuration incomplete: ${error.message}`)
  process.exitCode = 1
}
