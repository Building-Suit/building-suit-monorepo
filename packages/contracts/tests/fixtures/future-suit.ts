import { administrationShellRegistration } from '../../../ux/src/administration.ts'
import type { BsSuitAdministrationRegistration } from '../../src/index.ts'

type Reads = { overview: { version: 1; input: { limit: number }; output: { total: number } } }
type Commands = { archive: { version: 2; input: { id: string }; output: { archived: boolean } } }

/** Synthetic future Suit: replace adapters with product-owned authorized APIs. */
export const futureSuit: BsSuitAdministrationRegistration<Reads, Commands> = {
  contractVersion: 1,
  identity: { id: 'future-suit', label: 'Future Suit', icon: 'layers' },
  navigation: [{ id: 'operations', label: 'Operations', items: [
    { id: 'overview', label: 'Overview', to: '/future/overview', requires: [{ kind: 'read', id: 'overview', version: 1 }] },
    { id: 'archive', label: 'Archive', requires: [{ kind: 'command', id: 'archive', version: 2 }], unsupported: 'disable' },
    { id: 'export', label: 'Export', requires: [{ kind: 'read', id: 'export', version: 1 }] },
  ] }],
  capabilities: {
    read: { overview: { version: 1, label: 'Overview' } },
    command: { archive: { version: 2, label: 'Archive', enabled: false } },
  },
  adapters: {
    read: { overview: { version: 1, execute: async (input, context) => {
      context.signal.throwIfAborted()
      return { total: input.limit }
    } } },
    command: { archive: { version: 2, execute: async () => ({ archived: true }) } },
  },
}

// The same host registry accepts independently typed operation maps.
const secondSuit: BsSuitAdministrationRegistration<{ health: { version: 3; input: null; output: boolean } }, Record<never, never>> = {
  contractVersion: 1,
  identity: { id: 'second-future-suit', label: 'Second Suit', logo: '/brand/second.svg' },
  navigation: [],
  capabilities: { read: { health: { version: 3, label: 'Health' } }, command: {} },
  adapters: { read: { health: { version: 3, execute: async () => true } }, command: {} },
}
export const futureRegistry = [futureSuit, secondSuit] as const
administrationShellRegistration(futureRegistry, futureSuit.identity.id)
