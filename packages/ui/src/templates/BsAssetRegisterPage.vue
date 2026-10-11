<script setup lang="ts">
import type { BsAssetRegisterCopy, BsAssetRegisterView, BsAssetRegisterForm, BsAssetRegisterChoices } from '../types/assetRegisterPresentation'
defineProps<{ copy: BsAssetRegisterCopy; view: BsAssetRegisterView; choices: BsAssetRegisterChoices }>()
const asOfDate = defineModel<string>('asOfDate', { required: true })
const visible = defineModel<boolean>('visible', { required: true })
const form = defineModel<BsAssetRegisterForm>('form', { required: true })
const emit = defineEmits<{ reload: []; begin: [mode: string, id: string]; select: [id: string]; post: [id: string]; save: [] }>()
function updateForm(key: keyof BsAssetRegisterForm, value: string | number | boolean | null | undefined) { form.value = { ...form.value, [key]: String(value ?? '') } }
</script>
<template>
  <BsStack gap="lg">
    <BsPageHeader
      :title="copy.assets_title"
      :subtitle="copy.assets_policy"
      :context="view.context"
      :context-label="view.contextLabel"
    >
      <template #actions>
        <BsButton
          v-if="view.canRegister"
          type="submit"
          :disabled="view.registerDisabled"
          variant="primary"
          @click="emit('begin', 'register', '')"
        >{{ copy.assets_register }}</BsButton>
      </template>
    </BsPageHeader>
    <BsText v-if="!view.canRead" role="status">{{ copy.assets_denied }}</BsText>
    <template v-else>
      <BsCard as="div" padding="md">
        <BsFloatingField :label="copy.assets_asOf">
          <BsInput id="assets-as-of" v-model="asOfDate" type="date" />
        </BsFloatingField>
      </BsCard>
      <BsText v-if="view.failed" role="alert" tone="danger">{{ copy.assets_errors_load }} <BsButton type="submit" @click="emit('reload')">{{ copy.assets_retry }}</BsButton></BsText>
      <BsSectionSkeleton v-else-if="view.pending" variant="table" :rows="5" />
      <BsEmptyState v-else-if="!view.assets.length" :title="copy.assets_empty" :description="copy.assets_emptyHint" />
      <template v-else-if="view.available">
        <BsDescriptionList :columns="3">
          <BsCard as="div" padding="md">
            <BsDescriptionTerm>{{ copy.assets_cost }}</BsDescriptionTerm>
            <BsDescriptionValue>
              <BsText as="span" dir="ltr">{{ view.totals.cost }}</BsText>
            </BsDescriptionValue>
          </BsCard>
          <BsCard as="div" padding="md">
            <BsDescriptionTerm>{{ copy.assets_accumulated }}</BsDescriptionTerm>
            <BsDescriptionValue>
              <BsText as="span" dir="ltr">{{ view.totals.accumulated }}</BsText>
            </BsDescriptionValue>
          </BsCard>
          <BsCard as="div" padding="md">
            <BsDescriptionTerm>{{ copy.assets_nbv }}</BsDescriptionTerm>
            <BsDescriptionValue data-assets-nbv>
              <BsText as="span" dir="ltr">{{ view.totals.nbv }}</BsText>
            </BsDescriptionValue>
          </BsCard>
        </BsDescriptionList>
        <BsCard as="section" padding="none" overflow="hidden">
          <BsHeading :level="2" size="h2">{{ copy.assets_registerTitle }}</BsHeading>
          <BsDataTable
            :value="view.assets"
            row-key="id"
            :label="copy.assets_registerTitle"
            :columns="[{ key: 'code', field: 'code', header: copy.assets_code }, { key: 'name', field: 'name', header: copy.assets_name }, { key: 'column3', header: copy.assets_statusLabel }, { key: 'column4', header: copy.assets_cost }, { key: 'column5', header: copy.assets_accumulated }, { key: 'column6', header: copy.assets_nbv }, { key: 'column7', header: copy.assets_actions }]"
          >
            <template #cell-column3="{ row }">{{ row.statusLabel }}</template>
            <template #cell-column4="{ row }">
              <BsText as="span" dir="ltr">{{ row.cost }}</BsText>
            </template>
            <template #cell-column5="{ row }">
              <BsText as="span" dir="ltr">{{ row.accumulated }}</BsText>
            </template>
            <template #cell-column6="{ row }">
              <BsText as="span" dir="ltr">{{ row.nbv }}</BsText>
            </template>
            <template #cell-column7="{ row }">
              <BsButton type="submit" @click="emit('select', row.id)">{{ copy.assets_review }}</BsButton>
            </template>
          </BsDataTable>
        </BsCard>
        <BsCard v-if="view.selected" as="section" padding="md">
          <BsInline gap="md" :wrap="true" align="start" justify="between">
            <BsBox>
              <BsHeading :level="2" size="h2">{{ view.selected.code }} · {{ view.selected.name }}</BsHeading>
              <BsText>{{ view.selected.description }}</BsText>
              <BsLink :to="view.selected.journalTo">{{ copy.assets_acquisitionJournal }}</BsLink>
            </BsBox>
            <BsInline gap="sm" :wrap="true"><BsButton v-for="action in view.selected.actions" :key="action.id" type="submit" :disabled="action.disabled" :variant="action.primary ? 'primary' : 'default'" @click="emit('begin', action.id, view.selected.id)">{{ action.label }}</BsButton></BsInline>
          </BsInline>
        </BsCard>
        <BsCard v-if="view.selected" as="section" padding="none" overflow="hidden">
          <BsHeading :level="2" size="h2">{{ copy.assets_schedule }}</BsHeading>
          <BsDataTable
            :value="view.schedule"
            row-key="id"
            :label="copy.assets_schedule"
            :columns="[{ key: 'periodStart', field: 'periodStart', header: copy.assets_periodStart }, { key: 'periodEnd', field: 'periodEnd', header: copy.assets_periodEnd }, { key: 'column3', header: copy.assets_depreciation }, { key: 'column4', header: copy.assets_closingNbv }, { key: 'column5', header: copy.assets_statusLabel }, { key: 'column6', header: copy.assets_actions }]"
          >
            <template #empty>{{ copy.assets_noSchedule }}</template>
            <template #cell-column3="{ row }">
              <BsText as="span" dir="ltr">{{ row.amount }}</BsText>
            </template>
            <template #cell-column4="{ row }">
              <BsText as="span" dir="ltr">{{ row.closing }}</BsText>
            </template>
            <template #cell-column5="{ row }">{{ row.statusLabel }}</template>
            <template #cell-column6="{ row }">
              <BsButton v-if="row.canPost" type="submit" :disabled="view.readOnly" @click="emit('post', row.id)">{{ copy.assets_post }}</BsButton>
            </template>
          </BsDataTable>
        </BsCard>
        <BsCard as="section" padding="none" overflow="hidden">
          <BsInline gap="none" :wrap="false" justify="between" padding="lg">
            <BsHeading :level="2" size="h2">{{ copy.assets_reconciliation }}</BsHeading>
            <BsText :data-assets-reconciled="view.reconciled" as="span">{{ view.reconciliationLabel }}</BsText>
          </BsInline>
          <BsDataTable
            :value="view.reconciliation"
            row-key="id"
            :label="copy.assets_reconciliation"
            :columns="[{ key: 'column1', header: copy.assets_account }, { key: 'column2', header: copy.assets_registerBalance }, { key: 'column3', header: copy.assets_glBalance }, { key: 'column4', header: copy.assets_variance }]"
          >
            <template #cell-column1="{ row }">{{ row.account }}</template>
            <template #cell-column2="{ row }">
              <BsText as="span" dir="ltr">{{ row.register }}</BsText>
            </template>
            <template #cell-column3="{ row }">
              <BsText as="span" dir="ltr">{{ row.gl }}</BsText>
            </template>
            <template #cell-column4="{ row }">
              <BsText as="span" dir="ltr">{{ row.variance }}</BsText>
            </template>
          </BsDataTable>
        </BsCard>
        <BsDisclosure v-if="view.selected">
          <template #summary>{{ copy.assets_history }}</template>
          <BsList :ordered="true" marker="none">
            <BsListItem v-for="event in view.events" :key="event.id"><BsText as="time">{{ event.date }}</BsText> · {{ event.kind }} · {{ event.reason }} <BsLink v-if="event.journalTo" :to="event.journalTo">{{ copy.assets_journal }}</BsLink> <BsButton v-if="event.canReverse" type="submit" @click="emit('begin', 'reverse', event.id)">{{ copy.assets_reverse }}</BsButton></BsListItem>
          </BsList>
        </BsDisclosure>
      </template>
    </template>
    <BsRecordActionDialog
      v-model:visible="visible"
      :title="view.formTitle"
      :pending="view.saving"
      :dirty="view.dirty"
      :error="view.formError"
      size="lg"
      :submit-label="copy.common_save"
      :cancel-label="copy.common_cancel"
      :submit-disabled="view.readOnly"
      @submit="emit('save')"
    >
      <template v-if="view.registerForm">
        <BsGrid :columns="2" gap="md">
          <BsFloatingField :label="copy.assets_code">
            <BsInput id="asset-code" :model-value="form.code" required @update:model-value="updateForm('code', $event)" />
          </BsFloatingField>
          <BsFloatingField :label="copy.assets_name">
            <BsInput id="asset-name" :model-value="form.name" required @update:model-value="updateForm('name', $event)" />
          </BsFloatingField>
        </BsGrid>
        <BsFloatingField :label="copy.assets_acquisitionJournal">
          <BsSelect id="asset-journal" :label="copy.assets_acquisitionJournal" :model-value="form.journal" required native @update:model-value="updateForm('journal', $event)">
            <BsSelectOption value="" />
            <BsSelectOption v-for="journal in choices.journals" :key="journal.value" :value="journal.value">{{ journal.label }}</BsSelectOption>
          </BsSelect>
        </BsFloatingField>
        <BsGrid :columns="2" gap="md">
          <BsFloatingField :label="copy.assets_acquisitionDate">
            <BsInput id="asset-acquisition-date" :model-value="form.acquisitionDate" type="date" required readonly @update:model-value="updateForm('acquisitionDate', $event)" />
          </BsFloatingField>
          <BsFloatingField :label="copy.assets_serviceDate">
            <BsInput id="asset-service-date" :model-value="form.serviceDate" type="date" :min="form.acquisitionDate" required @update:model-value="updateForm('serviceDate', $event)" />
          </BsFloatingField>
          <BsFloatingField :label="copy.assets_cost">
            <BsInput id="asset-cost" :model-value="form.cost" inputmode="decimal" required @update:model-value="updateForm('cost', $event)" />
          </BsFloatingField>
          <BsFloatingField :label="copy.assets_residual">
            <BsInput id="asset-residual" :model-value="form.residual" inputmode="decimal" required @update:model-value="updateForm('residual', $event)" />
          </BsFloatingField>
        </BsGrid>
        <BsFloatingField :label="copy.assets_costAccount">
          <BsSelect id="asset-cost-account" :label="copy.assets_costAccount" :model-value="form.costAccount" required native @update:model-value="updateForm('costAccount', $event)">
            <BsSelectOption value="" />
            <BsSelectOption v-for="account in choices.cost" :key="account.value" :value="account.value">{{ account.label }}</BsSelectOption>
          </BsSelect>
        </BsFloatingField>
        <BsFloatingField :label="copy.assets_accumulatedAccount">
          <BsSelect id="asset-accumulated-account" :label="copy.assets_accumulatedAccount" :model-value="form.accumulatedAccount" required native @update:model-value="updateForm('accumulatedAccount', $event)">
            <BsSelectOption value="" />
            <BsSelectOption v-for="account in choices.accumulated" :key="account.value" :value="account.value">{{ account.label }}</BsSelectOption>
          </BsSelect>
        </BsFloatingField>
        <BsFloatingField :label="copy.assets_expenseAccount">
          <BsSelect id="asset-expense-account" :label="copy.assets_expenseAccount" :model-value="form.expenseAccount" required native @update:model-value="updateForm('expenseAccount', $event)">
            <BsSelectOption value="" />
            <BsSelectOption v-for="account in choices.expense" :key="account.value" :value="account.value">{{ account.label }}</BsSelectOption>
          </BsSelect>
        </BsFloatingField>
        <BsFloatingField :label="copy.assets_impairmentAccount">
          <BsSelect id="asset-impairment-account" :label="copy.assets_impairmentAccount" :model-value="form.impairmentAccount" required native @update:model-value="updateForm('impairmentAccount', $event)">
            <BsSelectOption value="" />
            <BsSelectOption v-for="account in choices.expense" :key="account.value" :value="account.value">{{ account.label }}</BsSelectOption>
          </BsSelect>
        </BsFloatingField>
        <BsFloatingField :label="copy.assets_gainLossAccount">
          <BsSelect id="asset-gain-loss-account" :label="copy.assets_gainLossAccount" :model-value="form.gainLossAccount" required native @update:model-value="updateForm('gainLossAccount', $event)">
            <BsSelectOption value="" />
            <BsSelectOption v-for="account in choices.gainLoss" :key="account.value" :value="account.value">{{ account.label }}</BsSelectOption>
          </BsSelect>
        </BsFloatingField>
      </template>
      <template v-if="view.depreciationForm">
        <BsGrid :columns="2" gap="md">
          <BsFloatingField :label="copy.assets_life">
            <BsInput id="asset-life" :model-value="form.life" type="number" :min="view.constraints.lifeMin" :max="view.constraints.lifeMax" required @update:model-value="updateForm('life', $event)" />
          </BsFloatingField>
          <BsFloatingField :label="copy.assets_method">
            <BsSelect id="asset-method" :label="copy.assets_method" :model-value="form.method" native @update:model-value="updateForm('method', $event)">
              <BsSelectOption v-for="choice in choices.methods" :key="choice.value" :value="choice.value">{{ choice.label }}</BsSelectOption>
            </BsSelect>
          </BsFloatingField>
          <BsFloatingField v-if="view.rateField" :label="copy.assets_rate">
            <BsInput id="asset-rate" :model-value="form.rate" type="number" :min="view.constraints.rateMin" :max="view.constraints.rateMax" :step="view.constraints.rateStep" required @update:model-value="updateForm('rate', $event)" />
          </BsFloatingField>
          <BsFloatingField v-if="view.policyForm" :label="copy.assets_residual">
            <BsInput id="asset-policy-residual" :model-value="form.residual" required @update:model-value="updateForm('residual', $event)" />
          </BsFloatingField>
        </BsGrid>
      </template>
      <template v-if="view.disposeForm">
        <BsFloatingField :label="copy.assets_proceeds">
          <BsInput id="asset-proceeds" :model-value="form.proceeds" required @update:model-value="updateForm('proceeds', $event)" />
        </BsFloatingField>
        <BsFloatingField :label="copy.assets_proceedsAccount">
          <BsSelect id="asset-proceeds-account" :label="copy.assets_proceedsAccount" :model-value="form.proceedsAccount" native @update:model-value="updateForm('proceedsAccount', $event)">
            <BsSelectOption value="" />
            <BsSelectOption v-for="account in choices.proceeds" :key="account.value" :value="account.value">{{ account.label }}</BsSelectOption>
          </BsSelect>
        </BsFloatingField>
      </template>
      <BsFloatingField v-if="view.impairmentForm" :label="copy.assets_impairmentAmount">
        <BsInput id="asset-impairment" :model-value="form.cost" required @update:model-value="updateForm('cost', $event)" />
      </BsFloatingField>
      <template v-if="view.actionForm">
        <BsFloatingField :label="view.actionDateLabel">
          <BsInput id="asset-action-date" :model-value="form.date" type="date" required @update:model-value="updateForm('date', $event)" />
        </BsFloatingField>
        <BsFloatingField :label="copy.assets_reason">
          <BsInput id="asset-reason" :model-value="form.reason" required @update:model-value="updateForm('reason', $event)" />
        </BsFloatingField>
      </template>
    </BsRecordActionDialog>
  </BsStack>
</template>
