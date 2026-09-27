<script setup lang="ts">
import type { ShopRpcDatabase } from '~/types/shopCrmRpc'

definePageMeta({ layout: 'default', middleware: ['auth', 'business-mode'] })

type Customer = {
  id: string
  name: string
  phone: string | null
  email: string | null
  address: string | null
  notes: string | null
  is_active: boolean
  created_at: string
  updated_at: string
  archived_at: string | null
}

type CustomerPage = {
  items: Customer[]
  total: number
  page: number
  pageSize: number
  canManage: boolean
  permissionDenied?: boolean
}

const shopRpc = useSupabaseClient<ShopRpcDatabase>().schema('public')
const { t, locale } = useI18n()
const { current, currentId, loading: shopLoading } = useShop()
const { push: pushToast } = useToasts()
const search = ref('')
const debouncedSearch = ref('')
const statusFilter = ref<'active' | 'archived' | 'all'>('active')
const page = ref(1)
const pageSize = 20
const form = reactive({ name: '', phone: '', email: '', address: '', notes: '' })
const actionError = ref('')
const { visible: showForm, pending: saving, dirty: formDirty, complete } = useRecordAction(() => form)
let searchTimer: ReturnType<typeof setTimeout> | undefined

watch(search, (value) => {
  if (searchTimer) clearTimeout(searchTimer)
  searchTimer = setTimeout(() => {
    debouncedSearch.value = value.trim()
    page.value = 1
  }, 300)
})
onBeforeUnmount(() => { if (searchTimer) clearTimeout(searchTimer) })
watch(statusFilter, () => { page.value = 1 })
watch(currentId, () => {
  page.value = 1
  search.value = ''
  debouncedSearch.value = ''
  showForm.value = false
})

function activeFilter() {
  if (statusFilter.value === 'all') return null
  return statusFilter.value === 'active'
}

const { data: customerPage, pending, error, refresh } = useAsyncData(
  'shop-data:customers',
  async (): Promise<CustomerPage> => {
    if (!currentId.value) return { items: [], total: 0, page: 1, pageSize, canManage: false }
    const { data: accessRows, error: accessError } = await shopRpc.rpc('customer_access', {
      p_shop_id: currentId.value,
    })
    if (accessError) throw accessError
    const access = accessRows?.[0]
    if (!access?.can_view) {
      return { items: [], total: 0, page: page.value, pageSize, canManage: false, permissionDenied: true }
    }
    const { data, error: queryError } = await shopRpc.rpc('list_customers', {
      p_shop_id: currentId.value,
      p_search: debouncedSearch.value || null,
      p_is_active: activeFilter(),
      p_page: page.value,
      p_page_size: pageSize,
    })
    if (queryError) throw queryError
    return data as CustomerPage
  },
  {
    watch: [currentId, debouncedSearch, statusFilter, page],
    default: (): CustomerPage => ({ items: [], total: 0, page: 1, pageSize, canManage: false }),
  },
)

const canManage = computed(() => Boolean(customerPage.value?.canManage))

function resetForm() {
  form.name = ''
  form.phone = ''
  form.email = ''
  form.address = ''
  form.notes = ''
  actionError.value = ''
}

function openCreate() {
  resetForm()
  showForm.value = true
}

function readableError(message?: string) {
  if (message === 'INVALID_CUSTOMER') return t('customers.invalid')
  if (message === 'SHOP_SUBSCRIPTION_INACTIVE' || message === 'SHOP_PERMISSION_DENIED') return t('customers.manageDenied')
  return message || t('customers.writeError')
}

async function save() {
  if (!currentId.value || saving.value || !canManage.value) return
  actionError.value = ''
  const email = form.email.trim()
  if (form.name.trim().length < 2 || form.name.trim().length > 160
    || form.phone.trim().length > 50 || email.length > 254
    || (email && (!email.includes('@') || email.startsWith('@')))
    || form.address.trim().length > 500 || form.notes.trim().length > 2000) {
    actionError.value = t('customers.invalid')
    return
  }
  saving.value = true
  try {
    const { error: saveError } = await shopRpc.rpc('save_customer', {
      p_shop_id: currentId.value,
      p_customer_id: null,
      p_name: form.name.trim(),
      p_phone: form.phone.trim() || null,
      p_email: email || null,
      p_address: form.address.trim() || null,
      p_notes: form.notes.trim() || null,
    })
    if (saveError) throw saveError
    complete()
    resetForm()
    page.value = 1
    statusFilter.value = 'active'
    await refresh()
    pushToast({ tone: 'success', title: t('customers.createdSuccess') })
  }
  catch (saveError) {
    actionError.value = readableError(saveError instanceof Error ? saveError.message : undefined)
  }
  finally {
    saving.value = false
  }
}

function handlePage(event: { page: number }) {
  page.value = event.page + 1
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat(locale.value === 'ar' ? 'ar-EG' : 'en-EG', { dateStyle: 'medium' }).format(new Date(value))
}
</script>

