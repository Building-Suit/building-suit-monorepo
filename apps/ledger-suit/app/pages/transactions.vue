<script setup lang="ts">
import { formatPresentationMoney } from '@building-suit/ui/utils/presentation'
import type { BsJournalWorkspaceChoices, BsJournalWorkspaceCopy, BsJournalWorkspaceFilters, BsJournalWorkspaceView } from '@building-suit/ui/types/journalWorkspacePresentation'
definePageMeta({ layout: 'default' })
const { can } = useTenant()
const { writesAllowed } = useBilling()
const { start } = useAddTransaction()
const { t, locale } = useI18n()
const route = useRoute()
const router = useRouter()
const { data: categories } = useOrgCategories()
const { data: accounts } = useOrgAccounts()
const { data: tags, error: tagsError, refresh: refreshTags } = useOrgTags()
const { filters, sort, page, pageSize, scope, rows, total, pageCount, pending, error, validation, refresh, activeFilterCount, clearFilters, toggleSort, snapshot, applySnapshot } = useTransactionWorkspace()
const { views: savedViews, pending: savedViewsPending, error: savedViewsError, save: saveView, remove: removeView } = useJournalSavedViews()
const { density: tableDensity, hydrated: tablePreferenceHydrated } = useAccountingTablePreferences('journal-center')
const toasts = useToasts()
const describeError = useErrorMessage()
const importOpen = ref(false)
const filtersOpen = ref(false)
const selectedId = ref<string | null>(null)
const hydrated = ref(false)
const savedViewId = ref('')
const savedViewName = ref('')
const savingView = ref(false)
onMounted(() => { hydrated.value = true; void openCreateFromRoute(); void openImportFromRoute() })
watch(scope, () => { importOpen.value = false; selectedId.value = null; filtersOpen.value = false; savedViewId.value = ''; savedViewName.value = '' }, { flush: 'sync' })
const availableFlows = computed(() => ADD_FLOWS.filter(flow => can(FLOW_CAPABILITY[flow])))
const canCreate = computed(() => writesAllowed.value && availableFlows.value.length > 0)
const rangeStart = computed(() => total.value ? (page.value - 1) * pageSize + 1 : 0)
const rangeEnd = computed(() => Math.min(page.value * pageSize, total.value))
const QUICK_TYPES = ['', 'income', 'expense', 'transfer', 'adjustment'] as const
function addTransaction() {
  const flow = availableFlows.value.find(flow => flow === filters.type) ?? (availableFlows.value.includes('expense') ? 'expense' : availableFlows.value[0])
  if (canCreate.value && flow) start(flow)
}
async function openCreateFromRoute() {
  if (!hydrated.value || route.query.create !== '1') return
  if (canCreate.value) addTransaction()
  const query = { ...route.query }; delete query.create
  await router.replace({ query })
}
watch(() => route.query.create, () => void openCreateFromRoute())
async function openImportFromRoute() {
  if (!hydrated.value || route.query.import !== '1') return
  importOpen.value = true
  const query = { ...route.query }; delete query.import
  await router.replace({ query })
}
watch(() => route.query.import, () => void openImportFromRoute())
function ariaSort(column: string): 'none' | 'ascending' | 'descending' { return sort.column === column ? sort.direction === 'asc' ? 'ascending' : 'descending' : 'none' }
function applySavedView() {
  const view = savedViews.value.find(item => item.id === savedViewId.value)
  if (view) applySnapshot(view)
}
watch(savedViewId, applySavedView)
async function createSavedView() {
  if (!savedViewName.value.trim()) return
  savingView.value = true
  try {
    await saveView(savedViewName.value, snapshot())
    savedViewName.value = ''
    toasts.success(t('journalCenter.viewSavedTitle'), t('journalCenter.viewSavedBody'))
  }
  catch (failure) { toasts.error(t('journalCenter.viewError'), describeError(failure)) }
  finally { savingView.value = false }
}
async function deleteSavedView() {
  if (!savedViewId.value) return
  savingView.value = true
  try { await removeView(savedViewId.value); savedViewId.value = '' }
  catch (failure) { toasts.error(t('journalCenter.viewError'), describeError(failure)) }
  finally { savingView.value = false }
}
useHead({ title: () => `${t('transactions.title')} · ${t('app.name')}` })
const ledgerPresentation = useLedgerPresentation()

