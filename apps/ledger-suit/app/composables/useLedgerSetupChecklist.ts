import type { Database } from '~~/types/database.types'
import { buildSetupChecklist } from '~/utils/setupExperience'

export function useLedgerSetupChecklist() {


  const supabase = useSupabaseClient<Database>()
  const { current, currentId, can } = useTenant()
  const { t } = useI18n()

  const key = computed(() => `org:setup-checklist:${currentId.value ?? ''}`)
  const { data, pending, error, refresh } = useLazyAsyncData(key, async () => {
    const organizationId = currentId.value
    const organization = current.value
    if (!organizationId || !organization) return null
    const organizationConfigured = Boolean(organization.legal_name && organization.base_currency)

    const accountReadable = can('accounts.read')
    const periodReadable = can('periods.read')
    const openingReadable = can('opening_balances.read')
    const memberReadable = can('members.read')

    const [accounts, mappings, periods, openings, members, invitations] = await Promise.all([
      accountReadable
        ? supabase.from('accounts').select('id,type,account_role,is_archived').eq('organization_id', organizationId)
        : Promise.resolve({ data: null, error: null }),
      accountReadable
        ? supabase.from('account_financial_mappings').select('account_id,dimension').eq('organization_id', organizationId)
        : Promise.resolve({ data: null, error: null }),
      periodReadable
        ? supabase.from('accounting_periods').select('id', { count: 'exact', head: true }).eq('organization_id', organizationId)
        : Promise.resolve({ count: null, error: null }),
      openingReadable
        ? supabase.from('opening_balance_batches').select('id', { count: 'exact', head: true }).eq('organization_id', organizationId).eq('status', 'posted')
        : Promise.resolve({ count: null, error: null }),
      memberReadable
        ? supabase.from('organization_members').select('id', { count: 'exact', head: true }).eq('organization_id', organizationId).eq('status', 'active')
        : Promise.resolve({ count: null, error: null }),
      memberReadable
        ? supabase.from('organization_invitations').select('id', { count: 'exact', head: true }).eq('organization_id', organizationId).eq('status', 'pending')
        : Promise.resolve({ count: null, error: null }),
    ])

    for (const result of [accounts, mappings, periods, openings, members, invitations]) {
      if (result.error) throw result.error
    }
    if (currentId.value !== organizationId) return null

    const activeAccounts = accounts.data?.filter(account => !account.is_archived) ?? null
    const eligibleAccounts = activeAccounts?.filter(account => account.account_role !== 'group') ?? null
    const eligibleIds = eligibleAccounts ? new Set(eligibleAccounts.map(account => account.id)) : null
    const mappedAccounts = mappings.data && eligibleIds
      ? new Set(mappings.data.map(mapping => mapping.account_id).filter(accountId => eligibleIds.has(accountId)))
      : null

    return buildSetupChecklist({
      organizationConfigured,
      accountCount: activeAccounts?.length ?? null,
      eligibleMappingAccountCount: eligibleAccounts?.length ?? null,
      mappedAccountCount: mappedAccounts?.size ?? null,
      periodCount: periods.count,
      acceptedOpeningCount: openings.count,
      memberCount: members.count,
      pendingInvitationCount: invitations.count,
    })
  }, { watch: [currentId], default: () => null })

  const completed = computed(() => data.value?.filter(item => item.state === 'complete').length ?? 0)
  const steps = computed(() => (data.value ?? []).map(item => ({
    id: item.key,
    title: t(`setupChecklist.items.${item.key}.title`),
    description: t(`setupChecklist.items.${item.key}.${item.state}`, { count: item.count ?? 0, mapped: item.mappedCount ?? 0 }),
    status: t(`setupChecklist.states.${item.state}`),
    tone: item.state === 'complete' ? 'success' as const : 'neutral' as const,
    ...(item.key === 'organization' ? {} : { action: { to: item.route, label: t(`setupChecklist.items.${item.key}.action`) } }),
  })))
  return reactive({ steps, pending, error, refresh, progress: computed(() => t('setupChecklist.progress', { complete: completed.value, total: data.value?.length ?? 5 })) })
}
