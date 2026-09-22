<script setup lang="ts">
import { usePrimeVue } from 'primevue/config'
import { copy } from '../../copy'

defineOptions({ name: 'AccountantReview' })

// This entire fixture is outside Ledger's app tree. No auth, data adapter or RPC.
const { locale, setLocale } = useI18n()
const text = computed(() => copy[locale.value === 'ar' ? 'ar' : 'en'])
const theme = useTheme()
const primevue = usePrimeVue()
watchEffect(() => {
  const ar = locale.value === 'ar'
  Object.assign(primevue.config.locale!.aria!, {
    pageLabel: ar ? 'الصفحة {page}' : 'Page {page}',
    firstPageLabel: ar ? 'الصفحة الأولى' : 'First Page',
    lastPageLabel: ar ? 'الصفحة الأخيرة' : 'Last Page',
    nextPageLabel: ar ? 'الصفحة التالية' : 'Next Page',
    prevPageLabel: ar ? 'الصفحة السابقة' : 'Previous Page',
    rowsPerPageLabel: ar ? 'عدد الصفوف في الصفحة' : 'Rows per page',
  })
})
const organization = ref('alpha')
const session = ref(true)
const search = ref('')
const from = ref('2026-01-01')
const to = ref('2026-02-28')
const first = ref(0)
const sortField = ref('date')
const sortOrder = ref<1 | -1>(-1)
const note = ref('')
const customName = ref('')
const selectedId = ref<string | null>(null)
const accountId = ref<string | null>(null)
const scenario = ref<'ready' | 'slow' | 'error' | 'missing' | 'denied' | 'empty'>('ready')
const state = ref<'loading' | 'ready' | 'error' | 'missing' | 'denied'>('loading')
const journalPanel = ref<HTMLElement | null>(null)
const detailHeading = ref<HTMLElement | null>(null)
const hydrated = ref(false)
let journalScroll = 0
let accountTrigger: string | null = null
let request: AbortController | undefined
let generation = 0
let journalTrigger: HTMLElement | null = null

const orgName = computed(() => organization.value === 'alpha' ? text.value.alpha : text.value.beta)
const scope = computed(() => `${organization.value}:${session.value}`)
const accounts = computed(() => [
  { id: `${organization.value}-rent`, code: '6101', name: text.value.rent, side: 'debit' },
  { id: `${organization.value}-bank`, code: '1102', name: customName.value || text.value.bank, side: 'credit' },
])
const journals = computed(() => session.value ? Array.from({ length: 36 }, (_, i) => ({
  id: `${organization.value}-journal-${i + 1}`,
  organizationId: organization.value,
  reference: `J-${String(i + 1).padStart(3, '0')}`,
  date: `2026-${i < 28 ? '01' : '02'}-${String(i % 28 + 1).padStart(2, '0')}`,
  description: text.value.rentJournal,
})) : [])
type Journal = (typeof journals.value)[number]
const result = ref<{ scope: string; accountId: string; entries: Journal[] } | null>(null)
const filtered = computed(() => journals.value.filter(j => j.date >= from.value && j.date <= to.value
  && `${j.reference} ${j.description}`.toLocaleLowerCase().includes(search.value.toLocaleLowerCase())))
const journal = computed(() => journals.value.find(j => j.id === selectedId.value))
const account = computed(() => accounts.value.find(a => a.id === accountId.value))
const accountEntries = computed(() => result.value?.scope === scope.value && result.value.accountId === accountId.value ? result.value.entries : [])
const amount = computed(() => locale.value === 'ar' ? '٢٬٠٠٠٫٠٠' : '2,000.00')
const localizedDate = (date: string) => new Intl.DateTimeFormat(locale.value === 'ar' ? 'ar-EG' : 'en-GB', { timeZone: 'UTC' }).format(new Date(`${date}T00:00:00Z`))

useHead(() => ({ title: text.value.title, htmlAttrs: { lang: locale.value, dir: locale.value === 'ar' ? 'rtl' : 'ltr' } }))
onMounted(() => { theme.restore(); hydrated.value = true })
watch([search, from, to], () => { first.value = 0 })

function cancelRead() {
  generation++
  request?.abort()
  request = undefined
  result.value = null
}

// Both abort and generation/scope checks: a response cannot outlive its owner.
async function loadAccount(retry = false) {
  cancelRead()
  const id = accountId.value
  if (!id || !session.value || !account.value) return
  const version = generation
  const requestedScope = scope.value
  const response = scenario.value
  const controller = new AbortController()
  request = controller
  state.value = 'loading'
  await new Promise<void>((resolve) => {
    const timer = setTimeout(resolve, response === 'slow' ? 1200 : 200)
    controller.signal.addEventListener('abort', () => { clearTimeout(timer); resolve() }, { once: true })
  })
  if (controller.signal.aborted || version !== generation || requestedScope !== scope.value || id !== accountId.value) return
  state.value = response === 'error' && !retry ? 'error' : response === 'missing' || response === 'denied' ? response : 'ready'
  if (state.value === 'ready') result.value = { scope: requestedScope, accountId: id, entries: response === 'empty' ? [] : [...filtered.value] }
}

