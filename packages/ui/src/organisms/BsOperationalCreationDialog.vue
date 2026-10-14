<script setup lang="ts">
import type { BsOperationalCreationView, BsOperationalCreationCopy, BsCommitmentDraft, BsRecurringDraft, BsCounterpartyDraft, BsTagDraft, BsOperationalCreationOptions } from '../types/operationalCreationPresentation'
defineProps<{ view: BsOperationalCreationView; copy: BsOperationalCreationCopy; options: BsOperationalCreationOptions }>()
const commitment = defineModel<BsCommitmentDraft>('commitment', { required: true })
const recurring = defineModel<BsRecurringDraft>('recurring', { required: true })
const counterparty = defineModel<BsCounterpartyDraft>('counterparty', { required: true })
const tag = defineModel<BsTagDraft>('tag', { required: true })
const emit = defineEmits<{ close: []; save: [] }>()
function commitmentField(key: keyof BsCommitmentDraft, value: string | number | boolean | unknown[] | null | undefined) { commitment.value = { ...commitment.value, [key]: key === 'reminderDays' ? Number(value) : key === 'autoConvert' ? Boolean(value) : String(value ?? '') } }
function recurringField(key: keyof BsRecurringDraft, value: string | number | null | undefined) { recurring.value = { ...recurring.value, [key]: key === 'intervalCount' ? Number(value) : String(value ?? '') } }
function counterpartyField(key: keyof BsCounterpartyDraft, value: string | number | null | undefined) { counterparty.value = { ...counterparty.value, [key]: String(value ?? '') } }
function tagField(key: keyof BsTagDraft, value: string | number | null | undefined) { tag.value = { ...tag.value, [key]: String(value ?? '') } }
</script>
<template>
          <BsRecordActionDialog
            v-if="view.visible"
            :visible="true"
            :title="view.title"
            size="lg"
            :dirty="view.dirty"
            :pending="view.pending"
            :error="view.error"
            :submit-label="view.submitLabel"
            :cancel-label="copy.commonCancel"
            @update:visible="(value: boolean) => { if (!value) emit('close') }"
            @submit="emit('save')"
          >
            <BsBox as="main" grow>
              <BsUsageMeter
                v-if="view.usage"
                compact
                :item="view.usage"
              />
              <BsGrid v-if="view.tab === 'commitments' && view.canCreate" :columns="2" gap="md">
                <BsFloatingField :label="copy.operationsName">
                  <BsInput :model-value="commitment.title" :placeholder="copy.operationsName" required @update:model-value="commitmentField('title', $event)" />
                </BsFloatingField>
                <BsFloatingField :label="copy.transactionsDescription">
                  <BsInput :model-value="commitment.description" :placeholder="copy.transactionsDescription" @update:model-value="commitmentField('description', $event)" />
                </BsFloatingField>
                <BsFloatingField :label="copy.transactionsAmount">
                  <BsInput :model-value="commitment.amount" inputmode="decimal" :placeholder="copy.transactionsAmount" required @update:model-value="commitmentField('amount', $event)" />
                </BsFloatingField>
                <BsFloatingField :label="copy.addDueDate">
                  <BsInput :model-value="commitment.dueDate" type="date" required @update:model-value="commitmentField('dueDate', $event)" />
                </BsFloatingField>
                <BsFloatingField :label="copy.transactionsType">
                  <BsSelect :model-value="commitment.type" native @update:model-value="commitmentField('type', $event)">
                    <BsSelectOption value="payable">{{ copy.operationsPayable }}</BsSelectOption>
                    <BsSelectOption value="receivable">{{ copy.operationsReceivable }}</BsSelectOption>
                    <BsSelectOption value="scheduled_expense">{{ copy.operationsScheduledExpense }}</BsSelectOption>
                    <BsSelectOption value="scheduled_income">{{ copy.operationsScheduledIncome }}</BsSelectOption>
                  </BsSelect>
                </BsFloatingField>
                <BsFloatingField :label="copy.addCategory">
                  <BsSelect :model-value="commitment.categoryId" native @update:model-value="commitmentField('categoryId', $event)">
                    <BsSelectOption value="">{{ copy.addChooseCategory }}</BsSelectOption>
                    <BsSelectOption
                      v-for="c in (['receivable','scheduled_income'].includes(commitment.type) ? options.incomeCategories : options.expenseCategories)"
                      :key="c.id"
                      :value="c.id"
                    >{{ c.name }}</BsSelectOption>
                  </BsSelect>
                </BsFloatingField>
                <BsFloatingField :label="copy.addCounterparty">
                  <BsSelect :model-value="commitment.counterpartyId" native @update:model-value="commitmentField('counterpartyId', $event)">
                    <BsSelectOption value="">{{ copy.addCounterparty }}</BsSelectOption>
                    <BsSelectOption v-for="party in options.counterparties" :key="party.id" :value="party.id">{{ party.name }}</BsSelectOption>
                  </BsSelect>
                </BsFloatingField>
                <BsFloatingField :label="copy.addChooseAccount">
                  <BsSelect :model-value="commitment.paymentAccountId" :required="commitment.autoConvert" native @update:model-value="commitmentField('paymentAccountId', $event)">
                    <BsSelectOption value="">{{ copy.addChooseAccount }}</BsSelectOption>
                    <BsSelectOption v-for="a in options.paymentAccounts" :key="a.id" :value="a.id">{{ a.name }}</BsSelectOption>
                  </BsSelect>
                </BsFloatingField>
                <BsFieldLabel><BsCheckbox :model-value="commitment.autoConvert" bare @update:model-value="commitmentField('autoConvert', $event)" />{{ copy.operationsAutoConvert }}</BsFieldLabel>
                <BsFieldLabel>{{ copy.operationsReminderDays }} <BsInput :model-value="commitment.reminderDays" type="number" min="0" max="90" @update:model-value="commitmentField('reminderDays', $event)" /></BsFieldLabel>
              </BsGrid>
              <BsGrid v-else-if="view.tab === 'recurring' && view.canCreate" :columns="3" gap="md">
                <BsFloatingField :label="copy.operationsName">
                  <BsInput :model-value="recurring.name" :placeholder="copy.operationsName" required @update:model-value="recurringField('name', $event)" />
                </BsFloatingField>
                <BsFloatingField v-if="recurring.transactionType !== 'liability_payment'" :label="copy.transactionsAmount">
                  <BsInput :model-value="recurring.amount" inputmode="decimal" :placeholder="copy.transactionsAmount" required @update:model-value="recurringField('amount', $event)" />
                </BsFloatingField>
                <BsFloatingField :label="copy.transactionsType">
                  <BsSelect :model-value="recurring.transactionType" native @update:model-value="recurringField('transactionType', $event)">
                    <BsSelectOption value="expense">{{ copy.typesExpense }}</BsSelectOption>
                    <BsSelectOption value="income">{{ copy.typesIncome }}</BsSelectOption>
                    <BsSelectOption value="liability_payment">{{ copy.typesLiability_payment }}</BsSelectOption>
                  </BsSelect>
                </BsFloatingField>
                <BsFloatingField v-if="recurring.transactionType !== 'liability_payment'" :label="copy.addCategory">
                  <BsSelect :model-value="recurring.categoryId" native @update:model-value="recurringField('categoryId', $event)">
                    <BsSelectOption value="">{{ copy.addChooseCategory }}</BsSelectOption>
                    <BsSelectOption
                      v-for="c in (recurring.transactionType === 'income' ? options.incomeCategories : options.expenseCategories)"
                      :key="c.id"
                      :value="c.id"
                    >{{ c.name }}</BsSelectOption>
                  </BsSelect>
                </BsFloatingField>
                <template v-else>
                  <BsSelect :model-value="recurring.liabilityAccountId" required native @update:model-value="recurringField('liabilityAccountId', $event)">
                    <BsSelectOption value="">{{ copy.addLiabilityAccount }}</BsSelectOption>
                    <BsSelectOption v-for="account in options.liabilityAccounts" :key="account.id" :value="account.id">{{ account.name }}</BsSelectOption>
                  </BsSelect>
                  <BsInput :model-value="recurring.principal" inputmode="decimal" :placeholder="copy.addPrincipal" required @update:model-value="recurringField('principal', $event)" />
                  <BsInput :model-value="recurring.interest" inputmode="decimal" :placeholder="copy.addInterest" @update:model-value="recurringField('interest', $event)" />
                  <BsInput :model-value="recurring.fees" inputmode="decimal" :placeholder="copy.addFees" @update:model-value="recurringField('fees', $event)" />
                </template>
                <BsSelect :model-value="recurring.paymentAccountId" required native @update:model-value="recurringField('paymentAccountId', $event)">
                  <BsSelectOption value="">{{ copy.addChooseAccount }}</BsSelectOption>
                  <BsSelectOption v-for="a in options.paymentAccounts" :key="a.id" :value="a.id">{{ a.name }}</BsSelectOption>
                </BsSelect>
                <BsFieldLabel>{{ copy.operationsEvery }} <BsInput :model-value="recurring.intervalCount" type="number" min="1" required @update:model-value="recurringField('intervalCount', $event)" /></BsFieldLabel>
                <BsInput :model-value="recurring.endDate" type="date" :aria-label="copy.operationsEndDate" @update:model-value="recurringField('endDate', $event)" />
                <BsInput :model-value="recurring.maxOccurrences" type="number" min="1" :placeholder="copy.operationsMaxOccurrences" @update:model-value="recurringField('maxOccurrences', $event)" />
                <BsSelect :model-value="recurring.frequency" native @update:model-value="recurringField('frequency', $event)">
                  <BsSelectOption v-for="f in ['daily','weekly','monthly','quarterly','yearly']" :key="f" :value="f">{{ f }}</BsSelectOption>
                </BsSelect>
                <BsInput :model-value="recurring.startDate" type="date" @update:model-value="recurringField('startDate', $event)" />
                <BsSelect :model-value="recurring.mode" native @update:model-value="recurringField('mode', $event)">
                  <BsSelectOption value="requires_confirmation">{{ copy.operationsConfirmMode }}</BsSelectOption>
                  <BsSelectOption value="auto_post">{{ copy.operationsAutoPost }}</BsSelectOption>
                </BsSelect>
              </BsGrid>
              <BsGrid v-else-if="view.tab === 'counterparties' && view.canCreate" :columns="2" gap="md">
                <BsInput :model-value="counterparty.name" :placeholder="copy.operationsName" required @update:model-value="counterpartyField('name', $event)" />
                <BsSelect :model-value="counterparty.type" native @update:model-value="counterpartyField('type', $event)">
                  <BsSelectOption v-for="type in ['customer','vendor','lender','employee','government','other']" :key="type" :value="type">{{ type }}</BsSelectOption>
                </BsSelect>
                <BsInput :model-value="counterparty.email" type="email" :placeholder="copy.authEmail" @update:model-value="counterpartyField('email', $event)" />
                <BsInput :model-value="counterparty.phone" :placeholder="copy.operationsPhone" @update:model-value="counterpartyField('phone', $event)" />
                <BsInput :model-value="counterparty.taxIdentifier" :placeholder="copy.operationsTaxIdentifier" @update:model-value="counterpartyField('taxIdentifier', $event)" />
                <BsInput :model-value="counterparty.notes" :placeholder="copy.operationsNotes" @update:model-value="counterpartyField('notes', $event)" />
              </BsGrid>
              <BsStack v-else-if="view.tab === 'tags' && view.canCreate" gap="md">
                <BsText size="sm" tone="muted">{{ copy.tagsGuideCreateHint }}</BsText>
                <BsFloatingField :label="copy.operationsName">
                  <BsInput id="tag-name" :model-value="tag.name" :placeholder="copy.tagsGuideNamePlaceholder" required maxlength="80" @update:model-value="tagField('name', $event)" />
                </BsFloatingField>
                <BsFloatingField :label="copy.recordPagesColor">
                  <BsInput id="tag-color" :model-value="tag.color" type="color" @update:model-value="tagField('color', $event)" />
                </BsFloatingField>
              </BsStack>
            </BsBox>
          </BsRecordActionDialog>

</template>
