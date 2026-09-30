<script setup lang="ts">
import type { ShopRpcDatabase } from '~/types/shopCrmRpc'

type Choice = { id: string; name: string }
const props = defineProps<{ kind: 'product' | 'supplier'; label: string; selected?: Choice; clearable?: boolean }>()
const model = defineModel<string>({ required: true })
const emit = defineEmits<{ selected: [choice: Choice] }>()
const rpc = useSupabaseClient<ShopRpcDatabase>().schema('public')
const { currentId } = useShop()
const { locale } = useI18n()
const search = ref('')
const page = ref(1)
const pageSize = 20
const copy = computed(() => locale.value === 'ar'
  ? { search: 'بحث', previous: 'السابق', next: 'التالي', failed: 'تعذّر تحميل الخيارات.', retry: 'إعادة المحاولة', loading: 'جاري تحميل الخيارات…' }
  : { search: 'Search', previous: 'Previous', next: 'Next', failed: 'Could not load choices.', retry: 'Retry', loading: 'Loading choices…' })
watch(search, () => { page.value = 1 })
const { data, pending, error, refresh } = useAsyncData(
  () => `shop-data:purchase-picker:${currentId.value}:${props.kind}:${search.value}:${page.value}`,
  async () => {
    if (!currentId.value) return { items: [] as Choice[], total: 0 }
    const args = { p_shop_id: currentId.value, p_search: search.value.trim() || null, p_page: page.value, p_page_size: pageSize }
    const result = props.kind === 'product'
      ? await rpc.rpc('list_products', { ...args, p_category_id: null })
      : await rpc.rpc('list_vendors', { ...args, p_is_active: true })
    if (result.error) throw result.error
    return result.data as { items: Choice[]; total: number }
  }, { default: () => ({ items: [] as Choice[], total: 0 }) },
)
const options = computed(() => props.selected && !data.value.items.some(item => item.id === props.selected?.id)
  ? [props.selected, ...data.value.items] : data.value.items)
function choose(value: string | number | null) {
  model.value = String(value ?? '')
  const choice = options.value.find(item => item.id === value)
  if (choice) emit('selected', choice)
}
</script>

<template>
  <div class="min-w-0 space-y-2" role="group" :aria-label="label">
    <label class="grid gap-1 text-sm font-bold">{{ copy.search }} · {{ label }}<input v-model="search" type="search" maxlength="160" class="ls-input"></label>
    <BsSelect :model-value="model" :label="label" :options="options" option-label="name" option-value="id" :show-clear="clearable" :disabled="pending || !!error" @update:model-value="choose" />
    <p v-if="pending" role="status" class="text-sm">{{ copy.loading }}</p>
    <div v-else-if="error" role="alert" class="text-sm">{{ copy.failed }} <BsButton @click="refresh()">{{ copy.retry }}</BsButton></div>
    <div v-if="data.total > pageSize" class="flex flex-wrap items-center gap-2">
      <BsButton :disabled="pending || page <= 1" :aria-label="`${copy.previous} · ${label}`" @click="page--">{{ copy.previous }}</BsButton>
      <span class="text-sm" aria-live="polite">{{ page }} / {{ Math.ceil(data.total / pageSize) }}</span>
      <BsButton :disabled="pending || page * pageSize >= data.total" :aria-label="`${copy.next} · ${label}`" @click="page++">{{ copy.next }}</BsButton>
    </div>
  </div>
</template>