async function openJournal(row: Journal, event: MouseEvent) {
  journalTrigger = event.currentTarget as HTMLElement
  selectedId.value = row.id
}

async function openAccount(id: string) {
  journalScroll = journalPanel.value?.scrollTop ?? 0
  accountTrigger = id
  accountId.value = id
  void loadAccount()
  await nextTick()
  detailHeading.value?.focus()
}

async function backToJournal() {
  cancelRead()
  accountId.value = null
  await nextTick()
  if (journalPanel.value) journalPanel.value.scrollTop = journalScroll
  if (accountTrigger) document.getElementById(`account-${accountTrigger}`)?.focus({ preventScroll: true })
}

async function closeDetail(visible: boolean) {
  if (visible) return
  if (accountId.value) return backToJournal()
  cancelRead()
  selectedId.value = null
  await nextTick()
  journalTrigger?.focus({ preventScroll: true })
}

watch(scope, () => {
  cancelRead()
  selectedId.value = null
  accountId.value = null
  accountTrigger = null
  journalTrigger = null
  journalScroll = 0
  note.value = ''
  customName.value = ''
  search.value = ''
  from.value = '2026-01-01'
  to.value = '2026-02-28'
  first.value = 0
  sortField.value = 'date'
  sortOrder.value = -1
}, { flush: 'sync' })
onBeforeUnmount(cancelRead)
</script>