<template>
  <div class="space-y-6">
    <header class="flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 class="text-3xl font-extrabold tracking-tight">{{ t('customers.title') }}</h1>
        <p class="mt-2 text-sm text-muted-foreground">{{ t('customers.subtitle') }}</p>
      </div>
      <button v-if="current && canManage" type="button" class="ls-btn ls-btn-primary" @click="openCreate">
        {{ t('customers.add') }}
      </button>
    </header>

    <div v-if="!current && !shopLoading" class="rounded-2xl border border-border bg-card p-8 text-center text-sm">
      <p>{{ t('customers.noShop') }}</p>
      <NuxtLink to="/dashboard" class="mt-3 inline-block font-bold text-[var(--bs-link)] underline">{{ t('customers.dashboard') }}</NuxtLink>
    </div>

    <template v-else-if="current">
      <p class="rounded-xl border border-[var(--bs-status-info)]/25 bg-[var(--bs-status-info-bg)] p-4 text-sm">
        {{ t('customers.historyNotice') }}
      </p>

      <p v-if="customerPage?.permissionDenied" role="alert" class="rounded-xl border border-[var(--bs-status-warning)]/30 bg-[var(--bs-status-warning-bg)] p-4 text-sm">
        {{ t('customers.permissionDenied') }}
      </p>
      <p v-else-if="customerPage && !canManage" class="rounded-xl border border-[var(--bs-status-info)]/25 bg-[var(--bs-status-info-bg)] p-4 text-sm">
        {{ t('customers.manageDenied') }}
      </p>

      <BsDialog v-model:visible="showForm" :title="t('customers.createTitle')" :dirty="formDirty" :pending="saving">
        <template #default="{ close }">
          <form class="grid gap-4 sm:grid-cols-2" @submit.prevent="save">
            <p v-if="actionError" role="alert" class="rounded-xl bg-[var(--bs-status-error-bg)] p-3 text-sm text-[var(--bs-status-error)] sm:col-span-2">{{ actionError }}</p>
            <label class="space-y-2 text-sm font-bold sm:col-span-2">{{ t('customers.name') }}<input v-model="form.name" type="text" minlength="2" maxlength="160" required class="ls-input"></label>
            <label class="space-y-2 text-sm font-bold">{{ t('customers.phone') }}<input v-model="form.phone" type="tel" maxlength="50" autocomplete="tel" class="ls-input"></label>
            <label class="space-y-2 text-sm font-bold">{{ t('customers.email') }}<input v-model="form.email" type="email" maxlength="254" autocomplete="email" class="ls-input"></label>
            <label class="space-y-2 text-sm font-bold sm:col-span-2">{{ t('customers.address') }}<textarea v-model="form.address" maxlength="500" rows="2" class="ls-input" /></label>
            <label class="space-y-2 text-sm font-bold sm:col-span-2">{{ t('customers.notes') }}<textarea v-model="form.notes" maxlength="2000" rows="3" class="ls-input" /></label>
            <div class="flex flex-wrap gap-2 sm:col-span-2">
              <button type="submit" class="ls-btn ls-btn-primary" :disabled="saving">{{ saving ? t('customers.saving') : t('customers.save') }}</button>
              <button type="button" class="ls-btn" :disabled="saving" @click="close">{{ t('customers.cancel') }}</button>
            </div>
          </form>
        </template>
      </BsDialog>

      <div v-if="!customerPage?.permissionDenied" class="overflow-hidden rounded-2xl border border-border bg-card">
        <div class="flex flex-col gap-3 border-b border-border p-4 sm:flex-row sm:items-center">
          <input v-model="search" type="search" :placeholder="t('customers.search')" :aria-label="t('customers.search')" class="ls-input sm:max-w-md">
          <select v-model="statusFilter" :aria-label="t('customers.status')" class="ls-select sm:ms-auto sm:w-auto">
            <option value="active">{{ t('customers.active') }}</option>
            <option value="archived">{{ t('customers.archived') }}</option>
            <option value="all">{{ t('customers.all') }}</option>
          </select>
        </div>

        <BsDataTable
          :value="customerPage?.items ?? []"
          :loading="pending"
          :error="error ? t('customers.loadError') : null"
          :label="t('customers.title')"
          data-key="id"
          lazy
          paginator
          :rows="pageSize"
          :first="(page - 1) * pageSize"
          :total-records="customerPage?.total ?? 0"
          :always-show-paginator="false"
          :row-class="() => 'border-t border-border'"
          @page="handlePage"
          @retry="refresh()"
        >
          <Column header-class="px-5 py-3 text-start" body-class="px-5 py-4">
            <template #header>{{ t('customers.name') }}</template>
            <template #body="{ data: customer }">
              <NuxtLink :to="`/customers/${customer.id}`" class="font-bold text-[var(--bs-link)] underline-offset-4 hover:underline">{{ customer.name }}</NuxtLink>
            </template>
          </Column>
          <Column header-class="px-5 py-3 text-start" body-class="px-5 py-4">
            <template #header>{{ t('customers.contact') }}</template>
            <template #body="{ data: customer }">
              <div class="space-y-1"><p>{{ customer.phone || '—' }}</p><p class="text-xs text-muted-foreground">{{ customer.email || '—' }}</p></div>
            </template>
          </Column>
          <Column header-class="px-5 py-3 text-start" body-class="px-5 py-4">
            <template #header>{{ t('customers.status') }}</template>
            <template #body="{ data: customer }">
              <span class="ls-badge" :class="customer.is_active ? 'bg-[var(--bs-status-success-bg)] text-[var(--bs-status-success)]' : 'bg-muted text-muted-foreground'">
                {{ customer.is_active ? t('customers.active') : t('customers.archived') }}
              </span>
            </template>
          </Column>
          <Column header-class="px-5 py-3 text-start" body-class="px-5 py-4">
            <template #header>{{ t('customers.updated') }}</template>
            <template #body="{ data: customer }">{{ formatDate(customer.updated_at) }}</template>
          </Column>
          <template #empty><p class="p-8 text-center text-sm text-muted-foreground">{{ t('customers.noCustomers') }}</p></template>
        </BsDataTable>
      </div>
    </template>
  </div>
</template>
