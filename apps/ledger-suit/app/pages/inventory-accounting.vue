<script setup lang="ts">
import { formatPresentationMoney } from '@building-suit/ux'
import type { BsInventoryAccountingCopy, BsInventoryAccountingView, BsInventoryAccountingForm, BsInventoryAccountingChoices } from '@building-suit/ui/types/inventoryAccountingPresentation'
import { inventoryReconciles } from '~/utils/inventoryAccounting'

definePageMeta({ layout: 'default' })
const { t, locale } = useI18n()
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
const ledgerPresentation = useLedgerPresentation()

const inventoryCopy = computed<BsInventoryAccountingCopy>(() => ({
  common_cancel: t('common.cancel'),
  common_retry: t('common.retry'),
  common_save: t('common.save'),
  inventory_accountingDate: t('inventory.accountingDate'),
  inventory_actor: t('inventory.actor'),
  inventory_asOf: t('inventory.asOf'),
  inventory_boundary: t('inventory.boundary'),
  inventory_closingNote: t('inventory.closingNote'),
  inventory_cogs: t('inventory.cogs'),
  inventory_cogsDelta: t('inventory.cogsDelta'),
  inventory_configure: t('inventory.configure'),
  inventory_control: t('inventory.control'),
  inventory_controlName: t('inventory.controlName'),
  inventory_denied: t('inventory.denied'),
  inventory_effectiveDate: t('inventory.effectiveDate'),
  inventory_empty: t('inventory.empty'),
  inventory_facts: t('inventory.facts'),
  inventory_inventoryDelta: t('inventory.inventoryDelta'),
  inventory_loadError: t('inventory.loadError'),
  inventory_movement: t('inventory.movement'),
  inventory_newControl: t('inventory.newControl'),
  inventory_noSource: t('inventory.noSource'),
  inventory_offset: t('inventory.offset'),
  inventory_policy: t('inventory.policy'),
  inventory_related: t('inventory.related'),
  inventory_run: t('inventory.run'),
  inventory_setupPolicy: t('inventory.setupPolicy'),
  inventory_snapshot: t('inventory.snapshot'),
  inventory_sourceId: t('inventory.sourceId'),
  inventory_sourceKey: t('inventory.sourceKey'),
  inventory_title: t('inventory.title'),
  inventory_trace: t('inventory.trace'),
  inventory_valuation: t('inventory.valuation'),
  pageContext_label: t('pageContext.label'),
}))

const inventoryForm = computed<BsInventoryAccountingForm>({ get: () => ({ ...form }), set: value => Object.assign(form, value) })
const inventoryAmount = (value: string | number, currency: string) => formatPresentationMoney(value, { currency: ledgerPresentation.currency(currency), locale: locale.value, unit: 'minor', numberingSystem: 'latn' })
const inventoryView = computed<BsInventoryAccountingView>(() => ({ context: ledgerPresentation.context(undefined, undefined, asOf.value), contextLabel: t('pageContext.label'), canRead: can('inventory.read'), canConfigure: can('inventory.configure'), pending: pending.value, failed: Boolean(error.value), available: Boolean(workspace.value), configurationDisabled: readOnly.value || pending.value, sources: (workspace.value?.sources ?? []).map(source => ({ id: source.id, key: source.source_key, status: source.status, statusLabel: t(`inventory.status.${source.status}`), tone: inventoryReconciles(source) ? 'success' : 'warning', amounts: (['inventory_minor', 'inventory_gl_minor', 'inventory_variance_minor', 'cogs_minor', 'cogs_gl_minor', 'cogs_variance_minor', 'cogs_closing_minor'] as const).map(key => ({ id: key, label: t(`inventory.amounts.${key}`), value: inventoryAmount(source[key], workspace.value!.currency) })), sequence: String(source.latest_sequence ?? '—'), actor: source.actor_id })), facts: (workspace.value?.facts ?? []).map(fact => ({ id: fact.id, accountingDate: fact.accounting_date, effectiveDate: fact.effective_date, movement: `${fact.movement_id} · ${fact.movement_version}`, kind: t(`inventory.kinds.${fact.kind}`), valuation: `${fact.valuation_id} · ${fact.valuation_version}`, policy: `${fact.costing_method} · ${fact.policy_version}`, inventory: inventoryAmount(fact.inventory_delta_minor, workspace.value!.currency), cogs: inventoryAmount(fact.cogs_delta_minor, workspace.value!.currency), journal: fact.journal_reference, journalTo: `/transactions?q=${encodeURIComponent(fact.journal_reference)}`, related: fact.related_fact_id ?? '', reason: fact.reason ?? '' })), first: offset.value, total: workspace.value?.total ?? 0, pageSize: 25, controlMode: mode.value === 'control', formTitle: t(mode.value === 'control' ? 'inventory.newControl' : 'inventory.configure'), saving: saving.value, dirty: dirty.value, formError: saveError.value, readOnly: readOnly.value, sourceKeyMaxLength: 200 }))
const inventoryChoices = computed<BsInventoryAccountingChoices>(() => ({ controls: controls.value.map(a => ({ value: a.id, label: `${a.code} ${a.name}` })), cogs: cogs.value.map(a => ({ value: a.id, label: `${a.code} ${a.name}` })), offsets: offsets.value.map(a => ({ value: a.id, label: `${a.code} ${a.name}` })) }))
function beginInventory(mode: string) { if (mode === 'control' || mode === 'source') begin(mode) }
function inventoryPage(first: number) { page({ first }) }
</script>
<template>
  <BsInventoryAccountingPage v-model:as-of="asOf" v-model:visible="visible" v-model:form="inventoryForm" :copy="inventoryCopy" :view="inventoryView" :choices="inventoryChoices" @run="run" @reload="load" @begin="beginInventory" @save="save" @page="inventoryPage" />
</template>
