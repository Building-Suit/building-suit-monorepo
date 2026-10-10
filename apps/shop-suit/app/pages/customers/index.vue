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
</script>

<template>
  <BsStack>
    <BsPageHeader  :title="t('customers.title')" :subtitle="t('customers.subtitle')"/>
    <BsPanel v-if="!current && !shopLoading" padding="md">
      <BsText as="p">{{ t('customers.noShop') }}</BsText>
      <BsLink to="/dashboard">{{ t('customers.dashboard') }}</BsLink>
    </BsPanel>
    <template v-else-if="current">
      <BsText as="p" size="sm">{{ t('customers.historyNotice') }}</BsText>
      <BsText v-if="customerPage?.permissionDenied" role="alert" as="p" size="sm" tone="warning">{{ t('customers.permissionDenied') }}</BsText>
      <BsText v-else-if="customerPage && !canManage" as="p" size="sm">{{ t('customers.manageDenied') }}</BsText>
      <BsRecordActionDialog v-model:visible="showForm" :title="t('customers.createTitle')" :dirty="formDirty" :pending="saving" :error="actionError" :submit-label="t('customers.save')" :cancel-label="t('customers.cancel')" @submit="save">
        <BsField v-slot="field" :label="(t('customers.name'))">
          <BsInput :id="field.id" v-model="form.name" :aria-describedby="field.describedby" type="text" :minlength="2" :maxlength="160" required/>
        </BsField>
        <BsField v-slot="field" :label="(t('customers.phone'))">
          <BsInput :id="field.id" v-model="form.phone" :aria-describedby="field.describedby" type="tel" :maxlength="50" autocomplete="tel"/>
        </BsField>
        <BsField v-slot="field" :label="(t('customers.email'))">
          <BsInput :id="field.id" v-model="form.email" :aria-describedby="field.describedby" type="email" :maxlength="254" autocomplete="email"/>
        </BsField>
        <BsField v-slot="field" :label="(t('customers.address'))">
          <BsTextarea :id="field.id" v-model="form.address" :aria-describedby="field.describedby" :maxlength="500" :rows="2"/>
        </BsField>
        <BsField v-slot="field" :label="(t('customers.notes'))">
          <BsTextarea :id="field.id" v-model="form.notes" :aria-describedby="field.describedby" :maxlength="2000" :rows="3"/>
        </BsField>
      </BsRecordActionDialog>
      <BsPanel v-if="!customerPage?.permissionDenied" padding="md">
        <BsDataTable :value="customerPage?.items ?? []" :loading="pending" :error="error ? t('customers.loadError') : null" :label="t('customers.title')" :capabilities="{ insert: canManage }" :action-labels="{ insert: t('customers.add') }" searchable :search-label="t('customers.search')" data-key="id" lazy paginator :rows="pageSize" :first="(page - 1) * pageSize" :total-records="customerPage?.total ?? 0" :always-show-paginator="false" :columns="[{ key: 'column0', header: (t('customers.name')) }, { key: 'column1', header: (t('customers.contact')) }, { key: 'column2', header: (t('customers.status')) }, { key: 'column3', header: (t('customers.updated')) }]" @search="value => search = value" @page="handlePage" @retry="refresh()" @create="openCreate">
          <template #cell-column0="{ row: customer }">
            <BsLink :to="`/customers/${customer.id}`">{{ customer.name }}</BsLink>
          </template>
          <template #cell-column1="{ row: customer }">
            <BsStack>
              <BsText as="p">{{ customer.phone || '—' }}</BsText>
              <BsText as="p" size="xs" tone="muted">{{ customer.email || '—' }}</BsText>
            </BsStack>
          </template>
          <template #cell-column2="{ row: customer }">
            <BsText as="span">{{ customer.is_active ? t('customers.active') : t('customers.archived') }}</BsText>
          </template>
          <template #cell-column3="{ row: customer }">{{ formatDate(customer.updated_at) }}</template>
          <template #filters>
            <BsSelect
              v-model="statusFilter" :label="t('customers.status')" :options="[
                { value: 'active', label: t('customers.active') },
                { value: 'archived', label: t('customers.archived') },
                { value: 'all', label: t('customers.all') },
              ]" option-label="label" option-value="value"/>
          </template>
          <template #empty>
            <BsText as="p" size="sm" tone="muted">{{ t('customers.noCustomers') }}</BsText>
          </template>
        </BsDataTable>
      </BsPanel>
    </template>
  </BsStack>
</template>
