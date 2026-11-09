import { SPATIAL_VIEWPORT_GROUND_Y } from '@building-suit/ux'
import type { DepartmentOfficeLayout } from './departmentOfficeLayout'
import type { HqIslandFootprint } from './hqIslandGeometry'
import { naturalIslandSurfaceHeight } from './naturalIslandGeometry'
import { createOfficeArchitecture, officeFurnitureFootprints } from './officeArchitecture'
import { organicContains } from './organicOfficePlatform'

const ground = SPATIAL_VIEWPORT_GROUND_Y
const playerClearance = .26

export function hqIslandGameSurface(layout: DepartmentOfficeLayout, island: HqIslandFootprint) {
  const protectedRadius = Math.max(...layout.rings.map(ring => ring.outerRadius)) + .12
  const rooms = [layout.executive, ...layout.offices].map(office => ({
    office,
    cosine: Math.cos(office.yaw),
    sine: Math.sin(office.yaw),
    furniture: officeFurnitureFootprints(createOfficeArchitecture(office.width, office.depth),
      'agents' in office ? office.agents?.length ?? 0 : 0, office.id === 'executive-workspace'),
  }))

  return (x: number, z: number) => {
    if (Math.hypot(x, z) < 2.8) return null
    const height = naturalIslandSurfaceHeight(island, protectedRadius, ground, x, z)
    if (height === null || height < ground - .26) return null
    for (const { office, cosine, sine, furniture } of rooms) {
      const dx = x - office.x, dz = z - office.z
      const local = { x: cosine * dx - sine * dz, z: sine * dx + cosine * dz }
      if (!organicContains(office.platform.outline, local)) continue
      if (furniture.some(({ min, max }) => local.x > min[0] - playerClearance && local.x < max[0] + playerClearance
        && local.z > min[2] - playerClearance && local.z < max[2] + playerClearance)) return null
      return ground + .14
    }
    return height
  }
}
