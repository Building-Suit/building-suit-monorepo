<script setup lang="ts">
import { inventoryReconciles } from '~/utils/inventoryAccounting'

definePageMeta({ layout: 'default' })
const { t } = useI18n()
const { currentId, can } = useTenant()
const user = useSupabaseUser()
const { readOnly } = useBilling()
const toasts = useToasts()
const { asOf, offset, workspace, pending, error, load, command } = useInventoryAccounting()
useHead({ title: () => `${t('inventory.title')} · ${t('app.name')}` })
const form = reactive({ source: '', actor: '', effective: asOf.value, control: '', cogs: '', offset: '', name: '' })
const { visible, pending: saving, dirty, open, complete } = useRecordAction(() => form)
const mode = ref<'source' | 'control'>('source')
const saveError = ref('')
const controls = computed(() => workspace.value?.accounts.filter(a => a.role === 'control' && a.subledger === 'inventory') ?? [])
const cogs = computed(() => workspace.value?.accounts.filter(a => a.role === 'posting' && a.subtype === 'cost_of_sales') ?? [])
const offsets = computed(() => workspace.value?.accounts.filter(a => a.role === 'posting' && !['inventory', 'cost_of_sales'].includes(a.subtype)) ?? [])
watch([currentId, () => user.value?.id], () => {
  visible.value = false; saveError.value = ''
  Object.assign(form, { source: '', actor: '', control: '', cogs: '', offset: '', name: '' })
}, { flush: 'sync' })
function begin(next: 'source' | 'control') {
  mode.value = next
  Object.assign(form, { source: '', actor: '', effective: asOf.value, control: '', cogs: '', offset: '', name: '' })
  saveError.value = ''; open()
}
async function save() {
  if (saving.value || readOnly.value) return
  const org = currentId.value; const actor = user.value?.id
  saving.value = true; saveError.value = ''
  try {
    if (mode.value === 'control') await command('create_inventory_control_account', { p_name: form.name })
    else await command('configure_inventory_source', { p_source_key: form.source, p_actor_id: form.actor, p_effective_from: form.effective,
      p_control_account_id: form.control, p_cogs_account_id: form.cogs, p_offset_account_id: form.offset })
    if (org !== currentId.value || actor !== user.value?.id) return
    complete(); toasts.success(t('inventory.saved'))
  }
  catch { if (org === currentId.value && actor === user.value?.id) saveError.value = t('inventory.saveError') }
  finally { saving.value = false }
}
function run() { offset.value = 0; void load() }
function page(event: { first: number }) { offset.value = event.first; void load() }
</script>

