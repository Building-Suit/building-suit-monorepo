import { readFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { assertLocalFixtureEnvironment } from './e2e/safety.mjs'

const root = fileURLToPath(new URL('../../../', import.meta.url))
export function validateLocalDoctorTarget(registry, config, environment = {}) {
  assertLocalFixtureEnvironment(environment)
  const doctor = registry.products['doctor-suit']
  if (doctor?.cliWorkdir !== 'apps/doctor-suit' || doctor.local.projectId !== 'building-suit-doctor'
    || doctor.local.databasePort !== 65322 || doctor.local.apiUrl !== 'http://127.0.0.1:65321'
    || !/^project_id = "building-suit-doctor"$/m.test(config)) throw new Error('Doctor local target mismatch')
  for (const [section, port] of [['api', 65321], ['db', 65322]]) {
    const body = config.split(`[${section}]`)[1]?.split('\n[')[0] ?? ''
    if (!new RegExp(`^port = ${port}$`, 'm').test(body)) throw new Error('Doctor local port mismatch')
  }
  for (const [name, product] of Object.entries(registry.products)) {
    if (name === 'doctor-suit') continue
    if (product.local.projectId === doctor.local.projectId || product.local.databasePort === doctor.local.databasePort
      || product.local.apiUrl === doctor.local.apiUrl) throw new Error('Doctor local product collision')
  }
  return doctor
}

export const commands = Object.freeze({
  start: ['start'], reset: ['db', 'reset', '--local'], test: ['test', 'db', '--local'],
  types: ['gen', 'types', 'typescript', '--local', '--schema', 'public'], stop: ['stop', '--no-backup'],
})
export function runLocalLifecycle(action) {
  const registry = JSON.parse(readFileSync(`${root}docs/architecture/environments.json`, 'utf8'))
  validateLocalDoctorTarget(registry, readFileSync(`${root}apps/doctor-suit/supabase/config.toml`, 'utf8'), process.env)
  if (!Object.hasOwn(commands, action)) throw new Error('Choose start, reset, test, types or stop')
  if (existsSync(`${root}apps/doctor-suit/supabase/.temp/project-ref`)) throw new Error('Refusing a linked Doctor CLI directory')
  const result = spawnSync('pnpm', ['db', 'doctor-suit', ...commands[action]], {
    cwd: root, encoding: 'utf8', stdio: action === 'types' ? ['ignore', 'pipe', 'inherit'] : 'inherit',
  })
  if (result.error) throw result.error
  if (result.status !== 0) throw new Error('Local Doctor lifecycle failed')
  if (action === 'types') {
    // The root pnpm selector emits its own banner. Keep only the CLI's generated schema declaration.
    const source = result.stdout.slice(result.stdout.indexOf('export type Json'))
    if (!source.startsWith('export type Json') || !source.includes('doctor_onboard:')) throw new Error('Invalid generated Doctor type output')
    mkdirSync(`${root}apps/doctor-suit/app/types`, { recursive: true })
    writeFileSync(`${root}apps/doctor-suit/app/types/database.types.ts`, source)
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) runLocalLifecycle(process.argv[2])
