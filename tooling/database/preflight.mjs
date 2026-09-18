import { readFile } from 'node:fs/promises'
const environment = process.argv[2]
if (!['production', 'staging'].includes(environment)) throw new Error('Choose exactly production or staging')
const map = JSON.parse(await readFile(new URL('../../docs/architecture/environments.json', import.meta.url), 'utf8'))
const target = map[environment]
if (!target.projectRef) throw new Error(`${environment}: no verified immutable project ref is configured`)
if (process.env.SUPABASE_PROJECT_REF !== target.projectRef) throw new Error(`${environment}: SUPABASE_PROJECT_REF does not match the environment map`)
if (target.projectRef === map.shopSource.projectRef) throw new Error('The source project cannot be a migration destination')
console.log(`${environment}: configured project ref matches. Live access, backup and migration-state verification are still required.`)
