<script setup lang="ts">
import type { BsCustomerDirectoryCopy, BsCustomerDirectoryRow, BsCustomerIdentityForm } from '@building-suit/ui/types/customerDirectoryPresentation'
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
const { cancel: cancelSearch } = useDebouncedChange(search, (value) => {
  debouncedSearch.value = value.trim()
  page.value = 1
})
watch(statusFilter, () => { page.value = 1 })
watch(currentId, () => {
  cancelSearch()
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
  return t('customers.writeError')
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

useShopRealtime('customers', () => formDirty.value)

const copy = computed<BsCustomerDirectoryCopy>(() => ({
  title: t('customers.title'),
  subtitle: t('customers.subtitle'),
  noShop: t('customers.noShop'),
  dashboard: t('customers.dashboard'),
  historyNotice: t('customers.historyNotice'),
  permissionDenied: t('customers.permissionDenied'),
  manageDenied: t('customers.manageDenied'),
  createTitle: t('customers.createTitle'),
  save: t('customers.save'),
  cancel: t('customers.cancel'),
  name: t('customers.name'),
  phone: t('customers.phone'),
  email: t('customers.email'),
  address: t('customers.address'),
  notes: t('customers.notes'),
  add: t('customers.add'),
  search: t('customers.search'),
  contact: t('customers.contact'),
  status: t('customers.status'),
  updated: t('customers.updated'),
  noCustomers: t('customers.noCustomers'),
}))
const rows = computed<BsCustomerDirectoryRow[]>(() => (customerPage.value?.items ?? []).map(customer => ({
  id: customer.id, name: customer.name, href: `/customers/${customer.id}`,
  phone: customer.phone || '—', email: customer.email || '—',
  status: t(customer.is_active ? 'customers.active' : 'customers.archived'), updated: formatDate(customer.updated_at),
})))
const editorForm = computed<BsCustomerIdentityForm>({ get: () => ({ ...form }), set: value => Object.assign(form, value) })
const statusModel = computed<string>({ get: () => statusFilter.value, set: value => { if (value === 'active' || value === 'archived' || value === 'all') statusFilter.value = value } })
const statusOptions = computed(() => ['active', 'archived', 'all'].map(value => ({ value, label: t(`customers.${value}`) })))
</script>

<template>
  <BsCustomerDirectoryPage v-model:form="editorForm" v-model:visible="showForm" v-model:status="statusModel" :copy="copy" :rows="rows" :context-available="Boolean(current)" :context-loading="shopLoading" :permission-denied="Boolean(customerPage?.permissionDenied)" :can-manage="canManage" :loading="pending" :error="error ? t('customers.loadError') : null" :page="page" :page-size="pageSize" :total="customerPage?.total ?? 0" :editor-dirty="formDirty" :saving="saving" :action-error="actionError" :status-options="statusOptions" @search="search = $event" @page="handlePage" @retry="refresh()" @create="openCreate" @save="save"/>
</template>
