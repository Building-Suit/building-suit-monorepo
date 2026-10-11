export interface RegistryItem {
  key: string
  label: Record<string, string>
  description: Record<string, string>
  module: 'overview' | 'capabilities' | 'manual-transfer' | 'activity'
  bindingId?: string
}
export interface RegistrySuit {
  key: string
  label: Record<string, string>
  description: Record<string, string>
  asset: string | null
  items: RegistryItem[]
}
export interface Registry { suits: RegistrySuit[] }

const keyPattern = /^[a-z][a-z0-9-]{1,62}$/
function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
}
function copy(value: unknown): Record<string, string> {
  return Object.fromEntries(Object.entries(record(value)).filter((entry): entry is [string, string] => typeof entry[1] === 'string' && entry[1].trim().length > 0))
}
/** Only canonical local brand asset references may enter the browser projection. */
export function safeAsset(value: unknown): string | null {
  return typeof value === 'string' && /^\/brand\/[a-zA-Z0-9/_-]+\.(svg|png|webp)$/.test(value) ? value : null
}
export function localized(value: Record<string, string>, locale: string): string {
  return value[locale] || value.en || value.ar || Object.values(value)[0] || ''
}
/** Data selects reviewed generic modules; it never selects URLs or executable code. */
export function parseRegistry(value: unknown): Registry {
  const source = record(value)
  if (!Array.isArray(source.suits)) throw new Error('Registry unavailable')
  const seen = new Set<string>()
  const suits: RegistrySuit[] = []
  for (const raw of source.suits) {
    const suit = record(raw)
    if (suit.enabled === false || (suit.status !== undefined && suit.status !== 'active')) continue
    if (typeof suit.key !== 'string' || !keyPattern.test(suit.key) || seen.has(suit.key)) continue
    const label = copy(suit.label)
    if (!Object.keys(label).length) continue
    seen.add(suit.key)
    const items: RegistryItem[] = []
    const itemKeys = new Set<string>()
    for (const rawItem of Array.isArray(suit.items) ? suit.items : []) {
      const item = record(rawItem)
      if (item.enabled === false) continue
      if (typeof item.key !== 'string' || !keyPattern.test(item.key) || itemKeys.has(item.key)) continue
      if (item.module !== 'overview' && item.module !== 'capabilities' && item.module !== 'manual-transfer' && item.module !== 'activity') continue
      if (item.module === 'manual-transfer' && (typeof item.bindingId !== 'string' || !/^[0-9a-f-]{36}$/i.test(item.bindingId))) continue
      const itemLabel = copy(item.label)
      if (!Object.keys(itemLabel).length) continue
      itemKeys.add(item.key)
      items.push({ key: item.key, label: itemLabel, description: copy(item.description), module: item.module, ...(item.module === 'manual-transfer' ? { bindingId: item.bindingId as string } : {}) })
    }
    suits.push({ key: suit.key, label, description: copy(suit.description), asset: safeAsset(suit.asset), items })
  }
  return { suits }
}

export function selectRegistry(registry: Registry, suitKey: unknown, itemKey: unknown) {
  // An explicit inaccessible deep link remains denied, never silently changes Suit.
  const suit = suitKey === undefined ? registry.suits[0] : registry.suits.find(row => row.key === suitKey)
  const item = itemKey === undefined ? undefined : suit?.items.find(row => row.key === itemKey)
  return { suit, item, denied: (suitKey !== undefined && !suit) || (itemKey !== undefined && !item) }
}
