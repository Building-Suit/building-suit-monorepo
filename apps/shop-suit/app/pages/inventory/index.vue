<script setup lang="ts">
import type { ShopRpcDatabase } from '~/types/shopCrmRpc'
const confirmation = useConfirmation()

definePageMeta({ layout: 'default', middleware: ['auth'] })

type StockRow = {
  shop_id: string
  product_id: string
  name: string
  sku: string | null
  sale_price: number
  quantity_on_hand: number
}
type Subscription = { plan_id: string }

const supabase = useSupabaseClient()
const shopRpc = useSupabaseClient<ShopRpcDatabase>().schema('public')
const { locale } = useI18n()
const { current, currentId, currentMembership, isOwner, loading: shopLoading } = useShop()
const { data: plans } = usePlans()
const isArabic = computed(() => locale.value === 'ar')
const mode = ref<'receive' | 'writeoff'>('receive')
const productId = ref('')
const quantity = ref(1)
const unitCost = ref(0)
const note = ref('')
const { visible: adjustmentOpen, pending: pendingWrite, dirty: adjustmentDirty } = useRecordAction(() => ({ mode: mode.value, productId: productId.value, quantity: quantity.value, unitCost: unitCost.value, note: note.value }))
const actionError = ref('')
const requestId = ref<string | null>(null)

const copy = computed(() => isArabic.value ? {
  title: 'المخزون', subtitle: 'استلام يدوي وشطب كميات مع سجل دفعات وحركة محفوظة.',
  manualOnly: 'المشتريات من الموردين والبيع الآلي من المخزون قيد العمل. هذه شاشة التعديلات اليدوية فقط.',
  planUnavailable: 'المخزون غير مشمول في خطتك الحالية. يتطلب خطة Pro.',
  noShop: 'أنشئ متجرًا أولًا من لوحة التحكم.', dashboard: 'لوحة التحكم',
  noProducts: 'أضف منتجًا أولًا قبل تسجيل المخزون.', products: 'المنتجات',
  product: 'المنتج', onHand: 'الكمية المتاحة', price: 'سعر البيع',
  receive: 'استلام مخزون', writeoff: 'شطب مخزون', quantity: 'الكمية', unitCost: 'تكلفة الوحدة',
  note: 'السبب أو الملاحظة', submitReceive: 'تسجيل الاستلام', submitWriteoff: 'تسجيل الشطب', saving: 'جاري الحفظ...',
  readError: 'تعذّر تحميل المخزون.', retry: 'إعادة المحاولة',
  invalid: 'اكتب كمية صحيحة حتى 3 منازل عشرية، وتكلفة غير سالبة للاستلام، وسببًا للشطب.',
  insufficient: 'الكمية المطلوبة أكبر من المخزون المتاح.', access: 'انتهت التجربة أو ليست لديك صلاحية التعديل.',
  writeError: 'تعذّر تسجيل حركة المخزون.', requestConflict: 'تعارض في طلب المخزون. غيّر النموذج وحاول مرة أخرى.',
  confirmWriteoff: 'تأكيد شطب الكمية من المخزون؟',
} : {
  title: 'Inventory', subtitle: 'Manual receipts and write-offs with batch and movement history.',
  manualOnly: 'Supplier purchases and automatic stock deduction on sales are in progress. This screen handles manual adjustments only.',
  planUnavailable: 'Inventory is not included in your current plan. It requires Pro.',
  noShop: 'Create a shop from the dashboard first.', dashboard: 'Dashboard',
  noProducts: 'Add a product before recording stock.', products: 'Products',
  product: 'Product', onHand: 'On hand', price: 'Sale price',
  receive: 'Receive stock', writeoff: 'Write off stock', quantity: 'Quantity', unitCost: 'Unit cost',
  note: 'Reason or note', submitReceive: 'Record receipt', submitWriteoff: 'Record write-off', saving: 'Saving...',
  readError: 'Could not load inventory.', retry: 'Retry',
  invalid: 'Enter a quantity up to 3 decimal places, nonnegative receipt cost, and a write-off reason.',
  insufficient: 'The requested quantity exceeds stock on hand.', access: 'Your trial has ended or you cannot edit stock.',
  writeError: 'Could not record the stock movement.', requestConflict: 'The stock request conflicts with an earlier one. Change the form and retry.',
  confirmWriteoff: 'Confirm this stock write-off?',
})