<template>
  <main class="mx-auto max-w-6xl space-y-6 p-4 sm:p-8" :data-hydrated="hydrated">
    <header class="flex flex-wrap items-start justify-between gap-4">
      <div>
        <p class="mb-2 text-sm text-fg-muted">{{ text.subtitle }}</p>
        <h1 class="text-2xl font-bold">{{ text.title }}</h1>
        <p class="mt-2 font-semibold" data-testid="organization-name">{{ orgName }}</p>
      </div>
      <div class="flex gap-3">
        <label class="space-y-1 text-sm">{{ text.language }}
          <select class="ls-input" :aria-label="text.language" :value="locale" @change="setLocale(($event.target as HTMLSelectElement).value as 'en' | 'ar')"><option value="en">English</option><option value="ar">العربية</option></select>
        </label>
        <label class="space-y-1 text-sm">{{ text.theme }}
          <select class="ls-input" :aria-label="text.theme" :value="theme.isDark.value ? 'dark' : 'light'" @change="theme.set(($event.target as HTMLSelectElement).value as 'dark' | 'light')"><option value="light">{{ text.light }}</option><option value="dark">{{ text.dark }}</option></select>
        </label>
      </div>
    </header>
    <aside class="ls-card-flat space-y-2 p-4" aria-label="AS-S1-01">
      <p class="font-semibold">{{ text.notice }}</p>
      <p class="text-sm text-fg-muted">{{ text.resetNotice }}</p>
    </aside>
    <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <label class="space-y-1 text-sm">{{ text.organization }}<select v-model="organization" class="ls-input" data-testid="organization"><option value="alpha">{{ text.alpha }}</option><option value="beta">{{ text.beta }}</option></select></label>
      <label class="space-y-1 text-sm">{{ text.scenario }}<select v-model="scenario" class="ls-input" data-testid="scenario"><option v-for="key in (['ready', 'slow', 'error', 'missing', 'denied', 'empty'] as const)" :key="key" :value="key">{{ text[key] }}</option></select></label>
      <label class="space-y-1 text-sm">{{ text.customName }}<input v-model="customName" class="ls-input" data-testid="custom-name" :disabled="!session"></label>
    </div>
    <template v-if="session">
      <label class="block space-y-1 text-sm">{{ text.note }}<textarea v-model="note" class="ls-input" rows="2" data-testid="review-note" /></label>
      <div class="grid gap-3 sm:grid-cols-3">
        <label class="space-y-1 text-sm">{{ text.search }}<input v-model="search" class="ls-input" type="search" data-testid="search"></label>
        <label class="space-y-1 text-sm">{{ text.from }}<input v-model="from" class="ls-input" type="date" data-testid="from"></label>
        <label class="space-y-1 text-sm">{{ text.to }}<input v-model="to" class="ls-input" type="date" data-testid="to"></label>
      </div>
      <div class="ls-card overflow-hidden">
        <BsDataTable v-model:first="first" v-model:sort-field="sortField" v-model:sort-order="sortOrder" :value="filtered" :label="text.journal" data-key="id" paginator :rows="10" :rows-per-page-options="[10, 20]" data-testid="journals">
          <Column field="date" :header="text.date" sortable><template #body="{ data }"><span class="whitespace-nowrap">{{ localizedDate(data.date) }}</span></template></Column>
          <Column field="reference" :header="text.reference" sortable><template #body="{ data }"><button type="button" class="text-link underline" :data-testid="data.id" :aria-label="`${text.open} ${data.reference}`" @click="openJournal(data, $event)"><bdi>{{ data.reference }}</bdi></button></template></Column>
          <Column field="description" :header="text.description" />
        </BsDataTable>
      </div>
    </template>
    <div v-else role="status" class="ls-card p-6"><p>{{ text.ended }}</p><button class="ls-btn mt-4" @click="session = true">{{ text.startSession }}</button></div>
    <p class="text-sm text-fg-muted">{{ text.scenarioNotice }}</p>

    <BsDialog :visible="Boolean(journal)" :title="`${accountId ? text.detail : text.journal} · ${journal?.reference ?? ''}`" size="lg" @update:visible="closeDetail">
      <template #default="{ close }">
        <p class="mb-4 text-sm font-semibold">{{ text.notice }} · {{ orgName }}</p>
        <div v-show="!accountId" ref="journalPanel" class="max-h-[45vh] space-y-5 overflow-auto" data-testid="journal-panel">
          <dl class="grid grid-cols-2 gap-4 text-sm"><div><dt class="text-fg-muted">{{ text.reference }}</dt><dd><bdi>{{ journal?.reference }}</bdi></dd></div><div><dt class="text-fg-muted">{{ text.date }}</dt><dd>{{ journal ? localizedDate(journal.date) : '' }}</dd></div></dl>
          <h2 class="font-bold">{{ journal?.description }}</h2>
          <BsDataTable :value="accounts" :label="text.journal" data-key="id">
            <Column :header="text.account"><template #body="{ data }"><button :id="`account-${data.id}`" class="text-start text-link underline" :data-testid="`account-${data.id}`" @click="openAccount(data.id)">{{ data.name }}</button><p class="mt-1 text-xs text-fg-muted"><bdi>{{ data.code }}</bdi></p></template></Column>
            <Column :header="text.debit"><template #body="{ data }"><span class="whitespace-nowrap">{{ data.side === 'debit' ? amount : '—' }}</span></template></Column>
            <Column :header="text.credit"><template #body="{ data }"><span class="whitespace-nowrap">{{ data.side === 'credit' ? amount : '—' }}</span></template></Column>
          </BsDataTable>
          <p class="text-sm text-fg-muted">{{ text.currency }}: <bdi>EGP</bdi></p>
        </div>
        <section v-if="accountId" class="space-y-4" data-testid="account-panel">
          <button class="ls-btn" @click="backToJournal">{{ text.back }}</button>
          <h2 ref="detailHeading" tabindex="-1" class="text-xl font-bold" data-testid="account-heading">{{ account?.name }} <span class="text-sm font-normal text-fg-muted"><bdi>{{ account?.code }}</bdi></span></h2>
          <p class="text-sm text-fg-muted">{{ text.sampleOnly }}</p>
          <p v-if="state === 'loading'" role="status">{{ text.loading }}</p>
          <div v-else-if="state === 'missing' || state === 'denied'" role="status" class="ls-card-flat p-5">{{ state === 'missing' ? text.missingMessage : text.deniedMessage }}</div>
          <BsDataTable v-else :value="accountEntries" :label="text.entries" :error="state === 'error' ? text.errorMessage : null" data-key="id" paginator :rows="5" @retry="loadAccount(true)">
            <Column :header="text.date"><template #body="{ data }">{{ localizedDate(data.date) }}</template></Column>
            <Column field="reference" :header="text.reference" />
            <Column :header="text.debit"><template #body>{{ account?.side === 'debit' ? amount : '—' }}</template></Column>
            <Column :header="text.credit"><template #body>{{ account?.side === 'credit' ? amount : '—' }}</template></Column>
            <template #empty><p class="p-6 text-fg-muted">{{ text.emptyMessage }}</p></template>
          </BsDataTable>
        </section>
        <div v-if="!accountId" class="mt-6 flex justify-end"><button class="ls-btn" @click="close">{{ text.close }}</button></div>
      </template>
      <template #footer>
        <div class="w-full space-y-2 border-t border-line pt-3">
          <p class="text-xs text-fg-muted">{{ text.scopeNotice }}</p>
          <div class="flex flex-wrap items-end gap-3">
            <label class="flex-1 space-y-1 text-sm">{{ text.organization }}<select v-model="organization" class="ls-input" data-testid="dialog-organization"><option value="alpha">{{ text.alpha }}</option><option value="beta">{{ text.beta }}</option></select></label>
            <button class="ls-btn" data-testid="end-session" @click="session = false">{{ text.endSession }}</button>
          </div>
        </div>
      </template>
    </BsDialog>
  </main>
</template>