const journalPresentation = useLedgerJournalDetailPresentation(reactive({ get transactionId() { return selectedId.value } }), { close: () => { selectedId.value = null }, changed: refresh, navigate: id => { selectedId.value = id } })
const importPresentation = useLedgerJournalImportPresentation(reactive({ get visible() { return importOpen.value } }), () => { importOpen.value = false })
const journalForm = journalPresentation.form
const importForm = importPresentation.form
const extractionForm = importPresentation.extractionForm
const presentationFilters = computed<BsJournalWorkspaceFilters>({
  get: () => ({ search: filters.search, type: filters.type, status: filters.status, source: filters.source, from: filters.from, to: filters.to, account: filters.accountId, tag: filters.tagId, category: filters.categoryId, min: filters.minAmount, max: filters.maxAmount, savedView: savedViewId.value, savedName: savedViewName.value, density: tableDensity.value, expanded: filtersOpen.value }),
  set: value => { Object.assign(filters, { search: value.search, type: value.type as typeof filters.type, status: value.status as typeof filters.status, source: value.source as typeof filters.source, from: value.from, to: value.to, accountId: value.account, tagId: value.tag, categoryId: value.category, minAmount: value.min, maxAmount: value.max }); savedViewId.value = value.savedView; savedViewName.value = value.savedName; tableDensity.value = value.density; filtersOpen.value = value.expanded },
})
const presentationCopy = computed<BsJournalWorkspaceCopy>(() => ({
  title: t('transactions.title'), subtitle: t('transactionWorkspace.subtitle'), context: t('pageContext.label'), import: t('imports.entryPoint'), create: t('transactionWorkspace.new'), type: t('transactions.type'), status: t('transactions.status'), source: t('journalCenter.source'), search: t('transactions.searchLabel'), searchPlaceholder: t('transactions.searchPlaceholder'), from: t('transactions.fromDate'), to: t('transactions.toDate'), account: t('transactions.account'), tag: t('tagsGuide.filter'), category: t('transactions.category'), min: t('transactions.minAmount'), max: t('transactions.maxAmount'), moreFilters: t('transactionWorkspace.moreFilters'), clearFilters: t('transactionWorkspace.clearFilters', { count: activeFilterCount.value }), count: t('transactions.count', total.value), savedViews: t('journalCenter.savedViews'), viewName: t('journalCenter.viewName'), saveView: t('journalCenter.saveView'), removeView: t('journalCenter.removeView'), savedError: t('journalCenter.savedViewsError'), tagError: t('tagsGuide.loadError'), retry: t('accounts.retry'), denied: t('transactionWorkspace.noRead'), failed: t('transactionWorkspace.loadError'), retryHint: t('transactionWorkspace.retryHint'), empty: t('transactions.emptyTitle'), emptyHint: t('transactions.emptyHint'), noMatch: t('transactions.noMatchTitle'), noMatchHint: t('transactions.noMatchHint'), noMatchAction: t('transactions.noMatchAction'), scroll: t('accountingTable.journalScroll'), density: t('accountingTable.density'), compact: t('accountingTable.compact'), comfortable: t('accountingTable.comfortable'), reference: t('journalCenter.journalReference'), date: t('journalCenter.accountingDate'), description: t('transactions.description'), debit: t('detail.debit'), credit: t('detail.credit'), previous: t('common.previous'), next: t('common.next'),
}))
const presentationChoices = computed<BsJournalWorkspaceChoices>(() => ({
  quickTypes: QUICK_TYPES.map(value => ({ value, label: value ? t(`types.${value}`) : t('transactionWorkspace.all') })), types: [{ value: '', label: t('transactionWorkspace.allTypes') }, ...TRANSACTION_TYPES.map(value => ({ value, label: t(`types.${value}`) }))], statuses: [{ value: '', label: t('transactionWorkspace.allStatuses') }, ...TRANSACTION_STATUSES.map(value => ({ value, label: t(`status.${value}`) }))], sources: [{ value: '', label: t('journalCenter.allSources') }, ...TRANSACTION_SOURCES.map(value => ({ value, label: t(`journalSources.${value}`) }))], accounts: [{ value: '', label: t('transactionWorkspace.allAccounts') }, ...accounts.value.map(account => ({ value: account.id, label: account.name }))], tags: [{ value: '', label: t('tagsGuide.all') }, ...(filters.tagId && !tags.value.some(tag => tag.id === filters.tagId) ? [{ value: filters.tagId, label: t('tagsGuide.selectedUnavailable') }] : []), ...tags.value.map(tag => ({ value: tag.id, label: tag.name }))], categories: [{ value: '', label: t('common.any') }, ...categories.value.map(category => ({ value: category.id, label: category.name }))], savedViews: [{ value: '', label: t('journalCenter.chooseView') }, ...savedViews.value.map(view => ({ value: view.id, label: view.name }))],
}))
const presentationView = computed<BsJournalWorkspaceView>(() => ({
  context: ledgerPresentation.context(filters.from, filters.to, undefined), canImport: can('imports.create') && writesAllowed.value, canCreate: canCreate.value, canRead: can('transactions.read'), canReadTags: can('tags.read'), ready: hydrated.value, preferenceReady: tablePreferenceHydrated.value, tagsFailed: !!tagsError.value, savedPending: savedViewsPending.value, saving: savingView.value, savedFailed: !!savedViewsError.value, hasFilters: !!activeFilterCount.value, loading: pending.value, failed: !!error.value, validation: validation.value ? t(`transactionWorkspace.validation.${validation.value}`) : '', empty: rows.value.length === 0 && !activeFilterCount.value && !filters.search, noMatch: rows.value.length === 0,
  rows: rows.value.map(row => ({ id: row.id, reference: row.journal_reference, date: formatDate(row.transaction_date, locale.value), description: row.description || t('common.dash'), source: t(`journalSources.${row.source}`), type: t(`types.${row.type}`), status: row.status, debit: formatPresentationMoney(row.debit_minor, { currency: ledgerPresentation.currency(row.currency_code), locale: locale.value, unit: 'minor', numberingSystem: 'latn' }), credit: formatPresentationMoney(row.credit_minor, { currency: ledgerPresentation.currency(row.currency_code), locale: locale.value, unit: 'minor', numberingSystem: 'latn' }), tags: row.tags ?? [] })), showing: t('transactions.showing', { from: rangeStart.value, to: rangeEnd.value, total: total.value }), pageLabel: t('transactions.page', { page: page.value, pages: pageCount.value }), previousDisabled: page.value <= 1, nextDisabled: page.value >= pageCount.value, sorts: ['journal_reference', 'transaction_date', 'source', 'type', 'status', 'debit', 'credit'].map(key => ({ key, direction: ariaSort(key) })), journal: { copy: journalPresentation.copy.value, view: journalPresentation.view.value }, import: { copy: importPresentation.copy.value, view: importPresentation.view.value },
}))
function changePage(direction: number) { page.value = Math.max(1, Math.min(pageCount.value, page.value + direction)) }
</script>
<template>
  <BsJournalWorkspacePage v-model:filters="presentationFilters" v-model:journal="journalForm" v-model:import-form="importForm" v-model:extraction="extractionForm" :copy="presentationCopy" :view="presentationView" :choices="presentationChoices" @create="addTransaction" @open-import="importOpen = true" @clear-filters="clearFilters" @retry="refresh" @retry-tags="refreshTags" @save-view="createSavedView" @remove-view="deleteSavedView" @sort="toggleSort" @page="changePage" @open-journal="selectedId = $event" @close-journal="selectedId = null" @retry-journal="journalPresentation.retry" @retry-journal-tags="journalPresentation.retryTags" @assign-tag="journalPresentation.assignTag" @remove-tag="journalPresentation.removeTag" @upload="journalPresentation.upload" @download="journalPresentation.download" @delete-attachment="journalPresentation.deleteAttachment" @reverse="journalPresentation.reverse" @close-import="importOpen = false" @import-file="importPresentation.file" @import-template="importPresentation.template" @import-paste="importPresentation.paste" @import-validate="importPresentation.validate" @import-reset="importPresentation.reset" @import-confirm="importPresentation.confirm" @import-page="importPresentation.page" @extraction-document="importPresentation.document" @extraction-proposal="importPresentation.proposal" @extraction-reject="importPresentation.reject" @extraction-accept="importPresentation.accept"/>
</template>