<template>
  <div class="space-y-6">
    <header><h1 class="text-h1 font-bold">{{ t('inventory.title') }}</h1><p class="mt-2 text-fg-muted">{{ t('inventory.policy') }}</p></header>
    <p class="ls-card p-4" role="note">{{ t('inventory.boundary') }}</p>
    <p v-if="!can('inventory.read')" role="status">{{ t('inventory.denied') }}</p>
    <template v-else>
      <form class="ls-card flex flex-wrap items-end gap-4 p-4" @submit.prevent="run">
        <FloatingField :label="t('inventory.asOf')"><input v-model="asOf" type="date" class="ls-input" required></FloatingField>
        <button class="ls-btn" :disabled="pending">{{ t('inventory.run') }}</button>
        <button v-if="can('inventory.configure')" type="button" class="ls-btn" :disabled="readOnly || pending" @click="begin('control')">{{ t('inventory.newControl') }}</button>
        <button v-if="can('inventory.configure')" type="button" class="ls-btn ls-btn-primary" :disabled="readOnly || pending" @click="begin('source')">{{ t('inventory.configure') }}</button>
      </form>
      <p v-if="error" class="ls-error" role="alert">{{ t('inventory.loadError') }} <button class="ls-btn" @click="load">{{ t('common.retry') }}</button></p>
      <SectionSkeleton v-else-if="pending" variant="table" :rows="5" />
      <template v-else-if="workspace">
        <p v-if="!workspace.sources.length" class="ls-card p-5" role="status">{{ t('inventory.noSource') }}</p>
        <section v-for="source in workspace.sources" :key="source.id" class="ls-card space-y-4 p-5">
          <h2 class="text-h2 font-bold">{{ source.source_key }}</h2>
          <p :data-inventory-status="source.status" :class="inventoryReconciles(source) ? 'text-success' : 'text-warning'">{{ t(`inventory.status.${source.status}`) }}</p>
          <dl class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div v-for="key in (['inventory_minor', 'inventory_gl_minor', 'inventory_variance_minor', 'cogs_minor', 'cogs_gl_minor', 'cogs_variance_minor', 'cogs_closing_minor'] as const)" :key="key"><dt>{{ t(`inventory.amounts.${key}`) }}</dt><dd><MoneyText :amount-minor="source[key]" :currency="workspace.currency" /></dd></div>
          </dl>
          <p class="text-sm text-fg-muted">{{ t('inventory.snapshot') }}: {{ source.latest_sequence ?? '—' }} · {{ t('inventory.closingNote') }}</p>
          <dl class="grid gap-2 break-all text-sm sm:grid-cols-2"><div><dt>{{ t('inventory.sourceId') }}</dt><dd>{{ source.id }}</dd></div><div><dt>{{ t('inventory.actor') }}</dt><dd>{{ source.actor_id }}</dd></div></dl>
        </section>
        <section class="ls-card overflow-hidden">
          <h2 class="p-4 text-h2 font-bold">{{ t('inventory.facts') }}</h2>
          <BsDataTable :value="workspace.facts" data-key="id" lazy paginator :rows="25" :first="offset" :total-records="workspace.total" :table-props="{ 'aria-label': t('inventory.facts') }" @page="page">
            <template #empty>{{ t('inventory.empty') }}</template>
            <Column field="accounting_date" :header="t('inventory.accountingDate')" />
            <Column field="effective_date" :header="t('inventory.effectiveDate')" />
            <Column :header="t('inventory.movement')"><template #body="{ data: fact }"><span>{{ fact.movement_id }} · {{ fact.movement_version }}</span><span class="block text-sm">{{ t(`inventory.kinds.${fact.kind}`) }}</span></template></Column>
            <Column :header="t('inventory.valuation')"><template #body="{ data: fact }">{{ fact.valuation_id }} · {{ fact.valuation_version }}<span class="block text-sm">{{ fact.costing_method }} · {{ fact.policy_version }}</span></template></Column>
            <Column :header="t('inventory.inventoryDelta')"><template #body="{ data: fact }"><MoneyText :amount-minor="fact.inventory_delta_minor" :currency="workspace.currency" /></template></Column>
            <Column :header="t('inventory.cogsDelta')"><template #body="{ data: fact }"><MoneyText :amount-minor="fact.cogs_delta_minor" :currency="workspace.currency" /></template></Column>
            <Column :header="t('inventory.trace')"><template #body="{ data: fact }"><NuxtLink :to="{ path: '/transactions', query: { q: fact.journal_reference } }" class="text-link underline">{{ fact.journal_reference }}</NuxtLink><span class="block break-all text-xs">{{ fact.id }}</span><span v-if="fact.related_fact_id" class="block break-all text-xs">{{ t('inventory.related') }}: {{ fact.related_fact_id }}</span><span class="block text-sm">{{ fact.reason }}</span></template></Column>
          </BsDataTable>
        </section>
      </template>
    </template>
    <BsDialog v-model:visible="visible" :title="t(mode === 'control' ? 'inventory.newControl' : 'inventory.configure')" :pending="saving" :dirty="dirty" size="lg">
      <template #default="{ close }"><form class="space-y-4 p-5" @submit.prevent="save">
        <p v-if="saveError" class="ls-error" role="alert">{{ saveError }}</p>
        <FloatingField v-if="mode === 'control'" :label="t('inventory.controlName')"><input v-model="form.name" class="ls-input" required></FloatingField>
        <template v-else>
          <p>{{ t('inventory.setupPolicy') }}</p>
          <FloatingField :label="t('inventory.sourceKey')"><input v-model="form.source" class="ls-input" required maxlength="200"></FloatingField>
          <FloatingField :label="t('inventory.actor')"><input v-model="form.actor" class="ls-input" required></FloatingField>
          <FloatingField :label="t('inventory.effectiveDate')"><input v-model="form.effective" type="date" class="ls-input" required></FloatingField>
          <FloatingField :label="t('inventory.control')"><select v-model="form.control" class="ls-input" required><option value="" /><option v-for="a in controls" :key="a.id" :value="a.id">{{ a.code }} {{ a.name }}</option></select></FloatingField>
          <FloatingField :label="t('inventory.cogs')"><select v-model="form.cogs" class="ls-input" required><option value="" /><option v-for="a in cogs" :key="a.id" :value="a.id">{{ a.code }} {{ a.name }}</option></select></FloatingField>
          <FloatingField :label="t('inventory.offset')"><select v-model="form.offset" class="ls-input" required><option value="" /><option v-for="a in offsets" :key="a.id" :value="a.id">{{ a.code }} {{ a.name }}</option></select></FloatingField>
        </template>
        <div class="flex justify-end gap-2"><button type="button" class="ls-btn" @click="close">{{ t('common.cancel') }}</button><button class="ls-btn ls-btn-primary" :disabled="saving || readOnly">{{ t('common.save') }}</button></div>
      </form></template>
    </BsDialog>
  </div>
</template>
