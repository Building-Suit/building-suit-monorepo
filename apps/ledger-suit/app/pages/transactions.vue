<script setup lang="ts">
import { resolveTemplateElement } from '~/utils/templateElement'
import { useLedgerCsvImportDialogView } from '~/composables/useLedgerCsvImportDialogView'
import { useLedgerDocumentExtractionReviewView } from '~/composables/useLedgerDocumentExtractionReviewView'
import { useLedgerTransactionDetailDialogView } from '~/composables/useLedgerTransactionDetailDialogView'
import { useLedgerTransactionTagsView } from '~/composables/useLedgerTransactionTagsView'
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
</script>

<template>
  <BsStack gap="md">
    <BsPageHeader
      :title="t('transactions.title')"
      :subtitle="t('transactionWorkspace.subtitle')"
      :context="ledgerPresentation.context(filters.from, filters.to, undefined)"
      :context-label="ledgerPresentation.t('pageContext.label')"
    >
      <template #actions>
        <BsButton v-if="can('imports.create') && writesAllowed" type="button" :disabled="!hydrated" @click="importOpen = true">{{ t('imports.entryPoint') }}</BsButton>
        <BsButton v-if="canCreate" type="button" :disabled="!hydrated" variant="primary" @click="addTransaction"><BsIcon name="add" :size="18" />{{ t('transactionWorkspace.new') }}</BsButton>
      </template>
    </BsPageHeader>
    <BsCard v-if="can('transactions.read')" as="div" padding="md">
      <BsStack gap="md">
        <BsInline role="group" :aria-label="t('transactions.type')" gap="sm" :wrap="true">
          <BsButton
            v-for="type in QUICK_TYPES"
            :key="type"
            variant="chip"
            type="button"
            :aria-pressed="filters.type === type"
            :disabled="!hydrated"
            @click="filters.type = type"
          >{{ type ? t(`types.${type}`) : t('transactionWorkspace.all') }}</BsButton>
        </BsInline>
        <BsGrid :columns="4" gap="md">
          <BsFloatingField :label="t('transactions.searchLabel')">
            <BsInput id="search" v-model="filters.search" type="search" :placeholder="t('transactions.searchPlaceholder')" :disabled="!hydrated" />
          </BsFloatingField>
          <BsFloatingField :label="t('transactions.type')">
            <BsSelect id="type" v-model="filters.type" :disabled="!hydrated" native>
              <BsSelectOption value="">{{ t('transactionWorkspace.allTypes') }}</BsSelectOption>
              <BsSelectOption v-for="type in TRANSACTION_TYPES" :key="type" :value="type">{{ t(`types.${type}`) }}</BsSelectOption>
            </BsSelect>
          </BsFloatingField>
          <BsFloatingField :label="t('transactions.status')">
            <BsSelect id="status" v-model="filters.status" :disabled="!hydrated" native>
              <BsSelectOption value="">{{ t('transactionWorkspace.allStatuses') }}</BsSelectOption>
              <BsSelectOption v-for="status in TRANSACTION_STATUSES" :key="status" :value="status">{{ t(`status.${status}`) }}</BsSelectOption>
            </BsSelect>
          </BsFloatingField>
          <BsFloatingField :label="t('journalCenter.source')">
            <BsSelect id="source" v-model="filters.source" :disabled="!hydrated" native>
              <BsSelectOption value="">{{ t('journalCenter.allSources') }}</BsSelectOption>
              <BsSelectOption v-for="source in TRANSACTION_SOURCES" :key="source" :value="source">{{ t(`journalSources.${source}`) }}</BsSelectOption>
            </BsSelect>
          </BsFloatingField>
          <BsFloatingField :label="t('transactions.fromDate')">
            <BsInput id="from" v-model="filters.from" type="date" :disabled="!hydrated" />
          </BsFloatingField>
          <BsFloatingField :label="t('transactions.toDate')">
            <BsInput id="to" v-model="filters.to" type="date" :min="filters.from" :disabled="!hydrated" />
          </BsFloatingField>
          <BsFloatingField :label="t('transactions.account')">
            <BsSelect id="account" v-model="filters.accountId" :disabled="!hydrated" native>
              <BsSelectOption value="">{{ t('transactionWorkspace.allAccounts') }}</BsSelectOption>
              <BsSelectOption v-for="account in accounts" :key="account.id" :value="account.id">{{ account.name }}</BsSelectOption>
            </BsSelect>
          </BsFloatingField>
          <BsBox v-if="can('tags.read')">
            <BsFloatingField :label="t('tagsGuide.filter')">
              <BsSelect id="tag" v-model="filters.tagId" :disabled="!hydrated || !!tagsError" native>
                <BsSelectOption value="">{{ t('tagsGuide.all') }}</BsSelectOption>
                <BsSelectOption v-if="filters.tagId && !tags.some(tag => tag.id === filters.tagId)" :value="filters.tagId">{{ t('tagsGuide.selectedUnavailable') }}</BsSelectOption>
                <BsSelectOption v-for="tag in tags" :key="tag.id" :value="tag.id">{{ tag.name }}</BsSelectOption>
              </BsSelect>
            </BsFloatingField>
            <BsText v-if="tagsError" role="alert" size="sm" tone="muted">{{ t('tagsGuide.loadError') }} <BsButton variant="link" type="button" @click="refreshTags()">{{ t('accounts.retry') }}</BsButton></BsText>
          </BsBox>
        </BsGrid>
        <BsInline gap="md" :wrap="true">
          <BsButton
            type="button"
            :aria-expanded="filtersOpen"
            aria-controls="transaction-more-filters"
            :disabled="!hydrated"
            size="sm"
            @click="filtersOpen = !filtersOpen"
          >{{ t('transactionWorkspace.moreFilters') }}<BsIcon name="arrowDown" :size="16" /></BsButton>
          <BsButton v-if="activeFilterCount" type="button" :disabled="!hydrated" size="sm" @click="clearFilters">{{ t('transactionWorkspace.clearFilters', { count: activeFilterCount }) }}</BsButton>
          <BsText v-if="!pending && !error && !validation" role="status" size="sm" tone="muted">{{ t('transactions.count', total) }}</BsText>
        </BsInline>
        <BsGrid v-if="filtersOpen" id="transaction-more-filters" :columns="3" gap="md">
          <BsFloatingField :label="t('transactions.category')">
            <BsSelect id="category" v-model="filters.categoryId" native>
              <BsSelectOption value="">{{ t('common.any') }}</BsSelectOption>
              <BsSelectOption v-for="category in categories" :key="category.id" :value="category.id">{{ category.name }}</BsSelectOption>
            </BsSelect>
          </BsFloatingField>
          <BsFloatingField :label="t('transactions.minAmount')">
            <BsInput id="min" v-model="filters.minAmount" inputmode="decimal" placeholder="0.00" />
          </BsFloatingField>
          <BsFloatingField :label="t('transactions.maxAmount')">
            <BsInput id="max" v-model="filters.maxAmount" inputmode="decimal" placeholder="0.00" />
          </BsFloatingField>
        </BsGrid>
        <BsGrid :columns="1" gap="md">
          <BsFloatingField :label="t('journalCenter.savedViews')">
            <BsSelect id="saved-view" v-model="savedViewId" :disabled="savedViewsPending || savingView" native>
              <BsSelectOption value="">{{ t('journalCenter.chooseView') }}</BsSelectOption>
              <BsSelectOption v-for="view in savedViews" :key="view.id" :value="view.id">{{ view.name }}</BsSelectOption>
            </BsSelect>
          </BsFloatingField>
          <BsFloatingField :label="t('journalCenter.viewName')">
            <BsInput id="saved-view-name" v-model="savedViewName" maxlength="120" :disabled="savingView" @keyup.enter="createSavedView" />
          </BsFloatingField>
          <BsButton type="button" :disabled="savingView || !savedViewName.trim()" size="sm" @click="createSavedView">{{ t('journalCenter.saveView') }}</BsButton>
          <BsButton type="button" :disabled="savingView || !savedViewId" size="sm" @click="deleteSavedView">{{ t('journalCenter.removeView') }}</BsButton>
          <BsText v-if="savedViewsError" role="alert" size="sm" tone="danger">{{ t('journalCenter.savedViewsError') }}</BsText>
        </BsGrid>
      </BsStack>
    </BsCard>
    <BsText v-if="!can('transactions.read')" role="status" tone="muted">{{ t('transactionWorkspace.noRead') }}</BsText>
    <BsText v-else-if="validation" role="alert" tone="danger">{{ t(`transactionWorkspace.validation.${validation}`) }}</BsText>
    <BsCard v-else-if="error" role="alert" as="div" padding="lg">
      <BsStack gap="md">
        <BsHeading :level="2" size="body">{{ t('transactionWorkspace.loadError') }}</BsHeading>
        <BsText size="sm" tone="muted">{{ t('transactionWorkspace.retryHint') }}</BsText>
        <BsButton type="button" @click="refresh()">{{ t('accounts.retry') }}</BsButton>
      </BsStack>
    </BsCard>
    <BsSectionSkeleton v-else-if="pending" variant="table" :rows="8" />
    <BsEmptyState
      v-else-if="rows.length === 0 && !activeFilterCount && !filters.search"
      :title="t('transactions.emptyTitle')"
      :description="t('transactions.emptyHint')"
      :action-label="canCreate ? t('transactionWorkspace.new') : undefined"
      @action="addTransaction"
    />
    <BsEmptyState
      v-else-if="rows.length === 0"
      :title="t('transactions.noMatchTitle')"
      :description="t('transactions.noMatchHint')"
      :action-label="t('transactions.noMatchAction')"
      @action="clearFilters"
    />
    <BsCard v-else as="div" padding="none" overflow="hidden">
      <BsInline gap="md" :wrap="true" justify="between">
        <BsTableDensity
          v-model="tableDensity"
          :disabled="!tablePreferenceHydrated"
          :label="ledgerPresentation.t('accountingTable.density')"
          :compact-label="ledgerPresentation.t('accountingTable.compact')"
          :comfortable-label="ledgerPresentation.t('accountingTable.comfortable')"
        />
        <BsText role="status" size="sm" tone="muted">{{ t('transactions.showing', { from: rangeStart, to: rangeEnd, total }) }}</BsText>
      </BsInline>
      <!-- Wide financial table on desktop -->
      <BsBox visibility="desktop">
        <BsDataTable
          :value="rows"
          row-key="id"
          :label="t('transactions.caption')"
          :density="tableDensity"
          sticky-header
          max-height="38rem"
          :scroll-label="t('accountingTable.journalScroll')"
          :columns="[{ key: 'column1', header: '', sticky: 'start' as const, ariaSort: ariaSort('journal_reference') }, { key: 'column2', header: '', ariaSort: ariaSort('transaction_date') }, { key: 'column3', header: (t('transactions.description')) }, { key: 'column4', header: '', ariaSort: ariaSort('source') }, { key: 'column5', header: '', ariaSort: ariaSort('status') }, { key: 'column6', header: '', sticky: 'end' as const, width: 'sm' as const, ariaSort: ariaSort('debit'), align: 'end' as const }, { key: 'column7', header: '', sticky: 'end' as const, width: 'sm' as const, ariaSort: ariaSort('credit'), align: 'end' as const }]"
          @row-click="event => selectedId = event.data.id"
        >
          <template #header-column1>
            <BsButton variant="link" type="button" @click="toggleSort('journal_reference')">{{ t('journalCenter.journalReference') }}</BsButton>
          </template>
          <template #cell-column1="{ row }">
            <BsButton variant="link" type="button" @click.stop="selectedId = row.id">{{ row.journal_reference }}</BsButton>
            <BsText :title="row.from_account_name || undefined" size="xs" tone="muted" truncate>{{ row.from_account_name || t('common.dash') }}</BsText>
            <BsText :title="row.to_account_name || undefined" size="xs" tone="muted" truncate><BsIcon name="arrowRight" :size="14" directional /> {{ row.to_account_name || t('common.dash') }}</BsText>
          </template>
          <template #header-column2>
            <BsButton variant="link" type="button" @click="toggleSort('transaction_date')">{{ t('transactions.date') }}</BsButton>
          </template>
          <template #cell-column2="{ row }">{{ formatDate(row.transaction_date, locale) }}</template>
          <template #header-column3>{{ t('transactions.description') }}</template>
          <template #cell-column3="{ row }">
            <BsButton variant="link" type="button" align="start" @click.stop="selectedId = row.id">{{ row.description || t('common.dash') }}</BsButton>
            <BsText v-if="row.reference || row.category_name || row.counterparty_name" as="span" size="xs" tone="muted" truncate>{{ [row.reference, row.category_name, row.counterparty_name].filter(Boolean).join(' · ') }}</BsText>
            <BsList v-if="row.tags?.length" :aria-label="t('operations.tabs.tags')" :ordered="false" marker="none">
              <BsListItem v-for="tag in row.tags" :key="tag">{{ tag }}</BsListItem>
            </BsList>
          </template>
          <template #header-column4>
            <BsButton variant="link" type="button" @click="toggleSort('source')">{{ t('journalCenter.source') }}</BsButton>
          </template>
          <template #cell-column4="{ row }">
            <BsText as="span">{{ t(`journalSources.${row.source}`) }}</BsText>
            <BsText as="span" size="xs" tone="muted">{{ t(`types.${row.type}`) }}</BsText>
          </template>
          <template #header-column5>
            <BsButton variant="link" type="button" @click="toggleSort('status')">{{ t('transactions.status') }}</BsButton>
          </template>
          <template #cell-column5="{ row }">
            <BsStatusBadge :status="row.status" />
          </template>
          <template #header-column6>
            <BsButton variant="link" type="button" @click="toggleSort('debit')">{{ t('detail.debit') }}</BsButton>
          </template>
          <template #cell-column6="{ row }">
            <BsMoneyText :amount="row.debit_minor" :currency="ledgerPresentation.currency(row.currency_code)" :locale="ledgerPresentation.locale" />
          </template>
          <template #header-column7>
            <BsButton variant="link" type="button" @click="toggleSort('credit')">{{ t('detail.credit') }}</BsButton>
          </template>
          <template #cell-column7="{ row }">
            <BsMoneyText :amount="row.credit_minor" :currency="ledgerPresentation.currency(row.currency_code)" :locale="ledgerPresentation.locale" />
          </template>
        </BsDataTable>
      </BsBox>
      <!-- Compact rows on small screens: a wide table is unusable on a phone -->
      <BsList :ordered="false" marker="none">
        <BsListItem v-for="row in rows" :key="row.id">
          <BsButton type="button" block align="start" @click="selectedId = row.id">
            <BsInline gap="md" :wrap="false" align="start" justify="between">
              <BsBox>
                <BsText size="xs" tone="link" emphasis="semibold" truncate>{{ row.journal_reference }}</BsText>
                <BsText size="sm" emphasis="semibold" truncate>{{ row.description || t('common.dash') }}</BsText>
                <BsText size="xs" tone="muted">{{ formatDate(row.transaction_date, locale) }} · {{ t(`journalSources.${row.source}`) }} · {{ t(`types.${row.type}`) }}</BsText>
              </BsBox>
              <BsBox>
                <BsText>
                  <BsText as="span" size="xs" tone="muted">{{ t('detail.debit') }}</BsText>
                  <BsMoneyText :amount="row.debit_minor" :currency="ledgerPresentation.currency(row.currency_code)" :locale="ledgerPresentation.locale" />
                </BsText>
                <BsText>
                  <BsText as="span" size="xs" tone="muted">{{ t('detail.credit') }}</BsText>
                  <BsMoneyText :amount="row.credit_minor" :currency="ledgerPresentation.currency(row.currency_code)" :locale="ledgerPresentation.locale" />
                </BsText>
                <BsStatusBadge :status="row.status" />
              </BsBox>
            </BsInline>
            <BsInline v-if="row.tags?.length" as="span" gap="xs" :wrap="true">
              <BsText v-for="tag in row.tags" :key="tag" as="span" size="xs">{{ tag }}</BsText>
            </BsInline>
          </BsButton>
        </BsListItem>
      </BsList>
      <BsInline gap="md" :wrap="true" justify="between">
        <BsText size="sm" tone="muted">{{ t('transactions.showing', { from: rangeStart, to: rangeEnd, total }) }}</BsText>
        <BsInline gap="sm" :wrap="false">
          <BsButton type="button" :disabled="page <= 1" size="sm" @click="page--">{{ t('common.previous') }}</BsButton>
          <BsText as="span" size="sm" tone="muted">{{ t('transactions.page', { page, pages: pageCount }) }}</BsText>
          <BsButton type="button" :disabled="page >= pageCount" size="sm" @click="page++">{{ t('common.next') }}</BsButton>
        </BsInline>
      </BsInline>
    </BsCard>
    <BsWorkflowScope :factory="useLedgerCsvImportDialogView" :input="{ visible: importOpen }" @update:visible="(value: boolean) => importOpen = value">
      <template #default="{ state: ledgerView21 }">
        <BsDialog
          v-model:visible="ledgerView21.visible"
          :title="ledgerView21.t('imports.title')"
          size="lg"
          :dirty="ledgerView21.phase !== 'results' && ledgerView21.dirty"
          :pending="!!ledgerView21.busy"
        >
          <template #default="{ close }">
            <BsStack gap="md">
              <BsText size="sm" tone="muted">{{ ledgerView21.t('imports.subtitle') }}</BsText>
              <BsSectionSkeleton v-if="ledgerView21.featurePending" variant="cards" />
              <BsCard v-else-if="!ledgerView21.can('imports.create') || !ledgerView21.writesAllowed" as="div" padding="lg">
                <BsHeading :level="2" size="body">{{ ledgerView21.t('imports.noPermissionTitle') }}</BsHeading>
                <BsText size="sm" tone="muted">{{ ledgerView21.t('imports.noPermissionBody') }}</BsText>
              </BsCard>
              <BsCard v-else-if="!ledgerView21.importsEnabled" as="div" padding="lg">
                <BsHeading :level="2" size="body">{{ ledgerView21.t('imports.upgradeTitle') }}</BsHeading>
                <BsText size="sm" tone="muted">{{ ledgerView21.t('imports.upgradeBody') }}</BsText>
                <BsLink v-if="ledgerView21.can('billing.manage')" to="/billing">{{ ledgerView21.t('imports.viewPlans') }}</BsLink>
              </BsCard>
              <template v-else>
                <BsList :aria-label="ledgerView21.t('imports.progress')" :ordered="true" marker="none">
                  <BsListItem v-for="(step, index) in ledgerView21.steps" :key="step.key"><BsText as="span" emphasis="semibold">{{ index + 1 }}</BsText> · {{ ledgerView21.t(`imports.steps.${step.key}`) }}</BsListItem>
                </BsList>
                <BsText v-if="ledgerView21.errorMessage" role="alert" tone="danger">{{ ledgerView21.errorMessage }}</BsText>
                <BsCard v-if="ledgerView21.phase === 'upload'" as="section" padding="lg">
                  <BsHeading :level="2" size="h2">{{ ledgerView21.t('imports.uploadTitle') }}</BsHeading>
                  <BsText size="sm" tone="muted">{{ ledgerView21.t('imports.uploadHint') }}</BsText>
                  <BsFieldLabel for="csv-file">{{ ledgerView21.t('imports.chooseFile') }}</BsFieldLabel>
                  <BsButton type="button" @click="ledgerView21.downloadTemplate">{{ ledgerView21.t('csv.downloadTemplate') }}</BsButton>
                  <BsText size="sm" tone="muted">{{ ledgerView21.t('csv.templateHint') }}</BsText>
                  <BsText size="sm" tone="muted">{{ ledgerView21.t('csv.languageHint') }}</BsText>
                  <BsFileInput id="csv-file" accept=".csv,text/csv" bare @change="ledgerView21.onFileSelected"  hide-control />
                  <BsText size="xs" tone="muted">{{ ledgerView21.t('imports.formatHint') }}</BsText>
                  <BsInline aria-hidden="true" gap="md" :wrap="false">
                    <BsText as="span" />
                    <BsText as="span" size="xs" tone="muted" emphasis="semibold">{{ ledgerView21.t('imports.or') }}</BsText>
                    <BsText as="span" />
                  </BsInline>
                  <BsFieldLabel for="spreadsheet-paste">{{ ledgerView21.t('imports.pasteTitle') }}</BsFieldLabel>
                  <BsText id="spreadsheet-paste-hint" size="sm" tone="muted">{{ ledgerView21.t('imports.pasteHint') }}</BsText>
                  <BsTextarea
                    id="spreadsheet-paste"
                    v-model="ledgerView21.pasteText"
                    :placeholder="ledgerView21.t('imports.pastePlaceholder')"
                    aria-describedby="spreadsheet-paste-hint"
                    @keydown="ledgerView21.onPasteKeydown"
                  />
                  <BsInline gap="none" :wrap="false" justify="end">
                    <BsButton type="button" :disabled="!ledgerView21.pasteText.trim()" variant="accent" @click="ledgerView21.usePastedRows">{{ ledgerView21.t('imports.reviewPaste') }}</BsButton>
                  </BsInline>
                </BsCard>
                <BsWorkflowScope
                  v-if="ledgerView21.phase === 'upload' && ledgerView21.can('attachments.create')"
                  :factory="useLedgerDocumentExtractionReviewView"
                  :input="{  }"
                  @accepted="ledgerView21.useExtractedRows"
                >
                  <template #default="{ state: ledgerView22 }">
                    <BsCard aria-labelledby="document-extraction-title" as="section" padding="lg">
                      <BsHeading id="document-extraction-title" :level="2" size="h2">{{ ledgerView22.t('imports.extraction.title') }}</BsHeading>
                      <BsText size="sm" tone="muted">{{ ledgerView22.t('imports.extraction.hint') }}</BsText>
                      <BsBox padding="lg" border radius="control">
                        <BsText emphasis="semibold">{{ ledgerView22.t('imports.extraction.providerBoundaryTitle') }}</BsText>
                        <BsText>{{ ledgerView22.t('imports.extraction.providerBoundaryBody') }}</BsText>
                      </BsBox>
                      <BsText v-if="ledgerView22.errorCode" role="alert" tone="danger">{{ ledgerView22.readableError(ledgerView22.errorCode) }}</BsText>
                      <BsText v-if="ledgerView22.proposal?.source && ledgerView22.sourceFile && !ledgerView22.sourceMatches" role="alert" tone="danger">{{ ledgerView22.t('imports.extraction.sourceMismatch') }}</BsText>
                      <BsGrid :columns="2" gap="md">
                        <BsBox>
                          <BsFieldLabel for="document-source-file">{{ ledgerView22.t('imports.extraction.documentLabel') }}</BsFieldLabel>
                          <BsText size="xs" tone="muted">{{ ledgerView22.t('imports.extraction.documentHint') }}</BsText>
                          <BsFileInput
                            id="document-source-file"
                            :ref="el => { ledgerView22.documentInput = resolveTemplateElement(el) }"
                            accept="application/pdf,image/png,image/jpeg,image/webp"
                            bare
                            @change="ledgerView22.onDocumentSelected"
                          />
                          <BsText v-if="ledgerView22.sourceFile" size="xs" tone="muted">{{ ledgerView22.sourceFile.name }} · {{ ledgerView22.sourceFile.size.toLocaleString() }} {{ ledgerView22.t('imports.extraction.bytes') }}</BsText>
                        </BsBox>
                        <BsBox>
                          <BsFieldLabel for="document-proposal-file">{{ ledgerView22.t('imports.extraction.proposalLabel') }}</BsFieldLabel>
                          <BsText size="xs" tone="muted">{{ ledgerView22.t('imports.extraction.proposalHint') }}</BsText>
                          <BsFileInput
                            id="document-proposal-file"
                            :ref="el => { ledgerView22.proposalInput = resolveTemplateElement(el) }"
                            accept="application/json,.json"
                            bare
                            @change="ledgerView22.onProposalSelected"
                          />
                        </BsBox>
                      </BsGrid>
                      <BsStack v-if="ledgerView22.proposal" gap="md">
                        <BsBox
                          v-for="(candidate, candidateIndex) in ledgerView22.candidates"
                          :key="candidateIndex"
                          :aria-labelledby="`document-candidate-${candidateIndex}`"
                          as="article"
                          padding="lg"
                          border
                          radius="control"
                        >
                          <BsHeading :id="`document-candidate-${candidateIndex}`" :level="3" size="body">{{ ledgerView22.t('imports.extraction.candidate', { number: candidateIndex + 1 }) }}</BsHeading>
                          <BsList v-if="candidate.errors.length" :ordered="false" marker="none">
                            <BsListItem v-for="issue in candidate.errors" :key="`${issue.code}:${issue.message}`"><BsText as="strong">{{ issue.code }}</BsText> — {{ issue.message }}</BsListItem>
                          </BsList>
                          <BsText v-else size="xs" tone="muted">{{ ledgerView22.t('imports.extraction.noExtractionErrors') }}</BsText>
                          <BsGrid :columns="2" gap="md">
                            <BsBox v-for="field in ledgerView22.fields" :key="field">
                              <BsFloatingField :label="ledgerView22.t(`imports.fields.${field}`)">
                                <BsSelect v-if="field === 'type'" v-model="candidate.fields[field]!.value" native>
                                  <BsSelectOption value="">{{ ledgerView22.t('common.select') }}</BsSelectOption>
                                  <BsSelectOption value="income">{{ ledgerView22.t('types.income') }}</BsSelectOption>
                                  <BsSelectOption value="expense">{{ ledgerView22.t('types.expense') }}</BsSelectOption>
                                </BsSelect>
                                <BsInput v-else v-model="candidate.fields[field]!.value" type="text" />
                              </BsFloatingField>
                              <BsInline gap="md" :wrap="true">
                                <BsText as="span" :tone="candidate.fields[field]!.confidence !== null && candidate.fields[field]!.confidence! < 0.6 ? 'danger' : 'muted'">{{ ledgerView22.confidenceLabel(candidate.fields[field]!.confidence) }}</BsText>
                                <BsText v-if="candidate.fields[field]!.evidence" as="span" tone="muted">{{ ledgerView22.t('imports.extraction.evidence') }}: {{ candidate.fields[field]!.evidence }}</BsText>
                              </BsInline>
                            </BsBox>
                          </BsGrid>
                        </BsBox>
                        <BsFieldLabel>
                          <BsCheckbox v-model="ledgerView22.reviewed" bare />
                          <BsText as="span">{{ ledgerView22.t('imports.extraction.attestation') }}</BsText>
                        </BsFieldLabel>
                        <BsText v-if="!ledgerView22.requiredComplete" size="sm" tone="danger">{{ ledgerView22.t('imports.extraction.requiredIncomplete') }}</BsText>
                        <BsInline gap="sm" :wrap="true" justify="end">
                          <BsButton type="button" @click="ledgerView22.rejectProposal">{{ ledgerView22.t('imports.extraction.reject') }}</BsButton>
                          <BsButton type="button" :disabled="!ledgerView22.canAccept" variant="accent" @click="ledgerView22.acceptProposal">{{ ledgerView22.t('imports.extraction.accept') }}</BsButton>
                        </BsInline>
                      </BsStack>
                    </BsCard>
                  </template>
                </BsWorkflowScope>
                <BsText v-else-if="ledgerView21.phase === 'upload'" size="sm" tone="muted">{{ ledgerView21.t('imports.extraction.attachmentPermissionRequired') }}</BsText>
                <template v-else>
                  <BsCard v-if="ledgerView21.phase === 'mapping'" as="section" padding="lg">
                    <BsInline gap="md" :wrap="true" align="start" justify="between">
                      <BsBox>
                        <BsHeading :level="2" size="h2">{{ ledgerView21.t('imports.mappingTitle') }}</BsHeading>
                        <BsText size="sm" tone="muted">{{ ledgerView21.t('imports.fileSummary', { filename: ledgerView21.filename, count: ledgerView21.sourceRows.length }) }}</BsText>
                      </BsBox>
                      <BsButton type="button" :disabled="!!ledgerView21.busy" size="sm" @click="ledgerView21.reset">{{ ledgerView21.t('imports.changeFile') }}</BsButton>
                    </BsInline>
                    <BsGrid :columns="3" gap="md">
                      <BsFloatingField v-for="field in ledgerView21.ALL_FIELDS" :key="field" :label="ledgerView21.t(`imports.fields.${field}`)">
                        <BsSelect v-model="ledgerView21.mapping[field]" :aria-required="ledgerView21.isRequiredField(field)" :disabled="!!ledgerView21.busy" native>
                          <BsSelectOption value="">{{ ledgerView21.isRequiredField(field) ? ledgerView21.t('imports.selectColumn') : ledgerView21.t('common.none') }}</BsSelectOption>
                          <BsSelectOption
                            v-for="header in ledgerView21.headers"
                            :key="header"
                            :value="header"
                            :disabled="Object.values(ledgerView21.mapping).includes(header) && ledgerView21.mapping[field] !== header"
                          >{{ header }}</BsSelectOption>
                        </BsSelect>
                      </BsFloatingField>
                    </BsGrid>
                  </BsCard>
                  <BsCard v-if="ledgerView21.phase === 'mapping'" as="section" padding="none" overflow="hidden">
                    <BsBox padding="lg">
                      <BsHeading :level="2" size="body">{{ ledgerView21.t('imports.previewTitle') }}</BsHeading>
                    </BsBox>
                    <BsBox>
                      <BsDataTable :value="ledgerView21.previewRows" :columns="[...(ledgerView21.headers ?? []).map((header) => ({ key: header, field: header, header: header }))]">
                        <template v-for="header in ledgerView21.headers" :key="header" #[`cell-${header}`]="{ row }">{{ row[header] || ledgerView21.t('common.dash') }}</template>
                      </BsDataTable>
                    </BsBox>
                    <BsInline gap="none" :wrap="false" justify="end" padding="lg">
                      <BsButton type="button" :disabled="!ledgerView21.requiredMappingComplete || !!ledgerView21.busy" variant="accent" @click="ledgerView21.validateImport">{{ ledgerView21.busy === 'validating' ? ledgerView21.t('imports.validating') : ledgerView21.t('imports.validate') }}</BsButton>
                    </BsInline>
                  </BsCard>
                  <BsStack v-if="ledgerView21.batch && (ledgerView21.phase === 'validated' || ledgerView21.phase === 'results')" as="section" gap="md">
                    <BsCard as="div" padding="lg">
                      <BsInline gap="md" :wrap="true" align="start" justify="between">
                        <BsBox>
                          <BsHeading :level="2" size="h2">{{ ledgerView21.phase === 'results' ? ledgerView21.t('imports.resultsTitle') : ledgerView21.t('imports.validationTitle') }}</BsHeading>
                          <BsText size="sm" tone="muted">{{ ledgerView21.filename }}</BsText>
                        </BsBox>
                        <BsStatusBadge :status="ledgerView21.batch.status" />
                      </BsInline>
                      <BsDescriptionList :columns="3">
                        <BsBox v-for="metric in ledgerView21.METRICS" :key="metric" padding="md" surface="muted" radius="control">
                          <BsDescriptionTerm>{{ ledgerView21.t(`imports.metrics.${metric}`) }}</BsDescriptionTerm>
                          <BsDescriptionValue>{{ ledgerView21.batch[metric] }}</BsDescriptionValue>
                        </BsBox>
                      </BsDescriptionList>
                      <BsUsageMeter
                        v-if="(ledgerView21.phase === 'validated') && ledgerView21.ledgerUsage.item('max_monthly_transactions')"
                        compact
                        :item="ledgerView21.ledgerUsage.item('max_monthly_transactions')!"
                      />
                      <BsInline gap="sm" :wrap="true" justify="end">
                        <BsButton v-if="ledgerView21.phase === 'results'" type="button" @click="ledgerView21.reset">{{ ledgerView21.t('imports.importAnother') }}</BsButton>
                        <BsButton v-else type="button" :disabled="!!ledgerView21.busy" @click="ledgerView21.reset">{{ ledgerView21.t('imports.startOver') }}</BsButton>
                        <BsButton
                          v-if="ledgerView21.phase === 'validated' && ledgerView21.canConfirm"
                          type="button"
                          :disabled="!!ledgerView21.busy"
                          variant="accent"
                          @click="ledgerView21.confirmImport"
                        >{{ ledgerView21.busy === 'confirming' ? ledgerView21.t('imports.confirming') : ledgerView21.t('imports.confirm') }}</BsButton>
                      </BsInline>
                    </BsCard>
                    <BsCard as="div" padding="none" overflow="hidden">
                      <BsInline gap="md" :wrap="true" align="end" justify="between" padding="lg">
                        <BsFloatingField :label="ledgerView21.t('imports.reviewFilter')">
                          <BsSelect v-model="ledgerView21.reviewFilter" native>
                            <BsSelectOption value="all">{{ ledgerView21.t('imports.reviewFilters.all', { count: ledgerView21.reviewCounts.all }) }}</BsSelectOption>
                            <BsSelectOption value="ready">{{ ledgerView21.t('imports.reviewFilters.ready', { count: ledgerView21.reviewCounts.ready }) }}</BsSelectOption>
                            <BsSelectOption value="issues">{{ ledgerView21.t('imports.reviewFilters.issues', { count: ledgerView21.reviewCounts.issues }) }}</BsSelectOption>
                            <BsSelectOption value="duplicates">{{ ledgerView21.t('imports.reviewFilters.duplicates', { count: ledgerView21.reviewCounts.duplicates }) }}</BsSelectOption>
                          </BsSelect>
                        </BsFloatingField>
                        <BsText role="status" size="sm" tone="muted">{{ ledgerView21.t('imports.reviewRange', { from: ledgerView21.reviewRangeStart, to: ledgerView21.reviewRangeEnd, total: ledgerView21.filteredResultRows.length }) }}</BsText>
                      </BsInline>
                      <BsBox>
                        <BsDataTable
                          :value="ledgerView21.displayRows"
                          row-key="id"
                          :label="ledgerView21.t('imports.rowsCaption')"
                          :columns="[{ key: 'column1', header: (ledgerView21.t('imports.row')) }, { key: 'column2', header: (ledgerView21.t('transactions.status')) }, { key: 'column3', header: (ledgerView21.t('transactions.type')) }, { key: 'column4', header: (ledgerView21.t('transactions.date')) }, { key: 'column5', header: (ledgerView21.t('transactions.amount')) }, { key: 'column6', header: (ledgerView21.t('imports.issue')) }]"
                        >
                          <template #header-column1>{{ ledgerView21.t('imports.row') }}</template>
                          <template #cell-column1="{ row }">{{ row.rowNumber }}</template>
                          <template #header-column2>{{ ledgerView21.t('transactions.status') }}</template>
                          <template #cell-column2="{ row }">
                            <BsStatusBadge :status="row.status" />
                          </template>
                          <template #header-column3>{{ ledgerView21.t('transactions.type') }}</template>
                          <template #cell-column3="{ row }">{{ row.typeValue }}</template>
                          <template #header-column4>{{ ledgerView21.t('transactions.date') }}</template>
                          <template #cell-column4="{ row }">{{ row.dateValue }}</template>
                          <template #header-column5>{{ ledgerView21.t('transactions.amount') }}</template>
                          <template #cell-column5="{ row }">{{ row.amountValue }}</template>
                          <template #header-column6>{{ ledgerView21.t('imports.issue') }}</template>
                          <template #cell-column6="{ row }">{{ row.issue || ledgerView21.t('common.dash') }}</template>
                        </BsDataTable>
                      </BsBox>
                      <BsInline v-if="ledgerView21.reviewPageCount > 1" gap="sm" :wrap="false" justify="end" padding="md">
                        <BsButton type="button" :disabled="ledgerView21.reviewPage <= 1" size="sm" @click="ledgerView21.reviewPage--">{{ ledgerView21.t('common.previous') }}</BsButton>
                        <BsText as="span" size="sm" tone="muted">{{ ledgerView21.t('transactions.page', { page: ledgerView21.reviewPage, pages: ledgerView21.reviewPageCount }) }}</BsText>
                        <BsButton type="button" :disabled="ledgerView21.reviewPage >= ledgerView21.reviewPageCount" size="sm" @click="ledgerView21.reviewPage++">{{ ledgerView21.t('common.next') }}</BsButton>
                      </BsInline>
                    </BsCard>
                  </BsStack>
                </template>
              </template>
              <BsInline gap="none" :wrap="false" justify="end">
                <BsButton type="button" :disabled="!!ledgerView21.busy" @click="close">{{ ledgerView21.t('csv.close') }}</BsButton>
              </BsInline>
            </BsStack>
          </template>
        </BsDialog>
      </template>
    </BsWorkflowScope>
    <BsWorkflowScope
      :factory="useLedgerTransactionDetailDialogView"
      :input="{ transactionId: (selectedId) }"
      @close="selectedId = null"
      @changed="refresh()"
      @navigate="(id: string) => selectedId = id"
    >
      <template #default="{ state: ledgerView23 }">
        <BsDialog
          v-if="ledgerView23.transactionId"
          :visible="true"
          :title="ledgerView23.transaction?.description || ledgerView23.t('detail.title')"
          :aria-label="ledgerView23.transaction?.description || ledgerView23.t('detail.title')"
          :show-header="false"
          size="md"
          :dirty="ledgerView23.overlayDirty0"
          :pending="ledgerView23.reversing || ledgerView23.uploading || ledgerView23.tagPending"
          @update:visible="(value: boolean) => { if (!value) ledgerView23.emit('close') }"
        >
          <template #default="{ close: dismiss }">
            <BsStack gap="none" overflow="hidden">
              <BsInline as="header" gap="md" :wrap="false" align="start" justify="between">
                <BsBox>
                  <BsHeading id="transaction-detail-title" :level="2" size="body">{{ ledgerView23.transaction?.description || ledgerView23.t('detail.title') }}</BsHeading>
                  <BsText size="sm" tone="muted">
                    <BsStatusBadge v-if="ledgerView23.transaction?.status" :status="ledgerView23.transaction.status" />
                    <BsText v-if="ledgerView23.transaction?.type" as="span">{{ ledgerView23.t(`types.${ledgerView23.transaction.type}`) }}</BsText>
                    <BsText v-if="ledgerView23.transaction?.journal_reference" as="span" emphasis="semibold">{{ ledgerView23.transaction.journal_reference }}</BsText>
                  </BsText>
                </BsBox>
                <BsButton type="button" :aria-label="ledgerView23.t('common.close')" size="sm" @click="dismiss">
                  <BsIcon name="close" />
                </BsButton>
              </BsInline>
              <BsStack gap="lg" grow>
                <BsDescriptionList :columns="2">
                  <BsBox>
                    <BsDescriptionTerm>{{ ledgerView23.t('journalCenter.journalReference') }}</BsDescriptionTerm>
                    <BsDescriptionValue>{{ ledgerView23.transaction?.journal_reference || ledgerView23.t('common.dash') }}</BsDescriptionValue>
                  </BsBox>
                  <BsBox>
                    <BsDescriptionTerm>{{ ledgerView23.t('journalCenter.accountingDate') }}</BsDescriptionTerm>
                    <BsDescriptionValue>{{ formatDate(ledgerView23.transaction?.transaction_date, ledgerView23.locale) }}</BsDescriptionValue>
                  </BsBox>
                  <BsBox>
                    <BsDescriptionTerm>{{ ledgerView23.t('journalCenter.source') }}</BsDescriptionTerm>
                    <BsDescriptionValue>{{ ledgerView23.transaction?.source ? ledgerView23.t(`journalSources.${ledgerView23.transaction.source}`) : ledgerView23.t('common.dash') }}</BsDescriptionValue>
                  </BsBox>
                  <BsBox>
                    <BsDescriptionTerm>{{ ledgerView23.t('transactions.category') }}</BsDescriptionTerm>
                    <BsDescriptionValue>{{ ledgerView23.transaction?.category_name || ledgerView23.t('common.dash') }}</BsDescriptionValue>
                  </BsBox>
                  <BsBox>
                    <BsDescriptionTerm>{{ ledgerView23.t('transactions.counterparty') }}</BsDescriptionTerm>
                    <BsDescriptionValue>{{ ledgerView23.transaction?.counterparty_name || ledgerView23.t('common.dash') }}</BsDescriptionValue>
                  </BsBox>
                  <BsBox>
                    <BsDescriptionTerm>{{ ledgerView23.t('transactions.reference') }}</BsDescriptionTerm>
                    <BsDescriptionValue>{{ ledgerView23.transaction?.reference || ledgerView23.t('common.dash') }}</BsDescriptionValue>
                  </BsBox>
                  <BsBox>
                    <BsDescriptionTerm>{{ ledgerView23.t('transactions.createdBy') }}</BsDescriptionTerm>
                    <BsDescriptionValue>{{ ledgerView23.transaction?.created_by_name || ledgerView23.transaction?.created_by_email || ledgerView23.t('common.dash') }}</BsDescriptionValue>
                  </BsBox>
                  <BsBox v-if="ledgerView23.transaction?.adjustment_reason" :span="2">
                    <BsDescriptionTerm>{{ ledgerView23.t('detail.reason') }}</BsDescriptionTerm>
                    <BsDescriptionValue>{{ ledgerView23.transaction.adjustment_reason }}</BsDescriptionValue>
                  </BsBox>
                  <BsBox v-if="ledgerView23.sourceLink" :span="2">
                    <BsDescriptionTerm>{{ ledgerView23.t('journalCenter.sourceRecord') }}</BsDescriptionTerm>
                    <BsDescriptionValue>
                      <BsLink :to="ledgerView23.sourceLink">{{ ledgerView23.t('journalCenter.openSource') }}</BsLink>
                    </BsDescriptionValue>
                  </BsBox>
                </BsDescriptionList>
                <BsBox aria-labelledby="journal-heading" as="section">
                  <BsHeading id="journal-heading" :level="3" size="body">{{ ledgerView23.t('detail.journal') }}</BsHeading>
                  <BsDataTable :value="ledgerView23.entries" :columns="[{ key: 'column1', header: (ledgerView23.t('detail.account')) }, { key: 'column2', header: (ledgerView23.t('detail.debit')), align: 'end' as const }, { key: 'column3', header: (ledgerView23.t('detail.credit')), align: 'end' as const }]">
                    <template #header-column1>{{ ledgerView23.t('detail.account') }}</template>
                    <template #cell-column1="{ row: entry }">
                      <BsText as="span">{{ entry.account_name }}</BsText>
                      <BsText v-if="entry.memo" as="span" size="xs" tone="muted">{{ entry.memo }}</BsText>
                    </template>
                    <template #header-column2>{{ ledgerView23.t('detail.debit') }}</template>
                    <template #cell-column2="{ row: entry }">
                      <BsMoneyText
                        v-if="entry.side === 'debit'"
                        :amount="entry.amount_minor"
                        :currency="ledgerView23.ledgerPresentation.currency(entry.currency_code)"
                        :locale="ledgerView23.ledgerPresentation.locale"
                      />
                      <BsText v-else as="span">{{ ledgerView23.t('common.dash') }}</BsText>
                    </template>
                    <template #header-column3>{{ ledgerView23.t('detail.credit') }}</template>
                    <template #cell-column3="{ row: entry }">
                      <BsMoneyText
                        v-if="entry.side === 'credit'"
                        :amount="entry.amount_minor"
                        :currency="ledgerView23.ledgerPresentation.currency(entry.currency_code)"
                        :locale="ledgerView23.ledgerPresentation.locale"
                      />
                      <BsText v-else as="span">{{ ledgerView23.t('common.dash') }}</BsText>
                    </template>
                  </BsDataTable>
                  <BsInline gap="md" :wrap="true" justify="between" padding="md" surface="muted" radius="control">
                    <BsText as="span">{{ ledgerView23.t('journalCenter.lineTotals') }}</BsText>
                    <BsText as="span">{{ ledgerView23.t('detail.debit') }}: <BsMoneyText :amount="ledgerView23.transaction?.debit_minor" :currency="ledgerView23.ledgerPresentation.currency(ledgerView23.transaction?.currency_code ?? undefined)" :locale="ledgerView23.ledgerPresentation.locale" /></BsText>
                    <BsText as="span">{{ ledgerView23.t('detail.credit') }}: <BsMoneyText :amount="ledgerView23.transaction?.credit_minor" :currency="ledgerView23.ledgerPresentation.currency(ledgerView23.transaction?.currency_code ?? undefined)" :locale="ledgerView23.ledgerPresentation.locale" /></BsText>
                  </BsInline>
                </BsBox>
                <BsWorkflowScope
                  :factory="useLedgerTransactionTagsView"
                  :input="{ selected: ledgerView23.selectedTagId, pending: ledgerView23.tagPending, transactionId: (ledgerView23.transactionId) }"
                  @update:selected="(value: string) => ledgerView23.selectedTagId = value"
                  @update:pending="(value: boolean) => ledgerView23.tagPending = value"
                  @changed="ledgerView23.emit('changed')"
                >
                  <template #default="{ state: ledgerView24 }">
                    <BsStack v-if="ledgerView24.can('tags.read')" aria-labelledby="transaction-tags-heading" as="section" gap="md">
                      <BsBox>
                        <BsHeading id="transaction-tags-heading" :level="3" size="body">{{ ledgerView24.t('operations.tabs.tags') }}</BsHeading>
                        <BsText size="sm" tone="muted">{{ ledgerView24.t('tagsGuide.detailHint') }}</BsText>
                      </BsBox>
                      <BsText v-if="ledgerView24.pending || ledgerView24.tagsPending" role="status" size="sm" tone="muted">{{ ledgerView24.t('app.loading') }}</BsText>
                      <BsBox v-else-if="ledgerView24.error || ledgerView24.tagsError" role="alert">{{ ledgerView24.t('tagsGuide.loadError') }}
      <BsButton type="button" size="sm" @click="ledgerView24.refresh(); ledgerView24.refreshOptions()">{{ ledgerView24.t('accounts.retry') }}</BsButton></BsBox>
                      <template v-else>
                        <BsList v-if="ledgerView24.assigned.length" :aria-label="ledgerView24.t('tagsGuide.assigned')" :ordered="false" marker="none">
                          <BsListItem v-for="row in ledgerView24.assigned" :key="row.tag_id">
                            <BsColorSwatch :color="row.tags?.color" />
                            <BsText as="span">{{ row.tags?.name }}</BsText>
                            <BsButton
                              v-if="ledgerView24.canManage"
                              type="button"
                              :disabled="ledgerView24.busy"
                              :aria-label="ledgerView24.t('tagsGuide.remove', { name: row.tags?.name })"
                              size="sm"
                              @click="ledgerView24.changeTag(row.tag_id, true)"
                            >
                              <BsIcon name="close" :size="14" />
                            </BsButton>
                          </BsListItem>
                        </BsList>
                        <BsText v-else size="sm" tone="muted">{{ ledgerView24.t('tagsGuide.noneAssigned') }}</BsText>
                        <BsInline v-if="ledgerView24.canManage && ledgerView24.available.length" gap="sm" :wrap="true" align="end">
                          <BsFloatingField :label="ledgerView24.t('tagsGuide.choose')">
                            <BsSelect id="transaction-tag" v-model="ledgerView24.selected" :disabled="ledgerView24.busy" native>
                              <BsSelectOption value="">{{ ledgerView24.t('tagsGuide.choose') }}</BsSelectOption>
                              <BsSelectOption v-for="tag in ledgerView24.available" :key="tag.id" :value="tag.id">{{ tag.name }}</BsSelectOption>
                            </BsSelect>
                          </BsFloatingField>
                          <BsButton type="button" :disabled="!ledgerView24.selected || ledgerView24.busy" @click="ledgerView24.changeTag(ledgerView24.selected)">{{ ledgerView24.t('operations.assign') }}</BsButton>
                        </BsInline>
                        <BsText v-if="!ledgerView24.tags.length" size="sm" tone="muted">{{ ledgerView24.t('tagsGuide.noOptions') }}</BsText>
                        <BsText v-if="ledgerView24.failure" role="alert" tone="danger">{{ ledgerView24.failure }}</BsText>
                      </template>
                    </BsStack>
                  </template>
                </BsWorkflowScope>
                <BsBox aria-labelledby="attachments-heading" as="section">
                  <BsInline gap="none" :wrap="false" justify="between">
                    <BsHeading id="attachments-heading" :level="3" size="body">{{ ledgerView23.t('operations.attachments') }}</BsHeading>
                    <BsFieldLabel v-if="ledgerView23.can('attachments.create')">{{ ledgerView23.uploading ? ledgerView23.t('common.saving') : ledgerView23.t('operations.upload') }}<BsFileInput accept="application/pdf,image/png,image/jpeg,image/webp" :disabled="ledgerView23.uploading" bare @change="ledgerView23.uploadAttachment"  hide-control /></BsFieldLabel>
                  </BsInline>
                  <BsUsageMeter
                    v-if="(ledgerView23.can('attachments.create')) && ledgerView23.ledgerUsage.item('max_storage_bytes')"
                    compact
                    :item="ledgerView23.ledgerUsage.item('max_storage_bytes')!"
                  />
                  <BsStack v-if="ledgerView23.attachments.length" gap="sm">
                    <BsInline v-for="item in ledgerView23.attachments" :key="item.id" gap="none" :wrap="false" justify="between" surface="muted" radius="control">
                      <BsButton variant="link" type="submit" @click="ledgerView23.downloadAttachment(item)">{{ item.file_name }}</BsButton>
                      <BsButton
                        v-if="ledgerView23.can('attachments.delete')"
                        type="submit"
                        :aria-label="ledgerView23.t('common.delete')"
                        size="sm"
                        @click="ledgerView23.deleteAttachment(item)"
                      >
                        <BsIcon name="delete" :size="18" />
                      </BsButton>
                    </BsInline>
                  </BsStack>
                  <BsText v-else size="sm" tone="muted">{{ ledgerView23.t('operations.noAttachments') }}</BsText>
                </BsBox>
                <BsBox
                  v-if="ledgerView23.transaction?.reverses_transaction_id || ledgerView23.transaction?.reversed_by_transaction_id || ledgerView23.transaction?.correction_of_transaction_id"
                  aria-labelledby="relationships-heading"
                  as="section"
                  radius="control"
                >
                  <BsHeading id="relationships-heading" :level="3" size="body">{{ ledgerView23.t('journalCenter.relationships') }}</BsHeading>
                  <BsText v-if="ledgerView23.transaction?.reversed_by_transaction_id">{{ ledgerView23.t('detail.reversedNotice') }} <BsButton variant="link" type="button" @click="ledgerView23.emit('navigate', ledgerView23.transaction.reversed_by_transaction_id)">{{ ledgerView23.t('journalCenter.reversalJournal') }} {{ ledgerView23.relationship(ledgerView23.transaction.reversed_by_transaction_id)?.journal_reference }}</BsButton></BsText>
                  <BsText v-if="ledgerView23.transaction?.reverses_transaction_id">{{ ledgerView23.t('journalCenter.reverses') }} <BsButton variant="link" type="button" @click="ledgerView23.emit('navigate', ledgerView23.transaction.reverses_transaction_id)">{{ ledgerView23.t('journalCenter.originalJournal') }} {{ ledgerView23.relationship(ledgerView23.transaction.reverses_transaction_id)?.journal_reference }}</BsButton></BsText>
                  <BsText v-if="ledgerView23.transaction?.correction_of_transaction_id">{{ ledgerView23.t('journalCenter.adjusts') }} <BsButton variant="link" type="button" @click="ledgerView23.emit('navigate', ledgerView23.transaction.correction_of_transaction_id)">{{ ledgerView23.relationship(ledgerView23.transaction.correction_of_transaction_id)?.journal_reference }}</BsButton></BsText>
                </BsBox>
                <BsText v-if="ledgerView23.periodRestriction" size="sm" tone="muted">{{ ledgerView23.periodRestriction }}</BsText>
                <BsCard v-if="ledgerView23.confirming" as="div" variant="flat" padding="md">
                  <BsStack gap="md">
                    <BsText size="sm">{{ ledgerView23.t('detail.reverseExplain') }}</BsText>
                    <BsBox>
                      <BsFieldLabel for="reverse-reason">{{ ledgerView23.t('detail.reverseReason') }}</BsFieldLabel>
                      <BsInput id="reverse-reason" v-model="ledgerView23.reason" :placeholder="ledgerView23.t('detail.reverseReasonPlaceholder')" />
                    </BsBox>
                    <BsInline gap="sm" :wrap="false" justify="end">
                      <BsButton type="button" @click="ledgerView23.confirming = false">{{ ledgerView23.t('common.cancel') }}</BsButton>
                      <BsButton type="button" :disabled="ledgerView23.reversing" variant="danger" @click="ledgerView23.reverse">{{ ledgerView23.reversing ? ledgerView23.t('detail.reversing') : ledgerView23.t('detail.reverseConfirm') }}</BsButton>
                    </BsInline>
                  </BsStack>
                </BsCard>
                <BsText v-if="ledgerView23.errorMessage" role="alert" tone="danger">{{ ledgerView23.errorMessage }}</BsText>
              </BsStack>
              <BsBox v-if="ledgerView23.canReverse && !ledgerView23.confirming" as="footer">
                <BsButton type="button" @click="ledgerView23.confirming = true">{{ ledgerView23.t('detail.reverseAction') }}</BsButton>
              </BsBox>
            </BsStack>
          </template>
        </BsDialog>
      </template>
    </BsWorkflowScope>
  </BsStack>
</template>
