<script setup lang="ts">
import { useLedgerAddTransactionDialogView } from '~/composables/useLedgerAddTransactionDialogView'
import { useLedgerFinancialSystemMapView } from '~/composables/useLedgerFinancialSystemMapView'
import { useLedgerOperationsCenterView } from '~/composables/useLedgerOperationsCenterView'
import { useLedgerOrganizationSetupView } from '~/composables/useLedgerOrganizationSetupView'
import { useLedgerOrganizationSwitcherView } from '~/composables/useLedgerOrganizationSwitcherView'
import { useLedgerSyntheticDemoView } from '~/composables/useLedgerSyntheticDemoView'
import { useLedgerTeamMenuView } from '~/composables/useLedgerTeamMenuView'
import type { Database } from '~~/types/database.types'

const PRIMARY_NAV = [
  { to: '/dashboard', key: 'dashboard', icon: 'dashboard' },
  { to: '/transactions', key: 'transactions', icon: 'transactions' },
  { to: '/accounts', key: 'accounts', icon: 'wallet' },
  { to: '/reports', key: 'reports', icon: 'reports' },
] as const

const NAV_GROUPS = computed(() => [
  {
    key: 'ledger',
    links: [
      ...(can('transactions.read') || can('transactions.create') || can('transactions.adjust') || can('imports.create') ? [{ to: '/transactions', label: 'nav.transactions' }] : []),
      ...(can('accounts.read') ? [{ to: '/accounts', label: 'nav.accounts' }] : []),
      ...(can('migrations.read') ? [{ to: '/migration-center', label: 'nav.migrationCenter' }] : []),
      ...(can('opening_balances.read') ? [{ to: '/opening-balances', label: 'nav.openingBalances' }] : []),
      ...(can('periods.read') ? [{ to: '/periods', label: 'nav.periods' }] : []),
    ],
  },
  {
    key: 'subledgers',
    links: [
      ...(can('ar.read') ? [{ to: '/receivables', label: 'ar.title' }] : []),
      ...(can('ap.read') ? [{ to: '/payables', label: 'ap.title' }] : []),
      ...(can('bank.read') ? [{ to: '/bank-reconciliation', label: 'nav.bankReconciliation' }] : []),
      ...(can('assets.read') ? [{ to: '/fixed-assets', label: 'nav.fixedAssets' }] : []),
      ...(can('inventory.read') ? [{ to: '/inventory-accounting', label: 'nav.inventoryAccounting' }] : []),
      ...(can('tax.read') ? [{ to: '/tax-vat', label: 'nav.taxVat' }] : []),
    ],
  },
  {
    key: 'insights',
    links: [
      ...(organizations.value.length > 1 ? [{ to: '/clients', label: 'nav.clients' }] : []),
      ...(can('reports.read') ? [{ to: '/reports', label: 'nav.reports' }] : []),
      ...(can('dimensions.read') ? [{ to: '/accounting-dimensions', label: 'nav.accountingDimensions' }] : []),
    ],
  },
  {
    key: 'operations',
    links: [
      ...(can('commitments.read') ? [{ to: '/records/commitments', label: 'operations.tabs.commitments' }] : []),
      ...(can('recurring.read') ? [{ to: '/records/recurring', label: 'add.items.recurring' }] : []),
    ],
  },
  {
    key: 'directory',
    links: [
      ...(can('counterparties.read') ? [{ to: '/records/counterparties', label: 'operations.tabs.counterparties' }] : []),
      ...(can('tags.read') ? [{ to: '/records/tags', label: 'operations.tabs.tags' }] : []),
    ],
  },
  {
    key: 'workspace',
    links: [
      ...(can('members.read') ? [{ to: '/team', label: 'nav.teamInvitations' }] : []),
      ...(can('audit.read') ? [{ to: '/audit', label: 'nav.auditHistory' }] : []),
    ],
  },
].filter(group => group.links.length))


const { t } = useI18n()
const supabase = useSupabaseClient<Database>()
const user = useSupabaseUser()
const { current, currentId, organizations, loadOrganizations, loading } = useTenant()
const { can } = useTenant()
const {
  accessState,
  subscription,
  paymentRequired,
  readOnly,
  load: loadBilling,
} = useBilling()




await loadOrganizations()
await loadBilling()

const accessReady = computed(() => accessState.value !== 'loading' && !paymentRequired.value)
// Billing may resolve on the client before hydration finishes. Keep the server's
// initial branch until mount so Vue does not hydrate the shell into the loading
// div and retain that div's attributes instead of the shell's grid classes.
const initialShellReady = useState('ledger:initial-shell-ready', () => accessReady.value)
const hydrating = ref(useNuxtApp().isHydrating)
onMounted(() => { hydrating.value = false })
const showShell = computed(() => hydrating.value ? initialShellReady.value : accessReady.value)
const signingOut = ref(false)
const signOutError = ref('')
const userId = computed(() => user.value?.id)
const { data: profile } = useLazyAsyncData('account:profile', async () => {
  if (!userId.value) return null
  const { data, error } = await supabase.from('profiles').select('full_name').eq('id', userId.value).maybeSingle()
  if (error) throw error
  return data
}, { watch: [userId] })
const fullName = computed(() => {
  if (profile.value?.full_name) return profile.value.full_name
  const metadataName = user.value?.user_metadata.full_name ?? user.value?.user_metadata.name
  return typeof metadataName === 'string' ? metadataName : ''
})
const userMenuActions = computed(() => can('billing.read')
  ? [{ to: '/billing', label: t('billing.title'), icon: 'wallet' }]
  : [])
const { data: notifications, refresh: refreshNotifications } = useLazyAsyncData('org:notifications', async () => {
  if (!currentId.value) return []
  const { data, error } = await supabase.from('notifications').select('*').eq('organization_id', currentId.value).order('created_at', { ascending: false }).limit(20)
  if (error) throw error
  return data ?? []
}, { watch: [currentId], default: () => [] })
const notificationItems = computed(() => notifications.value.map(item => ({ id: item.id, title: item.title, body: item.body ?? undefined, read: Boolean(item.read_at) })))
async function markNotificationRead(id: string) { await supabase.rpc('mark_notification_read' as never, { p_notification_id: id } as never); await refreshNotifications() }
async function markAllNotificationsRead() { if (!currentId.value) return; await supabase.rpc('mark_all_notifications_read' as never, { p_organization_id: currentId.value } as never); await refreshNotifications() }

const now = ref(Date.now())
const checkingTrialExpiration = ref(false)
const remainingTrialMilliseconds = computed(() => accessState.value === 'trialing' && subscription.value?.trial_ends_at ? Math.max(0, new Date(subscription.value.trial_ends_at).getTime() - now.value) : null)
const trialParts = computed(() => { const totalMinutes = Math.ceil((remainingTrialMilliseconds.value ?? 0) / 60_000); return { days: Math.floor(totalMinutes / 1440), hours: Math.floor((totalMinutes % 1440) / 60), minutes: totalMinutes % 60 } })
let trialTimer: ReturnType<typeof setInterval> | undefined
onMounted(() => { now.value = Date.now(); trialTimer = setInterval(() => { now.value = Date.now() }, 30_000) })
onBeforeUnmount(() => clearInterval(trialTimer))
watch(remainingTrialMilliseconds, async (remaining) => {
  if (remaining !== 0 || checkingTrialExpiration.value) return
  checkingTrialExpiration.value = true
  try { await loadBilling({ force: true }); if (paymentRequired.value) await navigateTo('/subscribe', { replace: true }) }
  finally { checkingTrialExpiration.value = false }
})

async function signOut() {
  if (signingOut.value) return
  signingOut.value = true
  signOutError.value = ''
  try {
    const { error } = await supabase.auth.signOut()
    if (error) throw error
    await navigateTo('/login')
  }
  catch {
    signOutError.value = t('errors.generic')
  }
  finally {
    signingOut.value = false
  }
}


watch(currentId, async (value, previous) => {
  if (value !== previous) await loadBilling()
})

</script>