const { data: subscription, error: subscriptionError } = useAsyncData(
  'shop-data:inventory-subscription', async () => {
    if (!currentId.value || !isOwner.value || !currentMembership.value) return null
    const { data, error } = await supabase.from('subscriptions')
      .select('plan_id').eq('profile_id', currentMembership.value.profile_id)
      .maybeSingle()
    if (error) throw error
    return data as Subscription | null
  }, { watch: [currentId], default: () => null },
)
const inventoryEnabled = computed(() => {
  if (!subscription.value) return false
  return plans.value?.find(plan => plan.id === subscription.value?.plan_id)?.features?.inventory === true
})

const { data: stock, pending, error, refresh } = useAsyncData(
  'shop-data:product-stock', async () => {
    if (!currentId.value) return []
    const { data, error: queryError } = await supabase.from('product_stock')
      .select('shop_id,product_id,name,sku,sale_price,quantity_on_hand')
      .eq('shop_id', currentId.value).order('name', { ascending: true }).limit(1000)
    if (queryError) throw queryError
    return (data ?? []) as StockRow[]
  }, { watch: [currentId], default: () => [] },
)

watch([mode, productId, quantity, unitCost, note, currentId], () => {
  requestId.value = null
  actionError.value = ''
})
watch(stock, rows => {
  if (!rows?.some(row => row.product_id === productId.value)) {
    productId.value = rows?.[0]?.product_id ?? ''
  }
}, { immediate: true })

function readableError(message?: string) {
  if (message === 'INSUFFICIENT_STOCK') return copy.value.insufficient
  if (message === 'INVENTORY_NOT_IN_PLAN') return copy.value.planUnavailable
  if (message === 'SHOP_SUBSCRIPTION_INACTIVE' || message === 'SHOP_PERMISSION_DENIED') return copy.value.access
  if (message === 'STOCK_REQUEST_CONFLICT') return copy.value.requestConflict
  return message || copy.value.writeError
}

async function saveAdjustment() {
  if (!currentId.value || !isOwner.value || !inventoryEnabled.value || pendingWrite.value) return
  const amount = Number(quantity.value)
  const cost = Number(unitCost.value)
  if (!productId.value || !Number.isFinite(amount) || amount <= 0 || amount > 1000000
    || Math.abs(Math.round(amount * 1000) - amount * 1000) > 0.000001
    || (mode.value === 'receive' && (!Number.isFinite(cost) || cost < 0 || cost > 999999999.99))
    || (mode.value === 'writeoff' && note.value.trim().length < 3)) {
    actionError.value = copy.value.invalid
    return
  }
  if (mode.value === 'writeoff' && !await confirmation.ask(copy.value.confirmWriteoff)) return
  actionError.value = ''
  requestId.value ||= crypto.randomUUID()
  pendingWrite.value = true
  try {
    const { error: writeError } = await shopRpc.rpc('adjust_stock', {
      p_request_id: requestId.value,
      p_shop_id: currentId.value,
      p_product_id: productId.value,
      p_quantity_change: mode.value === 'receive' ? amount : -amount,
      p_unit_cost: mode.value === 'receive' ? cost : null,
      p_note: note.value.trim() || null,
    })
    if (writeError) throw writeError
    requestId.value = null
    quantity.value = 1
    unitCost.value = 0
    note.value = ''
    adjustmentOpen.value = false
    await refresh()
  } catch (error) {
    actionError.value = readableError(error instanceof Error ? error.message : undefined)
  } finally {
    pendingWrite.value = false
  }
}

function money(value: number) {
  return new Intl.NumberFormat(isArabic.value ? 'ar-EG' : 'en-EG', {
    style: 'currency', currency: 'EGP', maximumFractionDigits: 2,
  }).format(value)
}
</script>

