export type ClientHealthStatus = 'healthy' | 'needs_attention' | 'unavailable'
export type PortfolioFilter = 'all' | ClientHealthStatus
export type PeriodHealth = 'open' | 'soft_closed' | 'hard_closed' | 'missing'
export type ReconciliationHealth = 'reconciled' | 'needs_attention'

export type HealthSignal<T> =
  | { state: 'available', value: T }
  | { state: 'unavailable' }

export interface ClientHealthOrganization {
  id: string
  name: string
  legalName: string | null
  baseCurrency: string
  timezone: string
  role: string
  roleId: string | null
}

export interface ClientHealthSignals {
  period: HealthSignal<PeriodHealth>
  reconciliation: HealthSignal<ReconciliationHealth>
  lastActivity: HealthSignal<string | null>
}

export interface ClientHealthRow extends ClientHealthOrganization, ClientHealthSignals {
  health: ClientHealthStatus
}

export interface ClientHealthReader {
  (organization: ClientHealthOrganization): Promise<ClientHealthSignals>
}

export function unavailableSignal<T>(): HealthSignal<T> {
  return { state: 'unavailable' }
}

export function availableSignal<T>(value: T): HealthSignal<T> {
  return { state: 'available', value }
}

/**
 * The overall label is deliberately conservative. It summarizes only module
 * states that were actually readable; unavailable providers never become a
 * fabricated zero or a false success.
 */
export function deriveClientHealth(signals: ClientHealthSignals): ClientHealthStatus {
  if (signals.period.state === 'available' && signals.period.value === 'missing') return 'needs_attention'
  if (signals.reconciliation.state === 'available' && signals.reconciliation.value === 'needs_attention') return 'needs_attention'
  if (signals.period.state === 'available' && signals.reconciliation.state === 'available') return 'healthy'
  return 'unavailable'
}

export function portfolioScopeKey(userId: string | null | undefined, organizationIds: string[]): string {
  return `${userId ?? 'anonymous'}:${[...organizationIds].sort().join(',')}`
}

/**
 * Results stay paired with the organization that produced them. The caller's
 * scope check prevents an older identity/membership request from publishing
 * after a newer request has replaced it.
 */
export async function loadClientHealthRows(
  organizations: ClientHealthOrganization[],
  read: ClientHealthReader,
  scopeIsCurrent: () => boolean = () => true,
): Promise<ClientHealthRow[] | null> {
  const rows = await Promise.all(organizations.map(async organization => {
    const signals = await read(organization)
    return { ...organization, ...signals, health: deriveClientHealth(signals) }
  }))

  return scopeIsCurrent() ? rows : null
}

export function filterClientHealthRows(
  rows: ClientHealthRow[],
  query: string,
  filter: PortfolioFilter,
  locale = 'en',
): ClientHealthRow[] {
  const normalizedQuery = query.trim().toLocaleLowerCase(locale)
  return rows.filter((row) => {
    if (filter !== 'all' && row.health !== filter) return false
    if (!normalizedQuery) return true
    return [row.name, row.legalName, row.baseCurrency, row.role]
      .filter((value): value is string => Boolean(value))
      .some(value => value.toLocaleLowerCase(locale).includes(normalizedQuery))
  })
}

export function todayInTimezone(timezone: string, now = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now)
  const value = Object.fromEntries(parts.map(part => [part.type, part.value]))
  return `${value.year}-${value.month}-${value.day}`
}