<template>
  <BsStateSurface v-if="!showShell" state="loading" :title="t('app.loading')" />
  <BsAppShell
    v-else
    :product-name="t('app.name')"
    :groups="NAV_GROUPS.map(group => ({ ...group, label: t(`nav.groups.${group.key}`), links: group.links.map(item => ({ ...item, label: t(item.label) })) }))"
    :mobile-links="PRIMARY_NAV.map(item => ({ ...item, label: t(`nav.${item.key}`) }))"
    :labels="{ close: t('nav.close'), open: t('nav.open'), navigation: t('nav.primary'), dashboard: t('nav.dashboard') }"
  >
    <template #logo>
      <BsProductLogo name="Ledger Suit" asset-prefix="/brand/ledger-suit" size="navigation" />
    </template>
    <template #context>
      <BsWorkflowScope :factory="useLedgerOrganizationSwitcherView" :input="{  }">
        <template #default="{ state: ledgerView25 }">
          <BsContextSwitcher
            :model-value="ledgerView25.current?.id ?? null"
            :label="ledgerView25.t('org.switcher')"
            :placeholder="ledgerView25.t('org.none')"
            :options="ledgerView25.contextOptions"
            :create-label="!ledgerView25.ownsOrganization ? ledgerView25.t('org.createAnother') : undefined"
            @update:model-value="value => { if (value) ledgerView25.choose(value) }"
            @create="ledgerView25.showCreate"
          />
          <BsRecordActionDialog
            v-if="ledgerView25.createOpen"
            :visible="true"
            :title="ledgerView25.t('org.createAnother')"
            size="md"
            :dirty="ledgerView25.overlayDirty0"
            :pending="ledgerView25.pending"
            :error="ledgerView25.errorMessage"
            @update:visible="(value: boolean) => { if (!value) ledgerView25.closeCreate() }"
            @submit="ledgerView25.createAndStartTrial"
          >
            <BsText tone="link" emphasis="semibold">{{ ledgerView25.t('org.additionalEyebrow') }}</BsText>
            <BsText tone="muted">{{ ledgerView25.t('org.additionalBillingHint') }}</BsText>
            <BsField :label="ledgerView25.t('org.name')" required>
              <template #default="field">
                <BsInput :id="field.id" v-model="ledgerView25.name" required />
              </template>
            </BsField>
            <BsField :label="ledgerView25.t('onboarding.legalName')" required>
              <template #default="field">
                <BsInput :id="field.id" v-model="ledgerView25.legalName" required />
              </template>
            </BsField>
            <BsField :label="ledgerView25.t('accounts.currency')">
              <BsSelect v-model="ledgerView25.currency" :label="ledgerView25.t('accounts.currency')" :options="['EGP', 'USD', 'EUR', 'GBP', 'SAR', 'AED']" />
            </BsField>
            <BsAlert tone="info" :title="ledgerView25.t('org.separateSubscriptionTitle')" :description="ledgerView25.t('org.separateSubscriptionBody')" />
            <template #actions="{ close }">
              <BsButton type="button" :disabled="ledgerView25.pending" @click="close">{{ ledgerView25.t('common.cancel') }}</BsButton>
              <BsButton type="submit" variant="accent" :pending="ledgerView25.pending">{{ ledgerView25.t('org.createAndStartTrial') }}</BsButton>
            </template>
          </BsRecordActionDialog>
        </template>
      </BsWorkflowScope>
    </template>
    <template #header>
      <BsTrialCountdown
        v-if="remainingTrialMilliseconds !== null"
        to="/billing"
        :label="t('billing.trialCountdown', trialParts)"
        :compact-label="t('billing.trialCountdownCompact', trialParts)"
      />
      <BsNotificationMenu
        :items="notificationItems"
        :label="t('notifications.title')"
        :empty-label="t('notifications.empty')"
        :mark-all-label="t('notifications.markAll')"
        @select="markNotificationRead"
        @mark-all="markAllNotificationsRead"
      />
      <BsUserMenu
        :name="fullName"
        :email="user?.email"
        :actions="userMenuActions"
        :account-label="t('common.accountMenu')"
        :sign-out-label="t('common.signOut')"
        :sign-out-pending="signingOut"
        :error="signOutError"
        @sign-out="signOut"
      />
    </template>
    <BsStateSurface v-if="loading" state="loading" :title="t('app.loading')" />
    <BsWorkflowScope v-else-if="!current" :factory="useLedgerOrganizationSetupView" :input="{  }">
      <template #default="{ state: ledgerView26 }">
        <BsGrid :columns="2" gap="lg">
          <BsForm @submit.prevent="ledgerView26.createOrganization">
            <BsHeading :level="2" size="h3">{{ ledgerView26.t('org.create') }}</BsHeading>
            <BsText size="sm" tone="muted">{{ ledgerView26.t('org.createHint') }}</BsText>
            <BsFloatingField :label="ledgerView26.t('org.name')">
              <BsInput id="org-name" v-model="ledgerView26.name" required />
            </BsFloatingField>
            <BsFloatingField :label="ledgerView26.t('onboarding.legalName')">
              <BsInput id="org-legal-name" v-model="ledgerView26.legalName" required />
            </BsFloatingField>
            <BsFloatingField :label="ledgerView26.t('accounts.currency')">
              <BsSelect id="org-currency" v-model="ledgerView26.currency" native>
                <BsSelectOption v-for="code in ['EGP','USD','EUR','GBP','SAR','AED']" :key="code">{{ code }}</BsSelectOption>
              </BsSelect>
            </BsFloatingField>
            <BsButton type="submit" :disabled="ledgerView26.pending" variant="primary" block>{{ ledgerView26.t('org.create') }}</BsButton>
          </BsForm>
          <BsForm @submit.prevent="ledgerView26.acceptInvitation">
            <BsHeading :level="2" size="h3">{{ ledgerView26.t('org.acceptInvite') }}</BsHeading>
            <BsText size="sm" tone="muted">{{ ledgerView26.t('org.acceptInviteHint') }}</BsText>
            <BsFloatingField :label="ledgerView26.t('org.inviteToken')">
              <BsInput id="invite-token" v-model="ledgerView26.invitationToken" dir="ltr" required />
            </BsFloatingField>
            <BsButton type="submit" :disabled="ledgerView26.pending" block>{{ ledgerView26.t('org.acceptInvite') }}</BsButton>
          </BsForm>
          <BsText v-if="ledgerView26.errorMessage" role="alert" tone="danger">{{ ledgerView26.errorMessage }}</BsText>
          <BsCard v-if="!ledgerView26.showDemo" aria-labelledby="demo-invitation-title" as="section" padding="lg" :span="2">
            <BsStack gap="md">
              <BsHeading id="demo-invitation-title" :level="2" size="h3">{{ ledgerView26.t('demo.invitationTitle') }}</BsHeading>
              <BsText size="sm" tone="muted">{{ ledgerView26.t('demo.invitationHint') }}</BsText>
              <BsButton type="button" @click="ledgerView26.showDemo = true">{{ ledgerView26.t('demo.open') }}</BsButton>
            </BsStack>
          </BsCard>
          <BsWorkflowScope v-else :factory="useLedgerSyntheticDemoView" :input="{  }" @close="ledgerView26.showDemo = false">
            <template #default="{ state: ledgerView27 }">
              <BsCard aria-labelledby="synthetic-demo-title" data-synthetic-demo data-demo-scope="isolated_synthetic_demo" as="section" padding="lg" :span="2">
                <BsStack gap="md">
                  <BsInline gap="md" :wrap="true" align="start" justify="between">
                    <BsBox>
                      <BsHeading id="synthetic-demo-title" :level="2" size="h3">{{ ledgerView27.t('demo.title') }}</BsHeading>
                      <BsText size="sm" tone="muted">{{ ledgerView27.t('demo.isolation') }}</BsText>
                    </BsBox>
                    <BsButton type="button" size="sm" @click="ledgerView27.emit('close')">{{ ledgerView27.t('common.close') }}</BsButton>
                  </BsInline>
                  <BsBox role="status" padding="lg" surface="muted" radius="control">
                    <BsText as="strong">{{ ledgerView27.t('demo.syntheticBadge') }}</BsText>
                    <BsText>{{ ledgerView27.t('demo.noRealOrganization') }}</BsText>
                  </BsBox>
                  <BsDataTable
                    :value="ledgerView27.state.accounts"
                    row-key="code"
                    :label="ledgerView27.t('demo.title')"
                    :columns="[{ key: 'code', field: 'code', header: ledgerView27.t('accounts.code') }, { key: 'column2', header: ledgerView27.t('accounts.account') }, { key: 'column3', header: ledgerView27.t('opening.debit'), align: 'end' as const }, { key: 'column4', header: ledgerView27.t('opening.credit'), align: 'end' as const }]"
                  >
                    <template #cell-code="{ row: account }">
                      <BsText dir="ltr" as="span" size="xs">{{ account.code }}</BsText>
                    </template>
                    <template #cell-column2="{ row: account }">{{ ledgerView27.t(`chartTemplates.accounts.${account.nameKey}`) }}</template>
                    <template #cell-column3="{ row: account }">{{ ledgerView27.amount(account.debitMinor) }}</template>
                    <template #cell-column4="{ row: account }">{{ ledgerView27.amount(account.creditMinor) }}</template>
                  </BsDataTable>
                  <BsInline gap="sm" :wrap="true">
                    <BsButton type="button" variant="primary" @click="ledgerView27.addReceipt">{{ ledgerView27.t('demo.addReceipt') }}</BsButton>
                    <BsButton type="button" @click="ledgerView27.reset">{{ ledgerView27.t('demo.reset') }}</BsButton>
                  </BsInline>
                  <BsText size="xs" tone="muted">{{ ledgerView27.t('demo.revision', { revision: ledgerView27.state.revision }) }}</BsText>
                </BsStack>
              </BsCard>
            </template>
          </BsWorkflowScope>
        </BsGrid>
      </template>
    </BsWorkflowScope>
    <template v-else>
      <BsReadOnlyBanner
        v-if="readOnly"
        :title="t('billing.readOnlyTitle')"
        :description="t('billing.readOnlyBody')"
        :action-label="can('billing.manage') ? t('billing.fixBilling') : undefined"
        action-to="/billing"
      />
      <BsPageBody>
        <BsSlot :render="$slots.default" />
      </BsPageBody>
    </template>
    <template #overlays>
      <BsWorkflowScope v-if="current" :factory="useLedgerFinancialSystemMapView" :input="{  }">
        <template #default="{ state: ledgerView28 }">
          <BsButton
            type="button"
            data-testid="financial-help"
            placement="floating"
            :aria-expanded="ledgerView28.open"
            :aria-label="ledgerView28.t('financialMap.open')"
            @click="ledgerView28.show"
          >
            <BsInline aria-hidden="true" as="span" gap="none" :wrap="false">
              <BsIcon name="chart" :size="22" />
            </BsInline>
            <BsText as="span">{{ ledgerView28.t('financialMap.button') }}</BsText>
          </BsButton>
          <BsDialog
            :visible="ledgerView28.open"
            :title="ledgerView28.t('financialMap.title')"
            :aria-label="ledgerView28.t('financialMap.title')"
            :show-header="false"
            size="lg"
            @update:visible="value => { if (!value) ledgerView28.close() }"
          >
            <template #default="{ close: dismiss }">
              <BsStack as="section" gap="none" overflow="hidden">
                <BsInline as="header" gap="md" :wrap="false" align="start" surface="default">
                  <BsBox grow>
                    <BsText size="xs" emphasis="bold">{{ ledgerView28.t('financialMap.eyebrow') }}</BsText>
                    <BsHeading id="financial-map-title" :level="2" size="h3">{{ ledgerView28.t('financialMap.title') }}</BsHeading>
                    <BsText size="sm" tone="muted">{{ ledgerView28.t('financialMap.subtitle') }}</BsText>
                  </BsBox>
                  <BsButton type="button" :aria-label="ledgerView28.t('common.close')" size="sm" @click="dismiss">
                    <BsIcon name="close" />
                  </BsButton>
                </BsInline>
                <BsBox grow>
                  <BsFlowBlock part="diagram">
                    <BsBox aria-labelledby="financial-map-setup" as="section">
                      <BsFlowBlock part="stage-heading" state="start">
                        <BsFlowBlock part="step" as="span">{{ ledgerView28.t('financialMap.steps.setup') }}</BsFlowBlock>
                        <BsHeading id="financial-map-setup" :level="3" size="body">{{ ledgerView28.t('financialMap.setup.title') }}</BsHeading>
                        <BsText>{{ ledgerView28.t('financialMap.setup.body') }}</BsText>
                      </BsFlowBlock>
                      <BsFlowBlock part="branches" :columns="3" numbered>
                        <BsFlowBlock part="node" state="start">
                          <BsFlowBlock part="node-number" as="span">1.1</BsFlowBlock>
                          <BsHeading :level="3" size="body">{{ ledgerView28.t('financialMap.setup.organization') }}</BsHeading>
                          <BsText>{{ ledgerView28.t('financialMap.setup.organizationHint') }}</BsText>
                        </BsFlowBlock>
                        <BsFlowBlock part="node" state="start">
                          <BsFlowBlock part="node-number" as="span">1.2</BsFlowBlock>
                          <BsHeading :level="3" size="body">{{ ledgerView28.t('financialMap.setup.accounts') }}</BsHeading>
                          <BsText>{{ ledgerView28.t('financialMap.setup.accountsHint') }}</BsText>
                          <BsLink to="/accounts" variant="flow" @click="dismiss">{{ ledgerView28.t('financialMap.setup.reviewAccounts') }} <BsIcon name="arrowRight" :size="15" directional /></BsLink>
                        </BsFlowBlock>
                        <BsFlowBlock part="node" state="start">
                          <BsFlowBlock part="node-number" as="span">1.3</BsFlowBlock>
                          <BsHeading :level="3" size="body">{{ ledgerView28.t('financialMap.setup.categories') }}</BsHeading>
                          <BsText>{{ ledgerView28.t('financialMap.setup.categoriesHint') }}</BsText>
                          <BsLink to="/records/expense" variant="flow" @click="dismiss">{{ ledgerView28.t('financialMap.setup.firstEntry') }} <BsIcon name="arrowRight" :size="15" directional /></BsLink>
                        </BsFlowBlock>
                      </BsFlowBlock>
                    </BsBox>
                    <BsFlowBlock aria-hidden="true" part="arrow">
                      <BsText as="span">↓</BsText>
                    </BsFlowBlock>
                    <BsBox aria-labelledby="financial-map-inputs" as="section">
                      <BsFlowBlock part="stage-heading">
                        <BsFlowBlock part="step" as="span">{{ ledgerView28.t('financialMap.steps.record') }}</BsFlowBlock>
                        <BsHeading id="financial-map-inputs" :level="3" size="body">{{ ledgerView28.t('financialMap.sourcesTitle') }}</BsHeading>
                        <BsText>{{ ledgerView28.t('financialMap.sourcesHint') }}</BsText>
                      </BsFlowBlock>
                      <BsFlowBlock part="branches" :columns="3" numbered>
                        <BsFlowBlock part="node" as="article">
                          <BsFlowBlock part="node-number" as="span">2.1</BsFlowBlock>
                          <BsFlowBlock part="node-icon">
                            <BsIcon name="transactions" />
                          </BsFlowBlock>
                          <BsHeading :level="3" size="body">{{ ledgerView28.t('financialMap.manual.title') }}</BsHeading>
                          <BsText>{{ ledgerView28.t('financialMap.manual.body') }}</BsText>
                          <BsLink to="/transactions" variant="flow" @click="dismiss">{{ ledgerView28.t('financialMap.manual.link') }} <BsIcon name="arrowRight" :size="15" directional /></BsLink>
                        </BsFlowBlock>
                        <BsFlowBlock part="node" as="article" state="waiting">
                          <BsFlowBlock part="node-number" as="span">2.2</BsFlowBlock>
                          <BsFlowBlock part="node-icon">
                            <BsIcon name="invoice" />
                          </BsFlowBlock>
                          <BsHeading :level="3" size="body">{{ ledgerView28.t('financialMap.commitments.title') }}</BsHeading>
                          <BsText>{{ ledgerView28.t('financialMap.commitments.body') }}</BsText>
                          <BsFlowBlock part="callout">{{ ledgerView28.t('financialMap.commitments.rule') }}</BsFlowBlock>
                          <BsLink to="/records/commitments" variant="flow" @click="dismiss">{{ ledgerView28.t('financialMap.commitments.link') }} <BsIcon name="arrowRight" :size="15" directional /></BsLink>
                        </BsFlowBlock>
                        <BsFlowBlock part="node" as="article" state="waiting">
                          <BsFlowBlock part="node-number" as="span">2.3</BsFlowBlock>
                          <BsFlowBlock part="node-icon">
                            <BsIcon name="repeat" />
                          </BsFlowBlock>
                          <BsHeading :level="3" size="body">{{ ledgerView28.t('financialMap.recurring.title') }}</BsHeading>
                          <BsText>{{ ledgerView28.t('financialMap.recurring.body') }}</BsText>
                          <BsFlowBlock part="callout">{{ ledgerView28.t('financialMap.recurring.rule') }}</BsFlowBlock>
                          <BsLink to="/records/recurring" variant="flow" @click="dismiss">{{ ledgerView28.t('financialMap.recurring.link') }} <BsIcon name="arrowRight" :size="15" directional /></BsLink>
                        </BsFlowBlock>
                      </BsFlowBlock>
                      <BsFlowBlock part="subbranch">
                        <BsFlowBlock part="subbranch-label" as="p">{{ ledgerView28.t('financialMap.manual.flowsTitle') }}</BsFlowBlock>
                        <BsFlowBlock part="flow-branches">
                          <BsFlowBlock v-for="(flow, index) in ledgerView28.manualFlows" :key="flow" part="pill"><BsText as="span">2.1.{{ index + 1 }}</BsText>
                      {{ ledgerView28.t(`financialMap.manual.flows.${flow}`) }}</BsFlowBlock>
                        </BsFlowBlock>
                      </BsFlowBlock>
                    </BsBox>
                    <BsFlowBlock aria-hidden="true" part="merge">
                      <BsText as="span">{{ ledgerView28.t('financialMap.converges') }}</BsText>
                    </BsFlowBlock>
                    <BsBox aria-labelledby="financial-map-engine" as="section">
                      <BsFlowBlock part="stage-heading">
                        <BsFlowBlock part="step" as="span">{{ ledgerView28.t('financialMap.steps.validate') }}</BsFlowBlock>
                        <BsHeading id="financial-map-engine" :level="3" size="body">{{ ledgerView28.t('financialMap.engine.title') }}</BsHeading>
                        <BsText>{{ ledgerView28.t('financialMap.engine.body') }}</BsText>
                      </BsFlowBlock>
                      <BsFlowBlock part="check-path">
                        <BsFlowBlock v-for="(check, index) in ledgerView28.postingChecks" :key="check" part="node">
                          <BsFlowBlock part="check-number" as="span">3.{{ index + 1 }}</BsFlowBlock>
                          <BsText as="span">{{ ledgerView28.t(`financialMap.engine.checks.${check}`) }}</BsText>
                        </BsFlowBlock>
                      </BsFlowBlock>
                      <BsFlowBlock part="engine-result">
                        <BsIcon name="checkBadge" :size="22" />
                        <BsText as="span">{{ ledgerView28.t('financialMap.engine.result') }}</BsText>
                      </BsFlowBlock>
                    </BsBox>
                    <BsFlowBlock aria-hidden="true" part="arrow">
                      <BsText as="span">↓</BsText>
                    </BsFlowBlock>
                    <BsBox aria-labelledby="financial-map-ledger" as="section">
                      <BsFlowBlock part="stage-heading">
                        <BsFlowBlock part="step" as="span">{{ ledgerView28.t('financialMap.steps.ledger') }}</BsFlowBlock>
                        <BsHeading id="financial-map-ledger" :level="3" size="body">{{ ledgerView28.t('financialMap.ledger.rule') }}</BsHeading>
                      </BsFlowBlock>
                      <BsFlowBlock part="branches" :columns="2" numbered>
                        <BsFlowBlock part="node" as="article" state="ledger">
                          <BsFlowBlock part="node-number" as="span">4.1</BsFlowBlock>
                          <BsText size="xs" emphasis="bold">{{ ledgerView28.t('financialMap.ledger.eventLabel') }}</BsText>
                          <BsHeading :level="3" size="body">{{ ledgerView28.t('financialMap.ledger.event') }}</BsHeading>
                          <BsText>{{ ledgerView28.t('financialMap.ledger.eventHint') }}</BsText>
                        </BsFlowBlock>
                        <BsFlowBlock part="node" as="article" state="ledger">
                          <BsFlowBlock part="node-number" as="span">4.2</BsFlowBlock>
                          <BsText size="xs" emphasis="bold">{{ ledgerView28.t('financialMap.ledger.linesLabel') }}</BsText>
                          <BsHeading :level="3" size="body">{{ ledgerView28.t('financialMap.ledger.lines') }}</BsHeading>
                          <BsText>{{ ledgerView28.t('financialMap.ledger.linesHint') }}</BsText>
                        </BsFlowBlock>
                      </BsFlowBlock>
                    </BsBox>
                    <BsFlowBlock aria-hidden="true" part="split">
                      <BsText as="span">{{ ledgerView28.t('financialMap.resultsFrom') }}</BsText>
                    </BsFlowBlock>
                    <BsBox aria-labelledby="financial-map-results" as="section">
                      <BsFlowBlock part="stage-heading">
                        <BsFlowBlock part="step" as="span">{{ ledgerView28.t('financialMap.steps.results') }}</BsFlowBlock>
                        <BsHeading id="financial-map-results" :level="3" size="body">{{ ledgerView28.t('financialMap.resultsTitle') }}</BsHeading>
                        <BsText>{{ ledgerView28.t('financialMap.resultsHint') }}</BsText>
                      </BsFlowBlock>
                      <BsFlowBlock part="branches" :columns="4" numbered>
                        <BsLink to="/accounts" @click="dismiss">
                          <BsFlowBlock part="node-number" as="span">5.1</BsFlowBlock>
                          <BsFlowBlock part="node-icon">
                            <BsIcon name="wallet" />
                          </BsFlowBlock>
                          <BsHeading :level="3" size="body">{{ ledgerView28.t('financialMap.results.accounts.title') }}</BsHeading>
                          <BsText>{{ ledgerView28.t('financialMap.results.accounts.body') }}</BsText>
                          <BsText as="span">{{ ledgerView28.t('financialMap.results.open') }} <BsIcon name="arrowRight" :size="15" directional /></BsText>
                        </BsLink>
                        <BsLink to="/dashboard" @click="dismiss">
                          <BsFlowBlock part="node-number" as="span">5.2</BsFlowBlock>
                          <BsFlowBlock part="node-icon">
                            <BsIcon name="dashboard" />
                          </BsFlowBlock>
                          <BsHeading :level="3" size="body">{{ ledgerView28.t('financialMap.results.dashboard.title') }}</BsHeading>
                          <BsText>{{ ledgerView28.t('financialMap.results.dashboard.body') }}</BsText>
                          <BsText as="span">{{ ledgerView28.t('financialMap.results.open') }} <BsIcon name="arrowRight" :size="15" directional /></BsText>
                        </BsLink>
                        <BsLink to="/reports" @click="dismiss">
                          <BsFlowBlock part="node-number" as="span">5.3</BsFlowBlock>
                          <BsFlowBlock part="node-icon">
                            <BsIcon name="reports" />
                          </BsFlowBlock>
                          <BsHeading :level="3" size="body">{{ ledgerView28.t('financialMap.results.reports.title') }}</BsHeading>
                          <BsText>{{ ledgerView28.t('financialMap.results.reports.body') }}</BsText>
                          <BsInline gap="xs" :wrap="true">
                            <BsFlowBlock v-for="report in ledgerView28.reports" :key="report" part="pill" as="span">{{ ledgerView28.t(`financialMap.results.reports.items.${report}`) }}</BsFlowBlock>
                          </BsInline>
                          <BsText as="span">{{ ledgerView28.t('financialMap.results.open') }} <BsIcon name="arrowRight" :size="15" directional /></BsText>
                        </BsLink>
                        <BsLink to="/transactions" @click="dismiss">
                          <BsFlowBlock part="node-number" as="span">5.4</BsFlowBlock>
                          <BsFlowBlock part="node-icon">
                            <BsIcon name="automation" />
                          </BsFlowBlock>
                          <BsHeading :level="3" size="body">{{ ledgerView28.t('financialMap.results.audit.title') }}</BsHeading>
                          <BsText>{{ ledgerView28.t('financialMap.results.audit.body') }}</BsText>
                          <BsText as="span">{{ ledgerView28.t('financialMap.results.open') }} <BsIcon name="arrowRight" :size="15" directional /></BsText>
                        </BsLink>
                      </BsFlowBlock>
                    </BsBox>
                    <BsBox as="aside" padding="lg">
                      <BsText as="strong">{{ ledgerView28.t('financialMap.boundary.title') }}</BsText>
                      <BsText as="span" tone="muted">{{ ledgerView28.t('financialMap.boundary.body') }}</BsText>
                    </BsBox>
                  </BsFlowBlock>
                </BsBox>
              </BsStack>
            </template>
          </BsDialog>
        </template>
      </BsWorkflowScope>
      <BsWorkflowScope :factory="useLedgerAddTransactionDialogView" :input="{  }">
        <template #default="{ state: ledgerView29 }">
          <BsRecordActionDialog
            v-if="ledgerView29.open"
            :visible="true"
            :title="ledgerView29.t(`add.flows.${ledgerView29.flow}`)"
            size="lg"
            :dirty="ledgerView29.overlayDirty0"
            :pending="ledgerView29.submitting"
            :error="ledgerView29.fieldError"
            :cancel-label="ledgerView29.t('common.cancel')"
            @update:visible="(value: boolean) => { if (!value) ledgerView29.close() }"
            @submit="ledgerView29.submit"
          >
            <BsBox>
              <BsFieldLabel for="flow">{{ ledgerView29.t('add.whatAreYouRecording') }}</BsFieldLabel>
              <BsSelect id="flow" v-model="ledgerView29.flow" native>
                <BsSelectOption v-for="f in ledgerView29.availableFlows" :key="f" :value="f">{{ ledgerView29.t(`add.flows.${f}`) }} — {{ ledgerView29.t(`add.hints.${f}`) }}</BsSelectOption>
              </BsSelect>
            </BsBox>
            <BsBox grow>
              <BsUsageMeter
                v-if="ledgerView29.ledgerUsage.item('max_monthly_transactions')"
                compact
                :item="ledgerView29.ledgerUsage.item('max_monthly_transactions')!"
              />
              <BsGrid :columns="2" gap="md">
                <!-- Amount: every flow except the split ones -->
                <BsBox v-if="!['liability_payment', 'adjustment'].includes(ledgerView29.flow)">
                  <BsFieldLabel for="amount">{{ ledgerView29.t('add.amount', { currency: ledgerView29.effectiveCurrency }) }}</BsFieldLabel>
                  <BsInput id="amount" v-model="ledgerView29.form.amount" inputmode="decimal" placeholder="0.00" required />
                </BsBox>
                <BsBox>
                  <BsFieldLabel for="date">{{ ledgerView29.t('add.date') }}</BsFieldLabel>
                  <BsInput id="date" v-model="ledgerView29.form.date" type="date" required />
                </BsBox>
                <BsBox v-if="ledgerView29.canMultiCurrency && ledgerView29.effectiveCurrency !== ledgerView29.baseCurrency">
                  <BsFieldLabel for="exchange-rate">{{ ledgerView29.t('add.exchangeRate', { currency: ledgerView29.effectiveCurrency, base: ledgerView29.baseCurrency }) }}</BsFieldLabel>
                  <BsInput id="exchange-rate" v-model="ledgerView29.form.exchangeRate" inputmode="decimal" placeholder="1.00" required />
                </BsBox>
                <BsText v-else-if="ledgerView29.effectiveCurrency !== ledgerView29.baseCurrency" size="sm" tone="muted">{{ ledgerView29.t('add.multiCurrencyUpgrade') }}</BsText>
                <template v-if="ledgerView29.canMultiCurrency && ledgerView29.isCrossCurrencyTransfer">
                  <BsBox>
                    <BsFieldLabel for="destination-amount">{{ ledgerView29.t('add.destinationAmount', { currency: ledgerView29.destinationCurrency }) }}</BsFieldLabel>
                    <BsInput id="destination-amount" v-model="ledgerView29.form.destinationAmount" inputmode="decimal" placeholder="0.00" required />
                  </BsBox>
                  <BsBox v-if="ledgerView29.destinationCurrency !== ledgerView29.baseCurrency">
                    <BsFieldLabel for="destination-exchange-rate">{{ ledgerView29.t('add.exchangeRate', { currency: ledgerView29.destinationCurrency, base: ledgerView29.baseCurrency }) }}</BsFieldLabel>
                    <BsInput id="destination-exchange-rate" v-model="ledgerView29.form.destinationExchangeRate" inputmode="decimal" placeholder="1.00" required />
                  </BsBox>
                </template>
                <!-- Income -->
                <template v-if="ledgerView29.flow === 'income'">
                  <BsBox>
                    <BsFieldLabel for="dest">{{ ledgerView29.t('add.receivedInto') }}</BsFieldLabel>
                    <BsSelect id="dest" v-model="ledgerView29.form.destinationAccountId" required native>
                      <BsSelectOption value="" disabled>{{ ledgerView29.t('add.chooseAccount') }}</BsSelectOption>
                      <BsSelectOption v-for="a in ledgerView29.paymentAccounts" :key="a.id" :value="a.id">{{ ledgerView29.accountLabel(a) }}</BsSelectOption>
                    </BsSelect>
                  </BsBox>
                  <BsBox>
                    <BsFieldLabel for="cat">{{ ledgerView29.t('add.category') }}</BsFieldLabel>
                    <BsSelect id="cat" v-model="ledgerView29.form.categoryId" required native>
                      <BsSelectOption value="" disabled>{{ ledgerView29.t('add.chooseCategory') }}</BsSelectOption>
                      <BsSelectOption v-for="c in ledgerView29.incomeCategories" :key="c.id" :value="c.id">{{ c.name }}</BsSelectOption>
                    </BsSelect>
                  </BsBox>
                </template>
                <!-- Expense -->
                <template v-if="ledgerView29.flow === 'expense'">
                  <BsBox>
                    <BsFieldLabel for="src">{{ ledgerView29.t('add.paidFrom') }}</BsFieldLabel>
                    <BsSelect id="src" v-model="ledgerView29.form.sourceAccountId" required native>
                      <BsSelectOption value="" disabled>{{ ledgerView29.t('add.chooseAccount') }}</BsSelectOption>
                      <BsSelectOption v-for="a in ledgerView29.paymentAccounts" :key="a.id" :value="a.id">{{ ledgerView29.accountLabel(a) }}</BsSelectOption>
                    </BsSelect>
                  </BsBox>
                  <BsBox>
                    <BsFieldLabel for="cat">{{ ledgerView29.t('add.category') }}</BsFieldLabel>
                    <BsSelect id="cat" v-model="ledgerView29.form.categoryId" required native>
                      <BsSelectOption value="" disabled>{{ ledgerView29.t('add.chooseCategory') }}</BsSelectOption>
                      <BsSelectOption v-for="c in ledgerView29.expenseCategories" :key="c.id" :value="c.id">{{ c.name }}</BsSelectOption>
                    </BsSelect>
                  </BsBox>
                </template>
                <!-- Transfer -->
                <template v-if="ledgerView29.flow === 'transfer'">
                  <BsBox>
                    <BsFieldLabel for="src">{{ ledgerView29.t('add.from') }}</BsFieldLabel>
                    <BsSelect id="src" v-model="ledgerView29.form.sourceAccountId" required native>
                      <BsSelectOption value="" disabled>{{ ledgerView29.t('add.chooseAccount') }}</BsSelectOption>
                      <BsSelectOption v-for="a in ledgerView29.paymentAccounts" :key="a.id" :value="a.id">{{ ledgerView29.accountLabel(a) }}</BsSelectOption>
                    </BsSelect>
                  </BsBox>
                  <BsBox>
                    <BsFieldLabel for="dest">{{ ledgerView29.t('add.to') }}</BsFieldLabel>
                    <BsSelect id="dest" v-model="ledgerView29.form.destinationAccountId" required native>
                      <BsSelectOption value="" disabled>{{ ledgerView29.t('add.chooseAccount') }}</BsSelectOption>
                      <BsSelectOption v-for="a in ledgerView29.paymentAccounts" :key="a.id" :value="a.id">{{ ledgerView29.accountLabel(a) }}</BsSelectOption>
                    </BsSelect>
                  </BsBox>
                  <BsBox>
                    <BsFieldLabel for="fee">{{ ledgerView29.t('add.transferFee') }} ({{ ledgerView29.t('common.optional') }})</BsFieldLabel>
                    <BsInput id="fee" v-model="ledgerView29.form.feeAmount" inputmode="decimal" placeholder="0.00" />
                    <BsText>{{ ledgerView29.t('add.transferFeeHint') }}</BsText>
                  </BsBox>
                </template>
                <!-- Asset purchase -->
                <template v-if="ledgerView29.flow === 'asset_purchase'">
                  <BsBox>
                    <BsFieldLabel for="asset">{{ ledgerView29.t('add.assetAccount') }}</BsFieldLabel>
                    <BsSelect id="asset" v-model="ledgerView29.form.assetAccountId" required native>
                      <BsSelectOption value="" disabled>{{ ledgerView29.t('add.chooseAccount') }}</BsSelectOption>
                      <BsSelectOption v-for="a in ledgerView29.assetAccounts" :key="a.id" :value="a.id">{{ ledgerView29.accountLabel(a) }}</BsSelectOption>
                    </BsSelect>
                  </BsBox>
                  <BsBox>
                    <BsFieldLabel for="src">{{ ledgerView29.t('add.paidFrom') }}</BsFieldLabel>
                    <BsSelect id="src" v-model="ledgerView29.form.sourceAccountId" required native>
                      <BsSelectOption value="" disabled>{{ ledgerView29.t('add.chooseAccount') }}</BsSelectOption>
                      <BsSelectOption v-for="a in ledgerView29.paymentAccounts" :key="a.id" :value="a.id">{{ ledgerView29.accountLabel(a) }}</BsSelectOption>
                    </BsSelect>
                  </BsBox>
                  <BsBox>
                    <BsFieldLabel for="life">{{ ledgerView29.t('add.usefulLife') }} ({{ ledgerView29.t('common.optional') }})</BsFieldLabel>
                    <BsInput id="life" v-model="ledgerView29.form.usefulLifeMonths" type="number" min="1" />
                    <BsText>{{ ledgerView29.t('add.usefulLifeHint') }}</BsText>
                  </BsBox>
                </template>
                <!-- Liability created -->
                <template v-if="ledgerView29.flow === 'liability_created'">
                  <BsBox>
                    <BsFieldLabel for="liab">{{ ledgerView29.t('add.liabilityAccount') }}</BsFieldLabel>
                    <BsSelect id="liab" v-model="ledgerView29.form.liabilityAccountId" required native>
                      <BsSelectOption value="" disabled>{{ ledgerView29.t('add.chooseAccount') }}</BsSelectOption>
                      <BsSelectOption v-for="a in ledgerView29.liabilityAccounts" :key="a.id" :value="a.id">{{ ledgerView29.accountLabel(a) }}</BsSelectOption>
                    </BsSelect>
                  </BsBox>
                  <BsBox>
                    <BsFieldLabel for="dest">{{ ledgerView29.t('add.receivedInto') }}</BsFieldLabel>
                    <BsSelect id="dest" v-model="ledgerView29.form.destinationAccountId" required native>
                      <BsSelectOption value="" disabled>{{ ledgerView29.t('add.chooseAccount') }}</BsSelectOption>
                      <BsSelectOption v-for="a in ledgerView29.paymentAccounts" :key="a.id" :value="a.id">{{ ledgerView29.accountLabel(a) }}</BsSelectOption>
                    </BsSelect>
                  </BsBox>
                  <BsBox>
                    <BsFieldLabel for="due">{{ ledgerView29.t('add.dueDate') }} ({{ ledgerView29.t('common.optional') }})</BsFieldLabel>
                    <BsInput id="due" v-model="ledgerView29.form.dueDate" type="date" />
                  </BsBox>
                </template>
                <!-- Liability payment -->
                <template v-if="ledgerView29.flow === 'liability_payment'">
                  <BsBox>
                    <BsFieldLabel for="liab">{{ ledgerView29.t('add.liability') }}</BsFieldLabel>
                    <BsSelect id="liab" v-model="ledgerView29.form.liabilityAccountId" required native>
                      <BsSelectOption value="" disabled>{{ ledgerView29.t('add.chooseAccount') }}</BsSelectOption>
                      <BsSelectOption v-for="a in ledgerView29.liabilityAccounts" :key="a.id" :value="a.id">{{ ledgerView29.accountLabel(a) }}</BsSelectOption>
                    </BsSelect>
                  </BsBox>
                  <BsBox>
                    <BsFieldLabel for="src">{{ ledgerView29.t('add.paidFrom') }}</BsFieldLabel>
                    <BsSelect id="src" v-model="ledgerView29.form.sourceAccountId" required native>
                      <BsSelectOption value="" disabled>{{ ledgerView29.t('add.chooseAccount') }}</BsSelectOption>
                      <BsSelectOption v-for="a in ledgerView29.paymentAccounts" :key="a.id" :value="a.id">{{ ledgerView29.accountLabel(a) }}</BsSelectOption>
                    </BsSelect>
                  </BsBox>
                  <BsBox>
                    <BsFieldLabel for="principal">{{ ledgerView29.t('add.principal') }}</BsFieldLabel>
                    <BsInput id="principal" v-model="ledgerView29.form.principal" inputmode="decimal" placeholder="0.00" />
                  </BsBox>
                  <BsBox>
                    <BsFieldLabel for="interest">{{ ledgerView29.t('add.interest') }}</BsFieldLabel>
                    <BsInput id="interest" v-model="ledgerView29.form.interest" inputmode="decimal" placeholder="0.00" />
                  </BsBox>
                  <BsBox>
                    <BsFieldLabel for="fees">{{ ledgerView29.t('add.fees') }}</BsFieldLabel>
                    <BsInput id="fees" v-model="ledgerView29.form.fees" inputmode="decimal" placeholder="0.00" />
                    <BsText>{{ ledgerView29.t('add.liabilityPaymentHint') }}</BsText>
                  </BsBox>
                </template>
                <!-- Owner contribution -->
                <template v-if="ledgerView29.flow === 'owner_contribution'">
                  <BsBox>
                    <BsFieldLabel for="dest">{{ ledgerView29.t('add.receivedInto') }}</BsFieldLabel>
                    <BsSelect id="dest" v-model="ledgerView29.form.destinationAccountId" required native>
                      <BsSelectOption value="" disabled>{{ ledgerView29.t('add.chooseAccount') }}</BsSelectOption>
                      <BsSelectOption v-for="a in ledgerView29.paymentAccounts" :key="a.id" :value="a.id">{{ ledgerView29.accountLabel(a) }}</BsSelectOption>
                    </BsSelect>
                  </BsBox>
                  <BsBox>
                    <BsFieldLabel for="equity">{{ ledgerView29.t('add.equityAccount') }} ({{ ledgerView29.t('common.optional') }})</BsFieldLabel>
                    <BsSelect id="equity" v-model="ledgerView29.form.equityAccountId" native>
                      <BsSelectOption value="">{{ ledgerView29.t('add.ownerCapitalDefault') }}</BsSelectOption>
                      <BsSelectOption v-for="a in ledgerView29.equityAccounts" :key="a.id" :value="a.id">{{ ledgerView29.accountLabel(a) }}</BsSelectOption>
                    </BsSelect>
                  </BsBox>
                </template>
                <!-- Owner withdrawal -->
                <template v-if="ledgerView29.flow === 'owner_withdrawal'">
                  <BsBox>
                    <BsFieldLabel for="src">{{ ledgerView29.t('add.takenFrom') }}</BsFieldLabel>
                    <BsSelect id="src" v-model="ledgerView29.form.sourceAccountId" required native>
                      <BsSelectOption value="" disabled>{{ ledgerView29.t('add.chooseAccount') }}</BsSelectOption>
                      <BsSelectOption v-for="a in ledgerView29.paymentAccounts" :key="a.id" :value="a.id">{{ ledgerView29.accountLabel(a) }}</BsSelectOption>
                    </BsSelect>
                  </BsBox>
                  <BsBox>
                    <BsFieldLabel for="equity">{{ ledgerView29.t('add.drawingsAccount') }} ({{ ledgerView29.t('common.optional') }})</BsFieldLabel>
                    <BsSelect id="equity" v-model="ledgerView29.form.equityAccountId" native>
                      <BsSelectOption value="">{{ ledgerView29.t('add.ownerDrawingsDefault') }}</BsSelectOption>
                      <BsSelectOption v-for="a in ledgerView29.equityAccounts" :key="a.id" :value="a.id">{{ ledgerView29.accountLabel(a) }}</BsSelectOption>
                    </BsSelect>
                  </BsBox>
                </template>
                <!-- Counterparty, where it means something -->
                <BsBox v-if="['income', 'expense', 'asset_purchase', 'liability_created', 'liability_payment'].includes(ledgerView29.flow)">
                  <BsFieldLabel for="cp">{{ ledgerView29.t('add.counterparty') }} ({{ ledgerView29.t('common.optional') }})</BsFieldLabel>
                  <BsSelect id="cp" v-model="ledgerView29.form.counterpartyId" native>
                    <BsSelectOption value="">{{ ledgerView29.t('common.none') }}</BsSelectOption>
                    <BsSelectOption v-for="c in ledgerView29.counterparties" :key="c.id" :value="c.id">{{ c.name }}</BsSelectOption>
                  </BsSelect>
                </BsBox>
                <BsBox>
                  <BsFieldLabel for="descr">{{ ledgerView29.t('add.description') }}</BsFieldLabel>
                  <BsInput
                    id="descr"
                    v-model="ledgerView29.form.description"
                    :required="ledgerView29.flow === 'adjustment'"
                    :placeholder="ledgerView29.t('add.descriptionPlaceholder')"
                  />
                </BsBox>
                <BsBox v-if="ledgerView29.flow !== 'adjustment'">
                  <BsFieldLabel for="ref">{{ ledgerView29.t('add.reference') }} ({{ ledgerView29.t('common.optional') }})</BsFieldLabel>
                  <BsInput id="ref" v-model="ledgerView29.form.reference" :placeholder="ledgerView29.t('add.referencePlaceholder')" />
                </BsBox>
                <BsBox v-if="ledgerView29.flow === 'adjustment'" :span="2">
                  <BsFieldLabel for="reason">{{ ledgerView29.t('add.adjustmentReason') }}</BsFieldLabel>
                  <BsInput id="reason" v-model="ledgerView29.form.reason" required :placeholder="ledgerView29.t('add.adjustmentReasonPlaceholder')" />
                </BsBox>
              </BsGrid>
              <!-- Manual journal -->
              <BsBox v-if="ledgerView29.flow === 'adjustment'">
                <BsInline gap="none" :wrap="false" justify="between">
                  <BsHeading :level="3" size="body">{{ ledgerView29.t('add.journalLines') }}</BsHeading>
                  <BsButton type="button" size="sm" @click="ledgerView29.addLine">{{ ledgerView29.t('add.addLine') }}</BsButton>
                </BsInline>
                <BsStack gap="sm">
                  <BsBox v-for="(line, index) in ledgerView29.form.lines" :key="index" padding="md" border radius="control">
                    <BsGrid :columns="1" gap="sm">
                      <BsBox>
                        <BsFieldLabel :for="`line-account-${index}`">{{ ledgerView29.t('detail.account') }}</BsFieldLabel>
                        <BsSelect :id="`line-account-${index}`" v-model="line.accountId" native>
                          <BsSelectOption value="" disabled>{{ ledgerView29.t('detail.account') }}</BsSelectOption>
                          <BsSelectOption v-for="a in ledgerView29.postableAccounts" :key="a.id" :value="a.id">{{ a.code ? `${a.code} · ` : '' }}{{ a.name }}</BsSelectOption>
                        </BsSelect>
                      </BsBox>
                      <BsBox>
                        <BsFieldLabel :for="`line-side-${index}`">{{ ledgerView29.t('add.side') }}</BsFieldLabel>
                        <BsSelect :id="`line-side-${index}`" v-model="line.side" native>
                          <BsSelectOption value="debit">{{ ledgerView29.t('add.debit') }}</BsSelectOption>
                          <BsSelectOption value="credit">{{ ledgerView29.t('add.credit') }}</BsSelectOption>
                        </BsSelect>
                      </BsBox>
                      <BsBox>
                        <BsFieldLabel :for="`line-amount-${index}`">{{ ledgerView29.t('transactions.amount') }}</BsFieldLabel>
                        <BsInput :id="`line-amount-${index}`" v-model="line.amount" inputmode="decimal" placeholder="0.00" />
                      </BsBox>
                      <BsButton
                        type="button"
                        :disabled="ledgerView29.form.lines.length <= 2"
                        :aria-label="ledgerView29.t('add.removeLine', { index: index + 1 })"
                        size="sm"
                        @click="ledgerView29.removeLine(index)"
                      >
                        <BsIcon name="delete" :size="18" />
                      </BsButton>
                    </BsGrid>
                    <BsStack v-if="ledgerView29.can('dimensions.allocate') && ledgerView29.dimensionWorkspace?.values.some(value => value.status==='active')" gap="sm">
                      <BsInline gap="sm" :wrap="true">
                        <BsButton type="button" size="sm" @click="ledgerView29.addAllocation(line,'cost_center')">{{ ledgerView29.t('dimensions.allocateKind', { kind: ledgerView29.t('dimensions.kinds.cost_center') }) }}</BsButton>
                        <BsButton type="button" size="sm" @click="ledgerView29.addAllocation(line,'project')">{{ ledgerView29.t('dimensions.allocateKind', { kind: ledgerView29.t('dimensions.kinds.project') }) }}</BsButton>
                      </BsInline>
                      <BsGrid v-for="(allocation, allocationIndex) in line.allocations" :key="allocationIndex" :columns="1" gap="sm">
                        <BsSelect v-model="allocation.valueId" native>
                          <BsSelectOption value="">{{ ledgerView29.t(`dimensions.kinds.${allocation.kind}`) }}</BsSelectOption>
                          <BsSelectOption
                            v-for="value in ledgerView29.dimensionWorkspace.values.filter(item=>item.kind===allocation.kind && item.status==='active')"
                            :key="value.id"
                            :value="value.id"
                          >{{ value.code }} · {{ value.name }}</BsSelectOption>
                        </BsSelect>
                        <BsInput v-model="allocation.amount" inputmode="decimal" :aria-label="ledgerView29.t('dimensions.allocationAmount')" />
                        <BsButton type="button" :aria-label="ledgerView29.t('dimensions.removeAllocation')" size="sm" @click="line.allocations.splice(allocationIndex,1)">
                          <BsIcon name="delete" :size="18" />
                        </BsButton>
                      </BsGrid>
                    </BsStack>
                  </BsBox>
                </BsStack>
                <BsInline gap="sm" :wrap="true" justify="between" surface="muted" radius="control">
                  <BsText as="span">{{ ledgerView29.t('add.debitsTotal') }} <BsMoneyText :amount="ledgerView29.adjustmentTotals.debit" :currency="ledgerView29.ledgerPresentation.currency()" :locale="ledgerView29.ledgerPresentation.locale" />
                · {{ ledgerView29.t('add.creditsTotal') }} <BsMoneyText :amount="ledgerView29.adjustmentTotals.credit" :currency="ledgerView29.ledgerPresentation.currency()" :locale="ledgerView29.ledgerPresentation.locale" /></BsText>
                  <BsText as="span" emphasis="semibold" :tone="ledgerView29.adjustmentTotals.balanced ? 'success' : 'danger'">{{ ledgerView29.adjustmentTotals.balanced ? ledgerView29.t('add.balanced') : ledgerView29.t('add.notBalanced') }}</BsText>
                </BsInline>
              </BsBox>
            </BsBox>
            <template #actions="{ close: dismiss }">
              <BsButton type="button" :disabled="ledgerView29.submitting" @click="dismiss">{{ ledgerView29.t('common.cancel') }}</BsButton>
              <BsButton type="submit" variant="accent" :pending="ledgerView29.submitting">{{ ledgerView29.t('common.save') }}</BsButton>
            </template>
          </BsRecordActionDialog>
        </template>
      </BsWorkflowScope>
      <BsWorkflowScope :factory="useLedgerOperationsCenterView" :input="{  }">
        <template #default="{ state: ledgerView30 }">
          <BsRecordActionDialog
            v-if="ledgerView30.open"
            :visible="true"
            :title="ledgerView30.title"
            size="lg"
            :dirty="ledgerView30.overlayDirty0"
            :pending="ledgerView30.busy"
            :error="ledgerView30.errorMessage"
            :submit-label="ledgerView30.submitLabel"
            :cancel-label="ledgerView30.t('common.cancel')"
            @update:visible="(value: boolean) => { if (!value) ledgerView30.close() }"
            @submit="ledgerView30.submitCurrent"
          >
            <BsBox as="main" grow>
              <BsUsageMeter
                v-if="(ledgerView30.quotaKey) && ledgerView30.ledgerUsage.item(ledgerView30.quotaKey)"
                compact
                :item="ledgerView30.ledgerUsage.item(ledgerView30.quotaKey)!"
              />
              <BsGrid v-if="ledgerView30.tab === 'commitments' && ledgerView30.can('commitments.create')" :columns="2" gap="md">
                <BsFloatingField :label="ledgerView30.t('operations.name')">
                  <BsInput v-model="ledgerView30.commitmentForm.title" :placeholder="ledgerView30.t('operations.name')" required />
                </BsFloatingField>
                <BsFloatingField :label="ledgerView30.t('transactions.description')">
                  <BsInput v-model="ledgerView30.commitmentForm.description" :placeholder="ledgerView30.t('transactions.description')" />
                </BsFloatingField>
                <BsFloatingField :label="ledgerView30.t('transactions.amount')">
                  <BsInput v-model="ledgerView30.commitmentForm.amount" inputmode="decimal" :placeholder="ledgerView30.t('transactions.amount')" required />
                </BsFloatingField>
                <BsFloatingField :label="ledgerView30.t('add.dueDate')">
                  <BsInput v-model="ledgerView30.commitmentForm.dueDate" type="date" required />
                </BsFloatingField>
                <BsFloatingField :label="ledgerView30.t('transactions.type')">
                  <BsSelect v-model="ledgerView30.commitmentForm.type" native>
                    <BsSelectOption value="payable">{{ ledgerView30.t('operations.payable') }}</BsSelectOption>
                    <BsSelectOption value="receivable">{{ ledgerView30.t('operations.receivable') }}</BsSelectOption>
                    <BsSelectOption value="scheduled_expense">{{ ledgerView30.t('operations.scheduledExpense') }}</BsSelectOption>
                    <BsSelectOption value="scheduled_income">{{ ledgerView30.t('operations.scheduledIncome') }}</BsSelectOption>
                  </BsSelect>
                </BsFloatingField>
                <BsFloatingField :label="ledgerView30.t('add.category')">
                  <BsSelect v-model="ledgerView30.commitmentForm.categoryId" native>
                    <BsSelectOption value="">{{ ledgerView30.t('add.chooseCategory') }}</BsSelectOption>
                    <BsSelectOption
                      v-for="c in (['receivable','scheduled_income'].includes(ledgerView30.commitmentForm.type) ? ledgerView30.incomeCategories : ledgerView30.expenseCategories)"
                      :key="c.id"
                      :value="c.id"
                    >{{ c.name }}</BsSelectOption>
                  </BsSelect>
                </BsFloatingField>
                <BsFloatingField :label="ledgerView30.t('add.counterparty')">
                  <BsSelect v-model="ledgerView30.commitmentForm.counterpartyId" native>
                    <BsSelectOption value="">{{ ledgerView30.t('add.counterparty') }}</BsSelectOption>
                    <BsSelectOption v-for="party in ledgerView30.counterparties" :key="party.id" :value="party.id">{{ party.name }}</BsSelectOption>
                  </BsSelect>
                </BsFloatingField>
                <BsFloatingField :label="ledgerView30.t('add.chooseAccount')">
                  <BsSelect v-model="ledgerView30.commitmentForm.paymentAccountId" :required="ledgerView30.commitmentForm.autoConvert" native>
                    <BsSelectOption value="">{{ ledgerView30.t('add.chooseAccount') }}</BsSelectOption>
                    <BsSelectOption v-for="a in ledgerView30.paymentAccounts" :key="a.id" :value="a.id">{{ a.name }}</BsSelectOption>
                  </BsSelect>
                </BsFloatingField>
                <BsFieldLabel><BsCheckbox v-model="ledgerView30.commitmentForm.autoConvert" bare />{{ ledgerView30.t('operations.autoConvert') }}</BsFieldLabel>
                <BsFieldLabel>{{ ledgerView30.t('operations.reminderDays') }} <BsInput v-model.number="ledgerView30.commitmentForm.reminderDays" type="number" min="0" max="90" /></BsFieldLabel>
              </BsGrid>
              <BsGrid v-else-if="ledgerView30.tab === 'recurring' && ledgerView30.can('recurring.manage')" :columns="3" gap="md">
                <BsFloatingField :label="ledgerView30.t('operations.name')">
                  <BsInput v-model="ledgerView30.recurringForm.name" :placeholder="ledgerView30.t('operations.name')" required />
                </BsFloatingField>
                <BsFloatingField v-if="ledgerView30.recurringForm.transactionType !== 'liability_payment'" :label="ledgerView30.t('transactions.amount')">
                  <BsInput v-model="ledgerView30.recurringForm.amount" inputmode="decimal" :placeholder="ledgerView30.t('transactions.amount')" required />
                </BsFloatingField>
                <BsFloatingField :label="ledgerView30.t('transactions.type')">
                  <BsSelect v-model="ledgerView30.recurringForm.transactionType" native>
                    <BsSelectOption value="expense">{{ ledgerView30.t('types.expense') }}</BsSelectOption>
                    <BsSelectOption value="income">{{ ledgerView30.t('types.income') }}</BsSelectOption>
                    <BsSelectOption value="liability_payment">{{ ledgerView30.t('types.liability_payment') }}</BsSelectOption>
                  </BsSelect>
                </BsFloatingField>
                <BsFloatingField v-if="ledgerView30.recurringForm.transactionType !== 'liability_payment'" :label="ledgerView30.t('add.category')">
                  <BsSelect v-model="ledgerView30.recurringForm.categoryId" native>
                    <BsSelectOption value="">{{ ledgerView30.t('add.chooseCategory') }}</BsSelectOption>
                    <BsSelectOption
                      v-for="c in (ledgerView30.recurringForm.transactionType === 'income' ? ledgerView30.incomeCategories : ledgerView30.expenseCategories)"
                      :key="c.id"
                      :value="c.id"
                    >{{ c.name }}</BsSelectOption>
                  </BsSelect>
                </BsFloatingField>
                <template v-else>
                  <BsSelect v-model="ledgerView30.recurringForm.liabilityAccountId" required native>
                    <BsSelectOption value="">{{ ledgerView30.t('add.liabilityAccount') }}</BsSelectOption>
                    <BsSelectOption v-for="account in ledgerView30.liabilityAccounts" :key="account.id" :value="account.id">{{ account.name }}</BsSelectOption>
                  </BsSelect>
                  <BsInput v-model="ledgerView30.recurringForm.principal" inputmode="decimal" :placeholder="ledgerView30.t('add.principal')" required />
                  <BsInput v-model="ledgerView30.recurringForm.interest" inputmode="decimal" :placeholder="ledgerView30.t('add.interest')" />
                  <BsInput v-model="ledgerView30.recurringForm.fees" inputmode="decimal" :placeholder="ledgerView30.t('add.fees')" />
                </template>
                <BsSelect v-model="ledgerView30.recurringForm.paymentAccountId" required native>
                  <BsSelectOption value="">{{ ledgerView30.t('add.chooseAccount') }}</BsSelectOption>
                  <BsSelectOption v-for="a in ledgerView30.paymentAccounts" :key="a.id" :value="a.id">{{ a.name }}</BsSelectOption>
                </BsSelect>
                <BsFieldLabel>{{ ledgerView30.t('operations.every') }} <BsInput v-model.number="ledgerView30.recurringForm.intervalCount" type="number" min="1" required /></BsFieldLabel>
                <BsInput v-model="ledgerView30.recurringForm.endDate" type="date" :aria-label="ledgerView30.t('operations.endDate')" />
                <BsInput v-model="ledgerView30.recurringForm.maxOccurrences" type="number" min="1" :placeholder="ledgerView30.t('operations.maxOccurrences')" />
                <BsSelect v-model="ledgerView30.recurringForm.frequency" native>
                  <BsSelectOption v-for="f in ['daily','weekly','monthly','quarterly','yearly']" :key="f" :value="f">{{ f }}</BsSelectOption>
                </BsSelect>
                <BsInput v-model="ledgerView30.recurringForm.startDate" type="date" />
                <BsSelect v-model="ledgerView30.recurringForm.mode" native>
                  <BsSelectOption value="requires_confirmation">{{ ledgerView30.t('operations.confirmMode') }}</BsSelectOption>
                  <BsSelectOption value="auto_post">{{ ledgerView30.t('operations.autoPost') }}</BsSelectOption>
                </BsSelect>
              </BsGrid>
              <BsGrid v-else-if="ledgerView30.tab === 'counterparties' && ledgerView30.can('counterparties.manage')" :columns="2" gap="md">
                <BsInput v-model="ledgerView30.counterpartyForm.name" :placeholder="ledgerView30.t('operations.name')" required />
                <BsSelect v-model="ledgerView30.counterpartyForm.type" native>
                  <BsSelectOption v-for="type in ['customer','vendor','lender','employee','government','other']" :key="type" :value="type">{{ type }}</BsSelectOption>
                </BsSelect>
                <BsInput v-model="ledgerView30.counterpartyForm.email" type="email" :placeholder="ledgerView30.t('auth.email')" />
                <BsInput v-model="ledgerView30.counterpartyForm.phone" :placeholder="ledgerView30.t('operations.phone')" />
                <BsInput v-model="ledgerView30.counterpartyForm.taxIdentifier" :placeholder="ledgerView30.t('operations.taxIdentifier')" />
                <BsInput v-model="ledgerView30.counterpartyForm.notes" :placeholder="ledgerView30.t('operations.notes')" />
              </BsGrid>
              <BsStack v-else-if="ledgerView30.can('tags.manage')" gap="md">
                <BsText size="sm" tone="muted">{{ ledgerView30.t('tagsGuide.createHint') }}</BsText>
                <BsFloatingField :label="ledgerView30.t('operations.name')">
                  <BsInput id="tag-name" v-model="ledgerView30.tagForm.name" :placeholder="ledgerView30.t('tagsGuide.namePlaceholder')" required maxlength="80" />
                </BsFloatingField>
                <BsFloatingField :label="ledgerView30.t('recordPages.color')">
                  <BsInput id="tag-color" v-model="ledgerView30.tagForm.color" type="color" />
                </BsFloatingField>
              </BsStack>
            </BsBox>
          </BsRecordActionDialog>
        </template>
      </BsWorkflowScope>
      <BsWorkflowScope :factory="useLedgerTeamMenuView" :input="{ showTrigger: (false) }">
        <template #default="{ state: ledgerView31 }">
          <BsBox v-if="ledgerView31.can('members.invite')">
            <BsButton v-if="ledgerView31.showTrigger" type="button" size="sm" block @click="ledgerView31.show">{{ ledgerView31.t('org.invite') }}</BsButton>
            <BsRecordActionDialog
              v-if="ledgerView31.open"
              :visible="true"
              :title="ledgerView31.t('org.invite')"
              size="md"
              :dirty="ledgerView31.overlayDirty0"
              :pending="ledgerView31.pending"
              :error="ledgerView31.errorMessage"
              :submit-label="ledgerView31.t('org.createInvite')"
              :cancel-label="ledgerView31.t('common.cancel')"
              @update:visible="(value: boolean) => { if (!value) ledgerView31.close() }"
              @submit="ledgerView31.invite"
            >
              <BsText size="sm" tone="muted">{{ ledgerView31.t('access.inviteDescription') }}</BsText>
              <BsUsageMeter v-if="ledgerView31.ledgerUsage.item('max_members')" compact :item="ledgerView31.ledgerUsage.item('max_members')!" />
              <BsFloatingField :label="ledgerView31.t('auth.email')">
                <BsInput v-model="ledgerView31.email" type="email" :placeholder="ledgerView31.t('auth.email')" autocomplete="email" dir="ltr" required />
              </BsFloatingField>
              <BsFloatingField :label="ledgerView31.t('team.role')">
                <BsSelect v-model="ledgerView31.role" native>
                  <BsSelectOption v-for="key in ['admin','accountant','data_entry','viewer']" :key="key" :value="`system:${key}`">{{ ledgerView31.t(`org.roles.${key}`) }}</BsSelectOption>
                  <BsSelectOption v-for="custom in ledgerView31.customRoles" :key="custom.id" :value="`custom:${custom.id}`">{{ ledgerView31.roleLabel(null, custom.id) }}</BsSelectOption>
                </BsSelect>
              </BsFloatingField>
              <BsInline gap="md" :wrap="false" align="start" padding="lg" surface="muted" radius="control">
                <BsIcon name="mail" />
                <BsBox>
                  <BsText size="sm" emphasis="bold">{{ ledgerView31.t('access.emailDelivery') }}</BsText>
                  <BsText size="xs" tone="muted">{{ ledgerView31.t('access.emailDeliveryHint') }}</BsText>
                </BsBox>
              </BsInline>
            </BsRecordActionDialog>
          </BsBox>
        </template>
      </BsWorkflowScope>
      <BsToastHost />
    </template>
  </BsAppShell>
</template>
