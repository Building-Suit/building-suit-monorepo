import type { Database } from '~~/types/database.types'
import type { ClientHealthOrganization, ClientHealthRow, ClientHealthSignals, PeriodHealth, ReconciliationHealth } from '~/utils/clientHealth'
import { availableSignal, loadClientHealthRows, portfolioScopeKey, todayInTimezone, unavailableSignal } from '~/utils/clientHealth'

type ReconciliationRow = Database['public']['Functions']['reconcile_control_accounts']['Returns'][number]

export function useClientPortfolio() {
  const supabase = useSupabaseClient<Database>()
  const user = useSupabaseUser()
  const { organizations } = useTenant()
  const rows = ref<ClientHealthRow[]>([])
  const pending = ref(false)
  const error = ref<unknown>(null)
  let requestVersion = 0

  const scope = computed(() => portfolioScopeKey(user.value?.id, organizations.value.map(organization => organization.id)))

  function portfolioOrganizations(): ClientHealthOrganization[] {
    return organizations.value.map(organization => ({
      id: organization.id,
      name: organization.name,
      legalName: organization.legal_name,
      baseCurrency: organization.base_currency,
      timezone: organization.timezone,
      role: organization.role,
      roleId: organization.role_id,
    }))
  }

  async function readSignals(organization: ClientHealthOrganization): Promise<ClientHealthSignals> {
    const capabilityResult = await supabase.rpc('my_capabilities', { p_organization_id: organization.id })
    if (capabilityResult.error) {
      return {
        period: unavailableSignal(),
        reconciliation: unavailableSignal(),
        lastActivity: unavailableSignal(),
      }
    }

    const capabilities = new Set((capabilityResult.data as string[] | null) ?? [])
    const today = todayInTimezone(organization.timezone)
    const [periodResult, reconciliationResult, activityResult] = await Promise.allSettled([
      capabilities.has('periods.read')
        ? supabase.from('accounting_periods').select('status').eq('organization_id', organization.id).lte('start_date', today).gte('end_date', today).limit(1).maybeSingle()
        : Promise.resolve(null),
      capabilities.has('controls.reconcile')
        ? supabase.rpc('reconcile_control_accounts', { p_organization_id: organization.id, p_as_of_date: today })
        : Promise.resolve(null),
      capabilities.has('transactions.read')
        ? supabase.rpc('search_transactions', { p_organization_id: organization.id, p_limit: 1, p_sort: 'transaction_date', p_direction: 'desc' })
        : Promise.resolve(null),
    ])

    let period = unavailableSignal<PeriodHealth>()
    if (periodResult.status === 'fulfilled' && periodResult.value && !periodResult.value.error) {
      period = availableSignal((periodResult.value.data?.status ?? 'missing') as PeriodHealth)
    }

    let reconciliation = unavailableSignal<ReconciliationHealth>()
    if (reconciliationResult.status === 'fulfilled' && reconciliationResult.value && !reconciliationResult.value.error) {
      const reconciliationRows = (reconciliationResult.value.data ?? []) as ReconciliationRow[]
      const providersAvailable = reconciliationRows.length > 0 && reconciliationRows.every(row => row.status !== 'provider_unavailable')
      if (providersAvailable) {
        reconciliation = availableSignal(
          reconciliationRows.every(row => row.status === 'reconciled') ? 'reconciled' : 'needs_attention',
        )
      }
    }

    let lastActivity = unavailableSignal<string | null>()
    if (activityResult.status === 'fulfilled' && activityResult.value && !activityResult.value.error) {
      lastActivity = availableSignal(activityResult.value.data?.[0]?.transaction_date ?? null)
    }

    return { period, reconciliation, lastActivity }
  }

  async function load() {
    const version = ++requestVersion
    const requestedScope = scope.value
    pending.value = true
    error.value = null
    try {
      const loaded = await loadClientHealthRows(
        portfolioOrganizations(),
        readSignals,
        () => version === requestVersion && requestedScope === scope.value,
      )
      if (loaded) rows.value = loaded
    }
    catch (failure) {
      if (version === requestVersion) error.value = failure
    }
    finally {
      if (version === requestVersion) pending.value = false
    }
  }

  watch(scope, () => { void load() })

  return { rows, pending, error, scope, load }
}
