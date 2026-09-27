<script setup lang="ts">
import type { Database } from '~~/types/database.types'
import { buildSetupChecklist } from '~/utils/setupExperience'

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
</script>

<template>
  <details class="ls-card group p-5" data-setup-checklist>
    <summary class="flex cursor-pointer list-none items-center justify-between gap-3">
      <div>
        <p class="font-bold">{{ t('setupChecklist.title') }}</p>
        <p class="mt-1 text-sm text-fg-muted">{{ t('setupChecklist.progress', { complete: completed, total: data?.length ?? 5 }) }}</p>
      </div>
      <span class="ls-badge bg-[var(--bs-surface-muted)] text-fg-muted">{{ t('setupChecklist.optional') }}</span>
    </summary>

    <div class="mt-4 border-t border-line pt-4">
      <p class="text-sm text-fg-muted">{{ t('setupChecklist.hint') }}</p>
      <SectionSkeleton v-if="pending" class="mt-4" variant="table" :rows="3" />
      <div v-else-if="error" class="ls-error mt-4" role="alert">
        <p>{{ t('setupChecklist.loadFailed') }}</p>
        <button type="button" class="ls-btn ls-btn-sm mt-2" @click="refresh()">{{ t('common.retry') }}</button>
      </div>
      <ol v-else class="mt-4 grid gap-3 md:grid-cols-2">
        <li v-for="item in data" :key="item.key" class="rounded-control border border-line p-4">
          <div class="flex items-start justify-between gap-3">
            <div>
              <p class="font-semibold">{{ t(`setupChecklist.items.${item.key}.title`) }}</p>
              <p class="mt-1 text-sm text-fg-muted">{{ t(`setupChecklist.items.${item.key}.${item.state}`, { count: item.count ?? 0, mapped: item.mappedCount ?? 0 }) }}</p>
            </div>
            <span class="ls-badge" :class="item.state === 'complete' ? 'bg-[var(--bs-status-success-bg)] text-success' : 'bg-[var(--bs-surface-muted)] text-fg-muted'">
              {{ t(`setupChecklist.states.${item.state}`) }}
            </span>
          </div>
          <NuxtLink v-if="item.key !== 'organization'" :to="item.route" class="mt-3 inline-block text-sm font-semibold text-link hover:underline">
            {{ t(`setupChecklist.items.${item.key}.action`) }}
          </NuxtLink>
        </li>
      </ol>
    </div>
  </details>
</template>
