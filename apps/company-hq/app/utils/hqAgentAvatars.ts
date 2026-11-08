import type { HqAgentAvatar } from '@building-suit/ui/types/hqAgentsPresentation'

// Visual presets for the HQ cast. Keep slots stable when the roster changes.
const appearances = {
  female: [
    'AG-HR-001', 'AG-SOC-002', 'AG-RES-001', 'AG-CS-002', 'AG-DEV-003',
    'AG-EMAIL-002', 'AG-HR-003', 'AG-SOC-001', 'AG-CS-001',
  ],
  male: [
    'AG-CEO-001', 'AG-HR-002', 'AG-DEV-002', 'AG-RES-002', 'AG-SALES-002',
    'AG-DEV-004', 'AG-SALES-001', 'AG-EMAIL-001', 'AG-DEV-001',
  ],
} as const

const avatars = new Map<string, HqAgentAvatar>()
for (const body of ['female', 'male'] as const) {
  for (const [hairstyle, id] of appearances[body].entries()) {
    let seed = 2166136261
    for (const letter of id) seed = Math.imul(seed ^ letter.charCodeAt(0), 16777619)
    avatars.set(id, { body, hairstyle, seed: seed >>> 0 })
  }
}

export function hqAvatarForAgent(id: string) {
  return avatars.get(id)
}
