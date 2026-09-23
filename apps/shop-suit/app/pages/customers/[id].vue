<script setup lang="ts">
import type { ShopRpcDatabase } from '~/types/shopCrmRpc'

definePageMeta({ layout: 'default', middleware: ['auth', 'business-mode'] })

type CustomerDetail = {
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
  can_manage: boolean
}

const route = useRoute()
const shopRpc = useSupabaseClient<ShopRpcDatabase>().schema('public')
const confirmation = useConfirmation()
const { push: pushToast } = useToasts()
const { t, locale } = useI18n()
const { currentId } = useShop()
const customerId = computed(() => String(route.params.id ?? ''))
const form = reactive({ name: '', phone: '', email: '', address: '', notes: '' })
const actionError = ref('')
const archiving = ref(false)
const { visible: showForm, pending: saving, dirty: formDirty, complete } = useRecordAction(() => form)

const { data: customer, pending, error, refresh } = useAsyncData(
  () => `shop-data:customer:${currentId.value ?? 'none'}:${customerId.value}`,
  async (): Promise<CustomerDetail | null> => {
    if (!currentId.value || !customerId.value) return null
    const { data, error: queryError } = await shopRpc.rpc('get_customer', {
      p_shop_id: currentId.value,
      p_customer_id: customerId.value,
    })
    if (queryError) throw queryError
    return data?.[0] ?? null
  },
  { watch: [currentId, customerId], default: () => null },
)

function openEdit() {
  if (!customer.value?.is_active || !customer.value.can_manage) return
  form.name = customer.value.name
  form.phone = customer.value.phone ?? ''
  form.email = customer.value.email ?? ''
  form.address = customer.value.address ?? ''
  form.notes = customer.value.notes ?? ''
  actionError.value = ''
  showForm.value = true
}

function readableError(message?: string) {
  if (message === 'INVALID_CUSTOMER') return t('customers.invalid')
  if (message === 'SHOP_SUBSCRIPTION_INACTIVE' || message === 'SHOP_PERMISSION_DENIED') return t('customers.manageDenied')
  if (message === 'CUSTOMER_NOT_FOUND') return t('customers.notFound')
  return message || t('customers.writeError')
}

async function save() {
  if (!currentId.value || !customer.value || saving.value || !customer.value.can_manage) return
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
      p_customer_id: customer.value.id,
      p_name: form.name.trim(),
      p_phone: form.phone.trim() || null,
      p_email: email || null,
      p_address: form.address.trim() || null,
      p_notes: form.notes.trim() || null,
    })
    if (saveError) throw saveError
    complete()
    await refresh()
    pushToast({ tone: 'success', title: t('customers.updatedSuccess') })
  }
  catch (saveError) {
    actionError.value = readableError(saveError instanceof Error ? saveError.message : undefined)
  }
  finally {
    saving.value = false
  }
}

async function archive() {
  if (!currentId.value || !customer.value?.is_active || !customer.value.can_manage || archiving.value) return
  if (!await confirmation.ask(t('customers.archiveConfirm'))) return
  archiving.value = true
  actionError.value = ''
  try {
    const { error: archiveError } = await shopRpc.rpc('archive_customer', {
      p_shop_id: currentId.value,
      p_customer_id: customer.value.id,
    })
    if (archiveError) throw archiveError
    await refresh()
    pushToast({ tone: 'success', title: t('customers.archivedSuccess') })
  }
  catch (archiveError) {
    actionError.value = readableError(archiveError instanceof Error ? archiveError.message : undefined)
  }
  finally {
    archiving.value = false
  }
}

