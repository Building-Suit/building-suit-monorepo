import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { validateLocalDoctorTarget, commands } from '../local-lifecycle.mjs'

const root = new URL('../../../../', import.meta.url)
const registry = JSON.parse(readFileSync(new URL('docs/architecture/environments.json', root), 'utf8'))
const config = readFileSync(new URL('apps/doctor-suit/supabase/config.toml', root), 'utf8')

test('DOS-M1-003: local target is isolated and hosted refs remain unprovisioned', () => {
  const doctor = validateLocalDoctorTarget(registry, config)
  for (const kind of ['production', 'staging']) assert.deepEqual(doctor[kind], { projectRef: '', appUrl: '', status: 'unprovisioned; user-managed connections' })
  assert.equal(doctor.organizationId, '')
  assert.equal(doctor.schema, 'public')
  assert.deepEqual(commands.reset, ['db', 'reset', '--local'])
  assert.deepEqual(commands.test, ['test', 'db', '--local'])
  assert.ok(Object.values(commands).flat().every(arg => !['--linked', '--db-url', '--project-ref', 'push'].includes(arg)))
})

test('DOS-M1-003: lifecycle fails closed for target drift and another product collision', () => {
  assert.throws(() => validateLocalDoctorTarget(registry, config.replace('port = 65322', 'port = 61322')), /port mismatch/)
  assert.throws(() => validateLocalDoctorTarget(registry, config.replace('building-suit-doctor', 'building-suit-shop')), /target mismatch/)
  const changed = structuredClone(registry)
  changed.products['doctor-suit'].local.databasePort = changed.products['shop-suit'].local.databasePort
  assert.throws(() => validateLocalDoctorTarget(changed, config), /target mismatch/)
  const duplicate = structuredClone(registry)
  duplicate.products['shop-suit'].local.projectId = 'building-suit-doctor'
  assert.throws(() => validateLocalDoctorTarget(duplicate, config), /collision/)
  assert.throws(() => validateLocalDoctorTarget(registry, config, { SUPABASE_URL: 'https://hosted.example.test' }), /rejected/)
})
