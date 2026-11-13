import test from 'node:test'
import assert from 'node:assert/strict'
import { createOfficeArchitecture, departmentDeskLayout, officeFurnitureFootprints } from '../src/utils/officeArchitecture.ts'
import { layoutDepartmentOffices, workplaceFootprint } from '../src/utils/departmentOfficeLayout.ts'
import { createOrganicOfficeFootprint, createOrganicOfficePlatform, organicContains, organicFootprintGap, organicBoundaryAtX, organicPrismIntersection, pointSegmentDistance } from '../src/utils/organicOfficePlatform.ts'

const department = (index, count) => ({ id: `department-${index}`, name: `Office ${index}`, approvedAt: '2026-11-05', agents: Array.from({ length: count }, (_, i) => ({ id: `${index}-${i}`, name: `Agent ${i}` })) })
const area = points => Math.abs(points.reduce((sum, p, i) => { const q = points[(i + 1) % points.length]; return sum + p.x * q.z - q.x * p.z }, 0)) / 2
function distance(outline, p) { return Math.min(...outline.map((a, i) => pointSegmentDistance(p, a, outline[(i + 1) % outline.length]))) }

test('curved floors keep all furniture inside the unchanged radial allocation', () => {
  for (const count of [0, 1, 2, 3, 4, 9, 24, 256]) {
    const office = layoutDepartmentOffices([department(0, count)]).offices[0]
    const architecture = createOfficeArchitecture(office.width, office.depth)
    const bounds = officeFurnitureFootprints(architecture, count)
    assert.equal(bounds.length, count + 4)
    for (const box of bounds) for (const x of [box.min[0], box.max[0]]) for (const z of [box.min[2], box.max[2]]) {
      assert.ok(organicContains(office.platform.outline, { x, z }))
      assert.ok(distance(office.platform.outline, { x, z }) >= 0.1, `${count} desks: insufficient clearance`)
    }
    // A concave shoulder must not cut through an object's middle while its
    // four corners happen to remain inside. Check whole projected edges too.
    for (const box of bounds) for (let step = 0; step <= 8; step++) {
      const x = box.min[0] + (box.max[0] - box.min[0]) * step / 8
      const z = box.min[2] + (box.max[2] - box.min[2]) * step / 8
      for (const p of [{ x, z: box.min[2] }, { x, z: box.max[2] }, { x: box.min[0], z }, { x: box.max[0], z }]) {
        assert.ok(organicContains(office.platform.outline, p)); assert.ok(distance(office.platform.outline, p) >= 0.1)
      }
    }
    const ceo = layoutDepartmentOffices([]).executive
    for (const box of officeFurnitureFootprints(createOfficeArchitecture(), 1, true)) for (const x of [box.min[0], box.max[0]]) for (const z of [box.min[2], box.max[2]]) assert.ok(distance(ceo.platform.outline, { x, z }) >= 0.1)
  }
})

test('existing desk-row dimensions remain; ID seeds and furniture give stable distinct silhouettes', () => {
  const areas = [1, 2, 3, 4, 9].map(count => area(layoutDepartmentOffices([department(0, count)]).offices[0].platform.outline))
  assert.ok(areas[4] > areas[0])
  for (const count of [1, 2, 3, 4, 9]) { const office = layoutDepartmentOffices([department(0, count)]).offices[0]; assert.equal(office.width, 6.2); assert.equal(office.depth, departmentDeskLayout(count).depth) }
  const departments = Array.from({ length: 8 }, (_, i) => department(i, 2))
  const first = layoutDepartmentOffices(departments), reload = layoutDepartmentOffices(departments)
  assert.deepEqual(first, reload)
  assert.equal(new Set(first.offices.map(o => JSON.stringify(o.platform.outline))).size, 8)
  const architecture = createOfficeArchitecture(), furnitureBounds = officeFurnitureFootprints(architecture, 2)
  const base = { seed: 'same', deskCount: 2, furnitureBounds }
  const a = createOrganicOfficeFootprint({ ...base, deskCenters: departmentDeskLayout(2).desks })
  const b = createOrganicOfficeFootprint({ ...base, deskCenters: [{ x: -1, z: -1 }, { x: 1, z: 1 }] })
  assert.notDeepEqual(a.outline, b.outline)
})

test('original ring/island dimensions and office transforms stay fixed while floors do not overlap', () => {
  for (const count of [0, 7, 15, 32]) {
    const layout = layoutDepartmentOffices(Array.from({ length: count }, (_, i) => department(i, i % 5 + 1)))
    const offices = [layout.executive, ...layout.offices], outlines = offices.map(workplaceFootprint)
    const bandDepth = Math.max(7, ...layout.offices.map(o => o.depth + 1.8))
    for (const office of offices) {
      assert.ok(Math.abs(Math.hypot(office.x, office.z) - (7 + (office.ring - 0.5) * bandDepth)) < 1e-8)
      assert.equal(office.sector.outerRadius, 7 + office.ring * bandDepth)
    }
    assert.equal(layout.floorRadius, 7 + layout.layerCount * bandDepth + 0.8)
    for (const outline of outlines) {
      assert.equal(outline.length, 128)
      assert.ok(distance(outline, { x: 0, z: 0 }) >= 7 - 1e-8)
      assert.ok(outline.every(p => Math.hypot(p.x, p.z) < layout.floorRadius))
    }
    for (let i = 0; i < offices.length; i++) for (let j = i + 1; j < offices.length; j++) {
      if (Math.hypot(offices[i].x - offices[j].x, offices[i].z - offices[j].z) > offices[i].platform.radius + offices[j].platform.radius + 1.75) continue
      assert.ok(organicFootprintGap(outlines[i], outlines[j]) >= 0.1, `${count} offices: overlap ${i},${j}`)
    }
  }
})

test('mesh, gold border, hit volume and walking portals share the exact organic outline', () => {
  const { executive, offices } = layoutDepartmentOffices([department(0, 3)])
  for (const office of [executive, ...offices]) {
    const footprint = office.platform, mesh = createOrganicOfficePlatform(footprint)
    assert.ok(mesh.foundation.positions.every(Number.isFinite)); assert.ok(mesh.rim.positions.every(Number.isFinite))
    assert.equal(mesh.foundation.normals.length, mesh.foundation.positions.length)
    assert.equal(mesh.rim.normals.length, mesh.rim.positions.length)
    const c = footprint.center
    assert.equal(organicPrismIntersection(footprint, [c.x, 10, c.z], [0, -1, 0], 0, 2), 8)
    assert.equal(organicPrismIntersection(footprint, [footprint.radius + 1, 10, 0], [0, -1, 0], 0, 2), Infinity)
    const front = organicBoundaryAtX(footprint, 0, 'front')
    assert.ok(organicContains(footprint.outline, { x: 0, z: front + 0.18 }))
    assert.ok(!organicContains(footprint.outline, { x: 0, z: front - 0.24 }))
    assert.ok(Number.isFinite(organicBoundaryAtX(footprint, 1.62, 'rear')))
    assert.equal(mesh.rim.positions.length, 128 * 6 * 3)
  }
})
