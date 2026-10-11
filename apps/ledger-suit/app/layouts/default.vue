<script setup lang="ts">
import { useLedgerAddTransactionDialogView } from '~/composables/useLedgerAddTransactionDialogView'
import { useLedgerOperationsCenterView } from '~/composables/useLedgerOperationsCenterView'
import { useLedgerOrganizationSetupView } from '~/composables/useLedgerOrganizationSetupView'
import { useLedgerOrganizationSwitcherView } from '~/composables/useLedgerOrganizationSwitcherView'
import { useLedgerSyntheticDemoView } from '~/composables/useLedgerSyntheticDemoView'
import { useLedgerTeamMenuView } from '~/composables/useLedgerTeamMenuView'
import { scopedQueryKey } from '@building-suit/data-access'
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


const { t, locale } = useI18n()
const supabase = useSupabaseClient<Database>()
const user = useSupabaseUser()
const route = useRoute()
const config = useRuntimeConfig()
const { current, currentId, organizations, loadOrganizations, loading, baseCurrency } = useTenant()
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
const profileKey = computed(() => `account:${scopedQueryKey({ environment: String(config.public.supabase.url), portal: 'ledger-suit', userId: userId.value ?? '', tenantId: '' }, 'profile')}`)
const { data: profile } = useLazyAsyncData(profileKey, async () => {
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
const notificationsKey = computed(() => `org:${scopedQueryKey({ environment: String(config.public.supabase.url), portal: 'ledger-suit', userId: userId.value ?? '', tenantId: currentId.value ?? '' }, 'notifications')}`)
const { data: notifications, refresh: refreshNotifications } = useLazyAsyncData(notificationsKey, async () => {
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
onMounted(() => { now.value = Date.now() })
usePolling(() => { now.value = Date.now() }, () => 30_000)
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

const financialMapCopy = computed(() => ({ open: t('financialMap.open'), button: t('financialMap.button'), title: t('financialMap.title'), eyebrow: t('financialMap.eyebrow'), subtitle: t('financialMap.subtitle'), commonClose: t('common.close'), stepsSetup: t('financialMap.steps.setup'), setupTitle: t('financialMap.setup.title'), setupBody: t('financialMap.setup.body'), setupOrganization: t('financialMap.setup.organization'), setupOrganizationHint: t('financialMap.setup.organizationHint'), setupAccounts: t('financialMap.setup.accounts'), setupAccountsHint: t('financialMap.setup.accountsHint'), setupReviewAccounts: t('financialMap.setup.reviewAccounts'), setupCategories: t('financialMap.setup.categories'), setupCategoriesHint: t('financialMap.setup.categoriesHint'), setupFirstEntry: t('financialMap.setup.firstEntry'), stepsRecord: t('financialMap.steps.record'), sourcesTitle: t('financialMap.sourcesTitle'), sourcesHint: t('financialMap.sourcesHint'), manualTitle: t('financialMap.manual.title'), manualBody: t('financialMap.manual.body'), manualLink: t('financialMap.manual.link'), commitmentsTitle: t('financialMap.commitments.title'), commitmentsBody: t('financialMap.commitments.body'), commitmentsRule: t('financialMap.commitments.rule'), commitmentsLink: t('financialMap.commitments.link'), recurringTitle: t('financialMap.recurring.title'), recurringBody: t('financialMap.recurring.body'), recurringRule: t('financialMap.recurring.rule'), recurringLink: t('financialMap.recurring.link'), manualFlowsTitle: t('financialMap.manual.flowsTitle'), converges: t('financialMap.converges'), stepsValidate: t('financialMap.steps.validate'), engineTitle: t('financialMap.engine.title'), engineBody: t('financialMap.engine.body'), engineResult: t('financialMap.engine.result'), stepsLedger: t('financialMap.steps.ledger'), ledgerRule: t('financialMap.ledger.rule'), ledgerEventLabel: t('financialMap.ledger.eventLabel'), ledgerEvent: t('financialMap.ledger.event'), ledgerEventHint: t('financialMap.ledger.eventHint'), ledgerLinesLabel: t('financialMap.ledger.linesLabel'), ledgerLines: t('financialMap.ledger.lines'), ledgerLinesHint: t('financialMap.ledger.linesHint'), resultsFrom: t('financialMap.resultsFrom'), stepsResults: t('financialMap.steps.results'), resultsTitle: t('financialMap.resultsTitle'), resultsHint: t('financialMap.resultsHint'), resultsAccountsTitle: t('financialMap.results.accounts.title'), resultsAccountsBody: t('financialMap.results.accounts.body'), resultsOpen: t('financialMap.results.open'), resultsDashboardTitle: t('financialMap.results.dashboard.title'), resultsDashboardBody: t('financialMap.results.dashboard.body'), resultsReportsTitle: t('financialMap.results.reports.title'), resultsReportsBody: t('financialMap.results.reports.body'), resultsAuditTitle: t('financialMap.results.audit.title'), resultsAuditBody: t('financialMap.results.audit.body'), boundaryTitle: t('financialMap.boundary.title'), boundaryBody: t('financialMap.boundary.body') }))
const financialMapFlows = computed(() => ['income', 'expense', 'transfer', 'asset', 'liability', 'repayment', 'owner', 'adjustment'].map(key => t(`financialMap.manual.flows.${key}`)))
const financialMapChecks = computed(() => ['access', 'period', 'accounts', 'balance', 'atomic'].map(key => t(`financialMap.engine.checks.${key}`)))
const financialMapReports = computed(() => ['profitLoss', 'balanceSheet', 'cashFlow', 'trialBalance', 'generalLedger'].map(key => t(`financialMap.results.reports.items.${key}`)))
const workspaceSwitcher = reactive(useLedgerOrganizationSwitcherView())
const workspaceCreationForm = computed({ get: () => ({ name: workspaceSwitcher.name, legalName: workspaceSwitcher.legalName, currency: workspaceSwitcher.currency }), set: value => { workspaceSwitcher.name = value.name; workspaceSwitcher.legalName = value.legalName; workspaceSwitcher.currency = value.currency } })
const workspaceCreationView = computed(() => ({ visible: workspaceSwitcher.createOpen, pending: workspaceSwitcher.pending, dirty: workspaceSwitcher.overlayDirty0, error: workspaceSwitcher.errorMessage, currencies: ['EGP', 'USD', 'EUR', 'GBP', 'SAR', 'AED'], copy: { title: t('org.createAnother'), eyebrow: t('org.additionalEyebrow'), hint: t('org.additionalBillingHint'), name: t('org.name'), legalName: t('onboarding.legalName'), currency: t('accounts.currency'), separateTitle: t('org.separateSubscriptionTitle'), separateBody: t('org.separateSubscriptionBody'), cancel: t('common.cancel'), create: t('org.createAndStartTrial') } }))
const teamInvitation = reactive(useLedgerTeamMenuView())
const teamInvitationForm = computed({ get: () => ({ name: '', jobTitle: '', email: teamInvitation.email, role: teamInvitation.role, locationIds: [] as string[] }), set: value => { teamInvitation.email = value.email; teamInvitation.role = value.role } })
const teamInvitationState = computed(() => ({ visible: teamInvitation.open, title: t('org.invite'), dirty: teamInvitation.overlayDirty0, pending: teamInvitation.pending, error: teamInvitation.errorMessage, submitLabel: t('org.createInvite'), cancelLabel: t('common.cancel') }))
const teamInvitationCopy = computed(() => ({ email: t('auth.email'), role: t('team.role'), help: t('access.inviteDescription'), deliveryTitle: t('access.emailDelivery'), deliveryHint: t('access.emailDeliveryHint') }))
const teamInvitationRoles = computed(() => [...['admin', 'accountant', 'data_entry', 'viewer'].map(key => ({ value: `system:${key}`, label: t(`org.roles.${key}`) })), ...teamInvitation.customRoles.map(role => ({ value: `custom:${role.id}`, label: teamInvitation.roleLabel(null, role.id) }))])
const workspaceSetup = reactive(useLedgerOrganizationSetupView())
const syntheticDemo = reactive(useLedgerSyntheticDemoView())
const workspaceSetupForm = computed({ get: () => ({ name: workspaceSetup.name, legalName: workspaceSetup.legalName, currency: workspaceSetup.currency, invitationToken: workspaceSetup.invitationToken }), set: value => { workspaceSetup.name = value.name; workspaceSetup.legalName = value.legalName; workspaceSetup.currency = value.currency; workspaceSetup.invitationToken = value.invitationToken } })
const syntheticAccounts = computed(() => syntheticDemo.state.accounts.map(account => ({ code: account.code, name: t(`chartTemplates.accounts.${account.nameKey}`), debit: syntheticDemo.amount(account.debitMinor), credit: syntheticDemo.amount(account.creditMinor) })))
const workspaceSetupCopy = computed(() => ({ orgCreate: t('org.create'), orgCreateHint: t('org.createHint'), orgName: t('org.name'), onboardingLegalName: t('onboarding.legalName'), accountsCurrency: t('accounts.currency'), orgAcceptInvite: t('org.acceptInvite'), orgAcceptInviteHint: t('org.acceptInviteHint'), orgInviteToken: t('org.inviteToken'), demoInvitationTitle: t('demo.invitationTitle'), demoInvitationHint: t('demo.invitationHint'), demoOpen: t('demo.open'), demoTitle: t('demo.title'), demoIsolation: t('demo.isolation'), commonClose: t('common.close'), demoSyntheticBadge: t('demo.syntheticBadge'), demoNoRealOrganization: t('demo.noRealOrganization'), accountsCode: t('accounts.code'), accountsAccount: t('accounts.account'), openingDebit: t('opening.debit'), openingCredit: t('opening.credit'), demoAddReceipt: t('demo.addReceipt'), demoReset: t('demo.reset') }))
const operations = reactive(useLedgerOperationsCenterView())
const commitmentDraft = computed({ get: () => ({ ...operations.commitmentForm }), set: value => { Object.assign(operations.commitmentForm, value) } })
const recurringDraft = computed({ get: () => ({ ...operations.recurringForm }), set: value => { Object.assign(operations.recurringForm, value) } })
const counterpartyDraft = computed({ get: () => ({ ...operations.counterpartyForm }), set: value => { Object.assign(operations.counterpartyForm, value) } })
const tagDraft = computed({ get: () => ({ ...operations.tagForm }), set: value => { Object.assign(operations.tagForm, value) } })
const operationalCreationView = computed(() => ({ visible: operations.open, title: operations.title, dirty: operations.overlayDirty0, pending: operations.busy, error: operations.errorMessage, submitLabel: operations.submitLabel, tab: operations.tab, canCreate: can(operations.tab === 'commitments' ? 'commitments.create' : operations.tab === 'recurring' ? 'recurring.manage' : operations.tab === 'counterparties' ? 'counterparties.manage' : 'tags.manage'), usage: operations.quotaKey ? operations.ledgerUsage.item(operations.quotaKey) ?? undefined : undefined }))
const operationalCreationCopy = computed(() => ({ commonCancel: t('common.cancel'), operationsName: t('operations.name'), transactionsDescription: t('transactions.description'), transactionsAmount: t('transactions.amount'), addDueDate: t('add.dueDate'), transactionsType: t('transactions.type'), operationsPayable: t('operations.payable'), operationsReceivable: t('operations.receivable'), operationsScheduledExpense: t('operations.scheduledExpense'), operationsScheduledIncome: t('operations.scheduledIncome'), addCategory: t('add.category'), addChooseCategory: t('add.chooseCategory'), addCounterparty: t('add.counterparty'), addChooseAccount: t('add.chooseAccount'), operationsAutoConvert: t('operations.autoConvert'), operationsReminderDays: t('operations.reminderDays'), typesExpense: t('types.expense'), typesIncome: t('types.income'), typesLiability_payment: t('types.liability_payment'), addLiabilityAccount: t('add.liabilityAccount'), addPrincipal: t('add.principal'), addInterest: t('add.interest'), addFees: t('add.fees'), operationsEvery: t('operations.every'), operationsEndDate: t('operations.endDate'), operationsMaxOccurrences: t('operations.maxOccurrences'), operationsConfirmMode: t('operations.confirmMode'), operationsAutoPost: t('operations.autoPost'), authEmail: t('auth.email'), operationsPhone: t('operations.phone'), operationsTaxIdentifier: t('operations.taxIdentifier'), operationsNotes: t('operations.notes'), tagsGuideCreateHint: t('tagsGuide.createHint'), tagsGuideNamePlaceholder: t('tagsGuide.namePlaceholder'), recordPagesColor: t('recordPages.color') }))
const operationalCreationOptions = computed(() => ({ incomeCategories: operations.incomeCategories.map(row => ({ id: row.id, name: row.name })), expenseCategories: operations.expenseCategories.map(row => ({ id: row.id, name: row.name })), counterparties: operations.counterparties.map(row => ({ id: row.id, name: row.name })), paymentAccounts: operations.paymentAccounts.map(row => ({ id: row.id, name: row.name })), liabilityAccounts: operations.liabilityAccounts.map(row => ({ id: row.id, name: row.name })) }))
const journalCreation = reactive(useLedgerAddTransactionDialogView())
const journalCreationForm = computed({ get: () => ({ ...journalCreation.form, lines: journalCreation.form.lines.map(line => ({ ...line, allocations: line.allocations.map(allocation => ({ ...allocation })) })) }), set: value => { Object.assign(journalCreation.form, value) } })
const journalCreationView = computed(() => ({ visible: journalCreation.open, title: t(`add.flows.${journalCreation.flow}`), dirty: journalCreation.overlayDirty0, pending: journalCreation.submitting, error: journalCreation.fieldError, flows: journalCreation.availableFlows.map(value => ({ value, label: `${t(`add.flows.${value}`)} — ${t(`add.hints.${value}`)}` })), usage: journalCreation.ledgerUsage.item('max_monthly_transactions') ?? undefined, showExchangeRate: Boolean(journalCreation.canMultiCurrency) && journalCreation.effectiveCurrency !== baseCurrency.value, foreignCurrency: journalCreation.effectiveCurrency !== baseCurrency.value, crossCurrency: Boolean(journalCreation.canMultiCurrency) && journalCreation.isCrossCurrencyTransfer, destinationForeign: journalCreation.destinationCurrency !== baseCurrency.value, canAllocate: can('dimensions.allocate') && Boolean(journalCreation.dimensionWorkspace?.values.some(value => value.status === 'active')), dimensions: (journalCreation.dimensionWorkspace?.values ?? []).filter(value => value.status === 'active').map(value => ({ id: value.id, name: `${value.code} · ${value.name}`, kind: value.kind })), lineRemoveLabels: journalCreation.form.lines.map((_, index) => t('add.removeLine', { index: index + 1 })), debitTotal: formatMoney(journalCreation.adjustmentTotals.debit, baseCurrency.value, locale.value), creditTotal: formatMoney(journalCreation.adjustmentTotals.credit, baseCurrency.value, locale.value), balanced: journalCreation.adjustmentTotals.balanced }))
const journalCreationCopy = computed(() => ({ commonCancel: t('common.cancel'), addWhatAreYouRecording: t('add.whatAreYouRecording'), addDate: t('add.date'), addMultiCurrencyUpgrade: t('add.multiCurrencyUpgrade'), addReceivedInto: t('add.receivedInto'), addChooseAccount: t('add.chooseAccount'), addCategory: t('add.category'), addChooseCategory: t('add.chooseCategory'), addPaidFrom: t('add.paidFrom'), addFrom: t('add.from'), addTo: t('add.to'), addTransferFee: t('add.transferFee'), commonOptional: t('common.optional'), addTransferFeeHint: t('add.transferFeeHint'), addAssetAccount: t('add.assetAccount'), addUsefulLife: t('add.usefulLife'), addUsefulLifeHint: t('add.usefulLifeHint'), addLiabilityAccount: t('add.liabilityAccount'), addDueDate: t('add.dueDate'), addLiability: t('add.liability'), addPrincipal: t('add.principal'), addInterest: t('add.interest'), addFees: t('add.fees'), addLiabilityPaymentHint: t('add.liabilityPaymentHint'), addEquityAccount: t('add.equityAccount'), addOwnerCapitalDefault: t('add.ownerCapitalDefault'), addTakenFrom: t('add.takenFrom'), addDrawingsAccount: t('add.drawingsAccount'), addOwnerDrawingsDefault: t('add.ownerDrawingsDefault'), addCounterparty: t('add.counterparty'), commonNone: t('common.none'), addDescription: t('add.description'), addDescriptionPlaceholder: t('add.descriptionPlaceholder'), addReference: t('add.reference'), addReferencePlaceholder: t('add.referencePlaceholder'), addAdjustmentReason: t('add.adjustmentReason'), addAdjustmentReasonPlaceholder: t('add.adjustmentReasonPlaceholder'), addJournalLines: t('add.journalLines'), addAddLine: t('add.addLine'), detailAccount: t('detail.account'), addSide: t('add.side'), addDebit: t('add.debit'), addCredit: t('add.credit'), transactionsAmount: t('transactions.amount'), dimensionsAllocationAmount: t('dimensions.allocationAmount'), dimensionsRemoveAllocation: t('dimensions.removeAllocation'), addDebitsTotal: t('add.debitsTotal'), addCreditsTotal: t('add.creditsTotal'), addBalanced: t('add.balanced'), addNotBalanced: t('add.notBalanced'), commonSave: t('common.save'), amount: t('add.amount', { currency: journalCreation.effectiveCurrency }), exchangeRate: t('add.exchangeRate', { currency: journalCreation.effectiveCurrency, base: baseCurrency.value }), destinationAmount: t('add.destinationAmount', { currency: journalCreation.destinationCurrency }), destinationExchangeRate: t('add.exchangeRate', { currency: journalCreation.destinationCurrency, base: baseCurrency.value }), allocateCostCenter: t('dimensions.allocateKind', { kind: t('dimensions.kinds.cost_center') }), allocateProject: t('dimensions.allocateKind', { kind: t('dimensions.kinds.project') }), dimensionKinds: { cost_center: t('dimensions.kinds.cost_center'), project: t('dimensions.kinds.project') } }))
const journalCreationOptions = computed(() => ({ paymentAccounts: journalCreation.paymentAccounts.map(row => ({ id: row.id, name: journalCreation.accountLabel(row) })), assetAccounts: journalCreation.assetAccounts.map(row => ({ id: row.id, name: journalCreation.accountLabel(row) })), liabilityAccounts: journalCreation.liabilityAccounts.map(row => ({ id: row.id, name: journalCreation.accountLabel(row) })), equityAccounts: journalCreation.equityAccounts.map(row => ({ id: row.id, name: journalCreation.accountLabel(row) })), postableAccounts: journalCreation.postableAccounts.map(row => ({ id: row.id, name: journalCreation.accountLabel(row) })), incomeCategories: journalCreation.incomeCategories.map(row => ({ id: row.id, name: journalCreation.accountLabel(row) })), expenseCategories: journalCreation.expenseCategories.map(row => ({ id: row.id, name: journalCreation.accountLabel(row) })), counterparties: journalCreation.counterparties.map(row => ({ id: row.id, name: journalCreation.accountLabel(row) })) }))
</script>

<template>
 <BsWorkspaceShell
  v-model:workspace-creation-form="workspaceCreationForm" v-model:onboarding-form="workspaceSetupForm" v-model:journal-form="journalCreationForm" v-model:commitment="commitmentDraft" v-model:recurring="recurringDraft" v-model:counterparty="counterpartyDraft" v-model:tag="tagDraft" v-model:invitation-form="teamInvitationForm"
  :ready="showShell" :loading-label="t('app.loading')" :product-name="t('app.name')" :floating-actions="!!current" body-layout="page" feedback
  :groups="NAV_GROUPS.map(group => ({ ...group, label: t(`nav.groups.${group.key}`), links: group.links.map(item => ({ ...item, label: t(item.label) })) }))"
  :mobile-links="PRIMARY_NAV.map(item => ({ ...item, label: t(`nav.${item.key}`) }))"
  :labels="{ close: t('nav.close'), open: t('nav.open'), navigation: t('nav.primary'), dashboard: t('nav.dashboard') }"
  :logo="{ kind: 'product', assetPrefix: '/brand/ledger-suit' }"
  :account="{ name: fullName, email: user?.email, label: t('common.accountMenu'), signOut: t('common.signOut'), pending: signingOut, error: signOutError, actions: userMenuActions }"
  :workspace="{ value: workspaceSwitcher.current?.id ?? null, label: t('org.switcher'), placeholder: t('org.none'), options: workspaceSwitcher.contextOptions, createLabel: !workspaceSwitcher.ownsOrganization ? t('org.createAnother') : undefined }"
  :workspace-creation="workspaceCreationView"
  :trial="remainingTrialMilliseconds !== null ? { to: '/billing', label: t('billing.trialCountdown', trialParts), compactLabel: t('billing.trialCountdownCompact', trialParts) } : undefined"
  :notifications="{ items: notificationItems, label: t('notifications.title'), emptyLabel: t('notifications.empty'), markAllLabel: t('notifications.markAll') }"
  :state="{ loading, error: false, title: t('app.loading'), retry: t('accounts.retry') }"
  :onboarding="!current ? { pending: workspaceSetup.pending, error: workspaceSetup.errorMessage, copy: workspaceSetupCopy, accounts: syntheticAccounts, revision: t('demo.revision', { revision: syntheticDemo.state.revision }) } : undefined"
  :read-only="readOnly && current ? { title: t('billing.readOnlyTitle'), description: t('billing.readOnlyBody'), actionLabel: can('billing.manage') ? t('billing.fixBilling') : undefined, actionTo: '/billing' } : undefined"
  :financial-map="current ? { copy: financialMapCopy, flows: financialMapFlows, checks: financialMapChecks, reports: financialMapReports } : undefined"
  :journal-creation="{ flow: journalCreation.flow, view: journalCreationView, copy: journalCreationCopy, options: journalCreationOptions }"
  :operational-creation="{ view: operationalCreationView, copy: operationalCreationCopy, options: operationalCreationOptions }"
  :invitation="can('members.invite') && route.path !== '/team' ? { state: teamInvitationState, copy: teamInvitationCopy, roles: teamInvitationRoles, usage: teamInvitation.ledgerUsage.item('max_members') ?? undefined } : undefined"
  @sign-out="signOut" @workspace="workspaceSwitcher.choose" @create-workspace="workspaceSwitcher.showCreate" @close-workspace-creation="workspaceSwitcher.closeCreate" @submit-workspace-creation="workspaceSwitcher.createAndStartTrial"
  @notification="markNotificationRead" @mark-all-notifications="markAllNotificationsRead" @create-organization="workspaceSetup.createOrganization" @accept-invitation="workspaceSetup.acceptInvitation" @demo-receipt="syntheticDemo.addReceipt" @demo-reset="syntheticDemo.reset"
  @journal-flow="journalCreation.flow = $event" @close-journal="journalCreation.close" @save-journal="journalCreation.submit" @close-operation="operations.close" @save-operation="operations.submitCurrent" @close-invitation="teamInvitation.close" @submit-invitation="teamInvitation.invite"
 ><slot/></BsWorkspaceShell>
</template>
