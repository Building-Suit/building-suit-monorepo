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
const ledgerPresentation = useLedgerPresentation()
</script>

<template>
  <BsStack gap="lg">
    <BsPageHeader
      :title="t('inventory.title')"
      :subtitle="t('inventory.policy')"
      :context="ledgerPresentation.context(undefined, undefined, asOf)"
      :context-label="ledgerPresentation.t('pageContext.label')"
    />
    <BsText role="note">{{ t('inventory.boundary') }}</BsText>
    <BsText v-if="!can('inventory.read')" role="status">{{ t('inventory.denied') }}</BsText>
    <template v-else>
      <BsForm @submit.prevent="run">
        <BsFloatingField :label="t('inventory.asOf')">
          <BsInput v-model="asOf" type="date" required />
        </BsFloatingField>
        <BsButton type="submit" :disabled="pending">{{ t('inventory.run') }}</BsButton>
        <BsButton v-if="can('inventory.configure')" type="button" :disabled="readOnly || pending" @click="begin('control')">{{ t('inventory.newControl') }}</BsButton>
        <BsButton v-if="can('inventory.configure')" type="button" :disabled="readOnly || pending" variant="primary" @click="begin('source')">{{ t('inventory.configure') }}</BsButton>
      </BsForm>
      <BsText v-if="error" role="alert" tone="danger">{{ t('inventory.loadError') }} <BsButton type="submit" @click="load">{{ t('common.retry') }}</BsButton></BsText>
      <BsSectionSkeleton v-else-if="pending" variant="table" :rows="5" />
      <template v-else-if="workspace">
        <BsText v-if="!workspace.sources.length" role="status">{{ t('inventory.noSource') }}</BsText>
        <BsCard v-for="source in workspace.sources" :key="source.id" as="section" padding="md">
          <BsStack gap="md">
            <BsHeading :level="2" size="h2">{{ source.source_key }}</BsHeading>
            <BsText :data-inventory-status="source.status" :tone="inventoryReconciles(source) ? 'success' : 'warning'">{{ t(`inventory.status.${source.status}`) }}</BsText>
            <BsDescriptionList :columns="3">
              <BsBox v-for="key in (['inventory_minor', 'inventory_gl_minor', 'inventory_variance_minor', 'cogs_minor', 'cogs_gl_minor', 'cogs_variance_minor', 'cogs_closing_minor'] as const)" :key="key">
                <BsDescriptionTerm>{{ t(`inventory.amounts.${key}`) }}</BsDescriptionTerm>
                <BsDescriptionValue>
                  <BsMoneyText :amount="source[key]" :currency="ledgerPresentation.currency(workspace.currency)" :locale="ledgerPresentation.locale" />
                </BsDescriptionValue>
              </BsBox>
            </BsDescriptionList>
            <BsText size="sm" tone="muted">{{ t('inventory.snapshot') }}: {{ source.latest_sequence ?? '—' }} · {{ t('inventory.closingNote') }}</BsText>
            <BsDescriptionList :columns="2">
              <BsBox>
                <BsDescriptionTerm>{{ t('inventory.sourceId') }}</BsDescriptionTerm>
                <BsDescriptionValue>{{ source.id }}</BsDescriptionValue>
              </BsBox>
              <BsBox>
                <BsDescriptionTerm>{{ t('inventory.actor') }}</BsDescriptionTerm>
                <BsDescriptionValue>{{ source.actor_id }}</BsDescriptionValue>
              </BsBox>
            </BsDescriptionList>
          </BsStack>
        </BsCard>
        <BsCard as="section" padding="none" overflow="hidden">
          <BsHeading :level="2" size="h2">{{ t('inventory.facts') }}</BsHeading>
          <BsDataTable
            :value="workspace.facts"
            row-key="id"
            lazy
            paginator
            :rows="25"
            :first="offset"
            :total-records="workspace.total"
            :label="t('inventory.facts')"
            :columns="[{ key: 'accounting_date', field: 'accounting_date', header: t('inventory.accountingDate') }, { key: 'effective_date', field: 'effective_date', header: t('inventory.effectiveDate') }, { key: 'column3', header: t('inventory.movement') }, { key: 'column4', header: t('inventory.valuation') }, { key: 'column5', header: t('inventory.inventoryDelta') }, { key: 'column6', header: t('inventory.cogsDelta') }, { key: 'column7', header: t('inventory.trace') }]"
            @page="page"
          >
            <template #empty>{{ t('inventory.empty') }}</template>
            <template #cell-column3="{ row: fact }">
              <BsText as="span">{{ fact.movement_id }} · {{ fact.movement_version }}</BsText>
              <BsText as="span" size="sm">{{ t(`inventory.kinds.${fact.kind}`) }}</BsText>
            </template>
            <template #cell-column4="{ row: fact }">{{ fact.valuation_id }} · {{ fact.valuation_version }}<BsText as="span" size="sm">{{ fact.costing_method }} · {{ fact.policy_version }}</BsText></template>
            <template #cell-column5="{ row: fact }">
              <BsMoneyText :amount="fact.inventory_delta_minor" :currency="ledgerPresentation.currency(workspace.currency)" :locale="ledgerPresentation.locale" />
            </template>
            <template #cell-column6="{ row: fact }">
              <BsMoneyText :amount="fact.cogs_delta_minor" :currency="ledgerPresentation.currency(workspace.currency)" :locale="ledgerPresentation.locale" />
            </template>
            <template #cell-column7="{ row: fact }">
              <BsLink :to="{ path: '/transactions', query: { q: fact.journal_reference } }">{{ fact.journal_reference }}</BsLink>
              <BsText as="span" size="xs">{{ fact.id }}</BsText>
              <BsText v-if="fact.related_fact_id" as="span" size="xs">{{ t('inventory.related') }}: {{ fact.related_fact_id }}</BsText>
              <BsText as="span" size="sm">{{ fact.reason }}</BsText>
            </template>
          </BsDataTable>
        </BsCard>
      </template>
    </template>
    <BsRecordActionDialog
      v-model:visible="visible"
      :title="t(mode === 'control' ? 'inventory.newControl' : 'inventory.configure')"
      :pending="saving"
      :dirty="dirty"
      :error="saveError"
      size="lg"
      :submit-label="t('common.save')"
      :cancel-label="t('common.cancel')"
      :submit-disabled="readOnly"
      @submit="save"
    >
      <BsFloatingField v-if="mode === 'control'" :label="t('inventory.controlName')">
        <BsInput v-model="form.name" required />
      </BsFloatingField>
      <template v-else>
        <BsText>{{ t('inventory.setupPolicy') }}</BsText>
        <BsFloatingField :label="t('inventory.sourceKey')">
          <BsInput v-model="form.source" required maxlength="200" />
        </BsFloatingField>
        <BsFloatingField :label="t('inventory.actor')">
          <BsInput v-model="form.actor" required />
        </BsFloatingField>
        <BsFloatingField :label="t('inventory.effectiveDate')">
          <BsInput v-model="form.effective" type="date" required />
        </BsFloatingField>
        <BsFloatingField :label="t('inventory.control')">
          <BsSelect v-model="form.control" required native>
            <BsSelectOption value="" />
            <BsSelectOption v-for="a in controls" :key="a.id" :value="a.id">{{ a.code }} {{ a.name }}</BsSelectOption>
          </BsSelect>
        </BsFloatingField>
        <BsFloatingField :label="t('inventory.cogs')">
          <BsSelect v-model="form.cogs" required native>
            <BsSelectOption value="" />
            <BsSelectOption v-for="a in cogs" :key="a.id" :value="a.id">{{ a.code }} {{ a.name }}</BsSelectOption>
          </BsSelect>
        </BsFloatingField>
        <BsFloatingField :label="t('inventory.offset')">
          <BsSelect v-model="form.offset" required native>
            <BsSelectOption value="" />
            <BsSelectOption v-for="a in offsets" :key="a.id" :value="a.id">{{ a.code }} {{ a.name }}</BsSelectOption>
          </BsSelect>
        </BsFloatingField>
      </template>
    </BsRecordActionDialog>
  </BsStack>
</template>