<template>
  <div class="space-y-6">
    <header><h1 class="text-3xl font-extrabold tracking-tight">{{ copy.title }}</h1><p class="mt-2 text-sm text-muted-foreground">{{ copy.subtitle }}</p></header>
    <div v-if="!current && !shopLoading" class="rounded-2xl border border-border bg-card p-8 text-center text-sm"><p>{{ copy.noShop }}</p><NuxtLink to="/dashboard" class="mt-3 inline-block font-bold text-[var(--bs-link)] underline">{{ copy.dashboard }}</NuxtLink></div>
    <template v-else-if="current">
      <p class="rounded-xl border border-[var(--bs-status-info)]/25 bg-[var(--bs-status-info-bg)] p-4 text-sm dark:bg-[var(--bs-status-info-bg)]">{{ copy.manualOnly }}</p>
      <p v-if="subscriptionError" role="alert" class="rounded-xl bg-[var(--bs-status-error-bg)] p-4 text-sm text-[var(--bs-status-error)]">{{ copy.readError }}</p>
      <p v-if="isOwner && !subscriptionError && !inventoryEnabled" class="rounded-xl border border-[var(--bs-status-warning)]/25 bg-[var(--bs-status-warning-bg)] p-4 text-sm dark:bg-[var(--bs-status-warning-bg)]">{{ copy.planUnavailable }}</p>

      <div v-if="isOwner && inventoryEnabled && stock?.length"><button type="button" class="ls-btn ls-btn-primary" @click="mode = 'receive'; adjustmentOpen = true">{{ copy.receive }}</button><button type="button" class="ls-btn ms-2" @click="mode = 'writeoff'; adjustmentOpen = true">{{ copy.writeoff }}</button></div>
      <BsDialog v-model:visible="adjustmentOpen" :title="mode === 'receive' ? copy.receive : copy.writeoff" :dirty="adjustmentDirty" :pending="pendingWrite"><form class="space-y-4 " @submit.prevent="saveAdjustment">
        <div class="flex flex-wrap gap-2"><button type="button" class="ls-btn" :class="mode === 'receive' ? 'border-[var(--bs-accent)] bg-[var(--bs-accent)]/10' : 'border-border'" @click="mode = 'receive'">{{ copy.receive }}</button><button type="button" class="ls-btn" :class="mode === 'writeoff' ? 'border-[var(--bs-accent)] bg-[var(--bs-accent)]/10' : 'border-border'" @click="mode = 'writeoff'">{{ copy.writeoff }}</button></div>
        <p v-if="actionError" role="alert" class="rounded-lg bg-[var(--bs-status-error-bg)] p-3 text-sm text-[var(--bs-status-error)]">{{ actionError }}</p>
        <div class="grid gap-4 sm:grid-cols-2">
          <label class="space-y-2 text-sm font-bold">{{ copy.product }}<select v-model="productId" required class="ls-input"><option v-for="row in stock" :key="row.product_id" :value="row.product_id">{{ row.name }} ({{ row.quantity_on_hand }})</option></select></label>
          <label class="space-y-2 text-sm font-bold">{{ copy.quantity }}<input v-model.number="quantity" type="number" min="0.001" max="1000000" step="0.001" required class="ls-input"></label>
          <label v-if="mode === 'receive'" class="space-y-2 text-sm font-bold">{{ copy.unitCost }}<input v-model.number="unitCost" type="number" min="0" step="0.01" required class="ls-input"></label>
          <label class="space-y-2 text-sm font-bold" :class="mode === 'writeoff' ? 'sm:col-span-2' : ''">{{ copy.note }}<input v-model="note" type="text" maxlength="500" :required="mode === 'writeoff'" class="ls-input"></label>
        </div>
        <button type="submit" class="ls-btn ls-btn-primary" :disabled="pendingWrite">{{ pendingWrite ? copy.saving : mode === 'receive' ? copy.submitReceive : copy.submitWriteoff }}</button>
      </form></BsDialog>

      <div class="overflow-hidden rounded-2xl border border-border bg-card">
        <div class="border-b border-border px-5 py-4"><h2 class="font-extrabold">{{ copy.onHand }}</h2></div>
        <div v-if="pending" class="space-y-3 p-5"><div v-for="index in 3" :key="index" class="h-11 animate-pulse rounded-lg bg-muted" /></div>
        <p v-else-if="error" role="alert" class="p-5 text-sm text-[var(--bs-status-error)]">{{ copy.readError }} <button type="button" class="underline" @click="refresh()">{{ copy.retry }}</button></p>
        <div v-else-if="stock?.length" class="overflow-x-auto"><BsDataTable :value="stock" data-key="product_id" :row-class="() => 'border-t border-border'">
  <Column header-class="px-5 py-3 text-start" body-class="px-5 py-4 font-bold">
    <template #header>{{ copy.product }}</template>
    <template #body="{ data: row }">{{ row.name }}<span v-if="row.sku" class="ms-2 text-xs font-normal text-muted-foreground">{{ row.sku }}</span></template>
  </Column>
  <Column header-class="px-5 py-3 text-start" body-class="px-5 py-4">
    <template #header>{{ copy.onHand }}</template>
    <template #body="{ data: row }">{{ row.quantity_on_hand }}</template>
  </Column>
  <Column header-class="px-5 py-3 text-end" body-class="px-5 py-4 text-end">
    <template #header>{{ copy.price }}</template>
    <template #body="{ data: row }">{{ money(Number(row.sale_price)) }}</template>
  </Column>
</BsDataTable></div>
        <div v-else class="p-8 text-center text-sm text-muted-foreground"><p>{{ copy.noProducts }}</p><NuxtLink to="/products" class="mt-3 inline-block font-bold text-[var(--bs-link)] underline">{{ copy.products }}</NuxtLink></div>
      </div>
    </template>
  </div>
</template>
