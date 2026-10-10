import type { BsAdministrationCapabilityReference, BsAdministrationCapabilityDescriptor, BsAdministrationNavigationGroup, BsSuitIdentity } from '@building-suit/contracts'
import type { BsContextNavigationGroup, BsSuitRailItem } from './index.ts'

/** Structural view permits heterogeneous product operation maps in one registry.
 * Adapter invocation retains its product registration's input/output types. */
interface AdministrationRegistrationView {
  contractVersion: number
  identity: BsSuitIdentity
  navigation: readonly BsAdministrationNavigationGroup[]
  capabilities: Record<'read' | 'command', Readonly<Record<string, BsAdministrationCapabilityDescriptor | undefined>>>
  adapters: Record<'read' | 'command', Readonly<Record<string, { version: number; execute: unknown } | undefined>>>
}

/** Call before rendering/dispatch; recompute when access or registration changes. */
export function administrationCapabilitySupported(
  registration: AdministrationRegistrationView, reference: BsAdministrationCapabilityReference,
): boolean {
  if (registration.contractVersion !== 1 || registration.identity.disabled) return false
  const descriptors = registration.capabilities[reference.kind]
  const adapters = registration.adapters[reference.kind]
  const descriptor = Object.hasOwn(descriptors, reference.id) ? descriptors[reference.id] : undefined
  const adapter = Object.hasOwn(adapters, reference.id) ? adapters[reference.id] : undefined
  return Number.isInteger(reference.version) && reference.version > 0
    && descriptor?.enabled !== false && descriptor?.version === reference.version
    && adapter?.version === reference.version && typeof adapter.execute === 'function'
}

/** Existing BsAdministrationShell inputs; no product names or route branches. */
export function administrationShellRegistration(
  registrations: readonly AdministrationRegistrationView[], selectedSuit: string,
): { suits: BsSuitRailItem[]; groups: BsContextNavigationGroup[] } {
  const ids = new Set<string>()
  for (const registration of registrations) {
    if (!registration.identity.id || ids.has(registration.identity.id)) throw new Error('Administration Suit IDs must be unique and nonempty')
    ids.add(registration.identity.id)
  }
  const suits = registrations.map(registration => ({ ...registration.identity, disabled: registration.identity.disabled || registration.contractVersion !== 1 }))
  const selected = registrations.find(registration => registration.identity.id === selectedSuit)
  if (!selected || selected.contractVersion !== 1 || selected.identity.disabled) return { suits, groups: [] }
  const groupIds = new Set<string>(), itemIds = new Set<string>()
  const groups = selected.navigation.map(group => {
    if (!group.id || groupIds.has(group.id)) throw new Error('Administration group IDs must be unique and nonempty')
    groupIds.add(group.id)
    const items = group.items.flatMap(item => {
      if (!item.id || itemIds.has(item.id)) throw new Error('Administration context IDs must be unique and nonempty')
      itemIds.add(item.id)
      const supported = (item.requires ?? []).every(reference => administrationCapabilitySupported(selected, reference))
      if (!supported && item.unsupported !== 'disable') return []
      return [{ id: item.id, label: item.label, icon: item.icon, to: item.to, disabled: item.disabled || !supported }]
    })
    return { id: group.id, label: group.label, items }
  }).filter(group => group.items.length)
  return { suits, groups }
}