function formatDate(value: string | null) {
  if (!value) return '—'
  return new Intl.DateTimeFormat(locale.value === 'ar' ? 'ar-EG' : 'en-EG', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
}
</script>

<template>
  <div class="space-y-6">
    <NuxtLink to="/customers" class="inline-flex font-semibold text-[var(--bs-link)] underline-offset-4 hover:underline">{{ t('customers.back') }}</NuxtLink>

    <div v-if="pending" class="space-y-4">
      <div class="h-10 w-64 animate-pulse rounded-lg bg-muted" />
      <div class="h-52 animate-pulse rounded-2xl bg-muted" />
    </div>
    <div v-else-if="error" role="alert" class="rounded-2xl border border-[var(--bs-status-error)]/30 bg-[var(--bs-status-error-bg)] p-5 text-sm text-[var(--bs-status-error)]">
      <p>{{ error.message.includes('SHOP_PERMISSION_DENIED') ? t('customers.permissionDenied') : t('customers.detailError') }}</p>
      <button type="button" class="mt-3 font-bold underline" @click="refresh()">{{ t('common.retry') }}</button>
    </div>
    <div v-else-if="!customer" class="rounded-2xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">
      {{ t('customers.notFound') }}
    </div>

    <template v-else>
      <header class="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div class="flex flex-wrap items-center gap-3">
            <h1 class="text-3xl font-extrabold tracking-tight">{{ customer.name }}</h1>
            <span class="ls-badge" :class="customer.is_active ? 'bg-[var(--bs-status-success-bg)] text-[var(--bs-status-success)]' : 'bg-muted text-muted-foreground'">
              {{ customer.is_active ? t('customers.active') : t('customers.archived') }}
            </span>
          </div>
          <p class="mt-2 text-sm text-muted-foreground">{{ t('customers.details') }}</p>
        </div>
        <div v-if="customer.can_manage && customer.is_active" class="flex flex-wrap gap-2">
          <button type="button" class="ls-btn" @click="openEdit">{{ t('customers.edit') }}</button>
          <button type="button" class="ls-btn text-[var(--bs-status-error)]" :disabled="archiving" @click="archive">{{ t('customers.archive') }}</button>
        </div>
      </header>

      <p v-if="actionError && !showForm" role="alert" class="rounded-xl bg-[var(--bs-status-error-bg)] p-3 text-sm text-[var(--bs-status-error)]">{{ actionError }}</p>
      <p v-if="!customer.can_manage" class="rounded-xl border border-[var(--bs-status-info)]/25 bg-[var(--bs-status-info-bg)] p-4 text-sm">{{ t('customers.manageDenied') }}</p>
      <p class="rounded-xl border border-[var(--bs-status-info)]/25 bg-[var(--bs-status-info-bg)] p-4 text-sm">{{ t('customers.historyNotice') }}</p>

      <div class="grid gap-5 lg:grid-cols-2">
        <section class="rounded-2xl border border-border bg-card p-5">
          <h2 class="text-lg font-bold">{{ t('customers.contact') }}</h2>
          <dl class="mt-4 grid gap-4 sm:grid-cols-2">
            <div><dt class="text-xs font-bold uppercase tracking-wide text-muted-foreground">{{ t('customers.phone') }}</dt><dd class="mt-1 break-words">{{ customer.phone || '—' }}</dd></div>
            <div><dt class="text-xs font-bold uppercase tracking-wide text-muted-foreground">{{ t('customers.email') }}</dt><dd class="mt-1 break-words">{{ customer.email || '—' }}</dd></div>
            <div class="sm:col-span-2"><dt class="text-xs font-bold uppercase tracking-wide text-muted-foreground">{{ t('customers.address') }}</dt><dd class="mt-1 whitespace-pre-wrap">{{ customer.address || '—' }}</dd></div>
            <div class="sm:col-span-2"><dt class="text-xs font-bold uppercase tracking-wide text-muted-foreground">{{ t('customers.notes') }}</dt><dd class="mt-1 whitespace-pre-wrap">{{ customer.notes || '—' }}</dd></div>
          </dl>
        </section>
        <section class="rounded-2xl border border-border bg-card p-5">
          <h2 class="text-lg font-bold">{{ t('customers.details') }}</h2>
          <dl class="mt-4 space-y-4">
            <div><dt class="text-xs font-bold uppercase tracking-wide text-muted-foreground">{{ t('customers.created') }}</dt><dd class="mt-1">{{ formatDate(customer.created_at) }}</dd></div>
            <div><dt class="text-xs font-bold uppercase tracking-wide text-muted-foreground">{{ t('customers.updated') }}</dt><dd class="mt-1">{{ formatDate(customer.updated_at) }}</dd></div>
            <div v-if="customer.archived_at"><dt class="text-xs font-bold uppercase tracking-wide text-muted-foreground">{{ t('customers.archivedOn') }}</dt><dd class="mt-1">{{ formatDate(customer.archived_at) }}</dd></div>
          </dl>
        </section>
      </div>

      <BsDialog v-model:visible="showForm" :title="t('customers.editTitle')" :dirty="formDirty" :pending="saving">
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
    </template>
  </div>
</template>
