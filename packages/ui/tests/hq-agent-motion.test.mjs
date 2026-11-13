import test from 'node:test'
import assert from 'node:assert/strict'
import { createHqAgentMotion } from '../src/utils/hqAgentCharacters.ts'
import { layoutDepartmentOffices } from '../src/utils/departmentOfficeLayout.ts'

const ids = ['AG-CEO-001', 'AG-HR-001', 'AG-HR-002', 'AG-HR-003', 'AG-RES-001', 'AG-SALES-001', 'AG-CS-001', 'AG-SOC-001', 'AG-EMAIL-001', 'AG-DEV-001']
const departmentId = '10000000-0000-4000-8000-000000000001'
const layout = layoutDepartmentOffices([{ id: departmentId, name: 'Fixture department', approvedAt: '2026-01-01T00:00:00Z', agents: ids.slice(1).map(id => ({ id, name: id })) }])
const roster = Object.freeze(ids.map((id, index) => Object.freeze({ id, name: id, role: index ? 'agent' : 'ceo', departmentId: index ? departmentId : null, deskIndex: Math.max(0, index - 1), activity: 'offline', cosmeticIdle: true })))

test('all configured cosmetic characters are visible and spaced without claiming live activity', () => {
  const motion = createHqAgentMotion()
  const poses = motion.update(layout, roster, 0)
  assert.equal(poses.filter(pose => pose.visible).length, 10)
  assert.ok(poses.every(pose => pose.mode !== 'working'))
  assert.ok(roster.every(agent => agent.activity === 'offline'))
  for (let index = 0; index < poses.length; index++) for (const other of poses.slice(index + 1)) {
    assert.ok(Math.hypot(poses[index].x - other.x, poses[index].z - other.z) > 0.9)
  }
  const hidden = motion.update(layout, roster.map(agent => ({ ...agent, cosmeticIdle: false })), 0.1)
  assert.ok(hidden.every(pose => !pose.visible))
})

test('actual work immediately uses its assigned office and cannot be replaced by cosmetic work', () => {
  const motion = createHqAgentMotion()
  const employee = roster[1]
  motion.update(layout, [employee], 0)
  const working = motion.update(layout, [{ ...employee, activity: 'working', cosmeticIdle: false }], 0.1)[0]
  assert.equal(working.visible, true)
  assert.equal(working.mode, 'working')
  const office = layout.offices[0], dx = working.x - office.x, dz = working.z - office.z
  assert.ok(Math.abs(Math.cos(office.yaw) * dx - Math.sin(office.yaw) * dz) < office.width / 2)
  assert.ok(Math.abs(Math.sin(office.yaw) * dx + Math.cos(office.yaw) * dz) < office.depth / 2)
  const unassigned = motion.update(layout, [{ ...employee, departmentId: null, activity: 'working', cosmeticIdle: true }], 0.2)[0]
  assert.equal(unassigned.visible, false)
})
