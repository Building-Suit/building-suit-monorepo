<script setup lang="ts">
import { appendDraftRow, removeDraftRow, replaceDraftRow } from '@building-suit/ux'
import type { BsJournalCreationFlow, BsJournalCreationForm, BsJournalCreationLine, BsJournalCreationAllocation, BsJournalCreationView, BsJournalCreationCopy, BsJournalCreationOptions } from '../types/journalCreationPresentation'
defineProps<{ flow: BsJournalCreationFlow; view: BsJournalCreationView; copy: BsJournalCreationCopy; options: BsJournalCreationOptions }>()
const form = defineModel<BsJournalCreationForm>('form', { required: true })
const emit = defineEmits<{ close: []; save: []; flow: [value: BsJournalCreationFlow] }>()
function field<K extends keyof BsJournalCreationForm>(key: K, value: BsJournalCreationForm[K]) { form.value = { ...form.value, [key]: value } }
function lineField(index: number, key: keyof BsJournalCreationLine, value: string) { const line = form.value.lines[index]; if (line) field('lines', replaceDraftRow(form.value.lines, index, { ...line, [key]: value })) }
function allocationField(index: number, allocationIndex: number, key: keyof BsJournalCreationAllocation, value: string) { const line = form.value.lines[index]; const allocation = line?.allocations[allocationIndex]; if (line && allocation) field('lines', replaceDraftRow(form.value.lines, index, { ...line, allocations: replaceDraftRow(line.allocations, allocationIndex, { ...allocation, [key]: value }) })) }
function addLine() { field('lines', appendDraftRow(form.value.lines, { accountId: '', side: 'debit', amount: '', allocations: [] })) }
function removeLine(index: number) { field('lines', removeDraftRow(form.value.lines, index, 2)) }
function addAllocation(index: number, kind: 'cost_center' | 'project') { const line = form.value.lines[index]; if (line) field('lines', replaceDraftRow(form.value.lines, index, { ...line, allocations: appendDraftRow(line.allocations, { kind, valueId: '', amount: line.amount }) })) }
function removeAllocation(index: number, allocationIndex: number) { const line = form.value.lines[index]; if (line) field('lines', replaceDraftRow(form.value.lines, index, { ...line, allocations: removeDraftRow(line.allocations, allocationIndex) })) }
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
            :cancel-label="copy.commonCancel"
            @update:visible="(value: boolean) => { if (!value) emit('close') }"
            @submit="emit('save')"
          >
            <BsBox>
              <BsFieldLabel for="flow">{{ copy.addWhatAreYouRecording }}</BsFieldLabel>
              <BsSelect id="flow" :model-value="flow" native @update:model-value="emit('flow', $event as BsJournalCreationFlow)">
                <BsSelectOption v-for="f in view.flows" :key="f.value" :value="f.value">{{ f.label }}</BsSelectOption>
              </BsSelect>
            </BsBox>
            <BsBox grow>
              <BsUsageMeter
                v-if="view.usage"
                compact
                :item="view.usage"
              />
              <BsGrid :columns="2" gap="md">
                <!-- Amount: every flow except the split ones -->
                <BsBox v-if="!['liability_payment', 'adjustment'].includes(flow)">
                  <BsFieldLabel for="amount">{{ copy.amount }}</BsFieldLabel>
                  <BsInput id="amount" :model-value="form.amount" inputmode="decimal" placeholder="0.00" required @update:model-value="field('amount', String($event ?? ''))" />
                </BsBox>
                <BsBox>
                  <BsFieldLabel for="date">{{ copy.addDate }}</BsFieldLabel>
                  <BsInput id="date" :model-value="form.date" type="date" required @update:model-value="field('date', String($event ?? ''))" />
                </BsBox>
                <BsBox v-if="view.showExchangeRate">
                  <BsFieldLabel for="exchange-rate">{{ copy.exchangeRate }}</BsFieldLabel>
                  <BsInput id="exchange-rate" :model-value="form.exchangeRate" inputmode="decimal" placeholder="1.00" required @update:model-value="field('exchangeRate', String($event ?? ''))" />
                </BsBox>
                <BsText v-else-if="view.foreignCurrency" size="sm" tone="muted">{{ copy.addMultiCurrencyUpgrade }}</BsText>
                <template v-if="view.crossCurrency">
                  <BsBox>
                    <BsFieldLabel for="destination-amount">{{ copy.destinationAmount }}</BsFieldLabel>
                    <BsInput id="destination-amount" :model-value="form.destinationAmount" inputmode="decimal" placeholder="0.00" required @update:model-value="field('destinationAmount', String($event ?? ''))" />
                  </BsBox>
                  <BsBox v-if="view.destinationForeign">
                    <BsFieldLabel for="destination-exchange-rate">{{ copy.destinationExchangeRate }}</BsFieldLabel>
                    <BsInput id="destination-exchange-rate" :model-value="form.destinationExchangeRate" inputmode="decimal" placeholder="1.00" required @update:model-value="field('destinationExchangeRate', String($event ?? ''))" />
                  </BsBox>
                </template>
                <!-- Income -->
                <template v-if="flow === 'income'">
                  <BsBox>
                    <BsFieldLabel for="dest">{{ copy.addReceivedInto }}</BsFieldLabel>
                    <BsSelect id="dest" :model-value="form.destinationAccountId" required native @update:model-value="field('destinationAccountId', String($event ?? ''))">
                      <BsSelectOption value="" disabled>{{ copy.addChooseAccount }}</BsSelectOption>
                      <BsSelectOption v-for="a in options.paymentAccounts" :key="a.id" :value="a.id">{{ a.name }}</BsSelectOption>
                    </BsSelect>
                  </BsBox>
                  <BsBox>
                    <BsFieldLabel for="cat">{{ copy.addCategory }}</BsFieldLabel>
                    <BsSelect id="cat" :model-value="form.categoryId" required native @update:model-value="field('categoryId', String($event ?? ''))">
                      <BsSelectOption value="" disabled>{{ copy.addChooseCategory }}</BsSelectOption>
                      <BsSelectOption v-for="c in options.incomeCategories" :key="c.id" :value="c.id">{{ c.name }}</BsSelectOption>
                    </BsSelect>
                  </BsBox>
                </template>
                <!-- Expense -->
                <template v-if="flow === 'expense'">
                  <BsBox>
                    <BsFieldLabel for="src">{{ copy.addPaidFrom }}</BsFieldLabel>
                    <BsSelect id="src" :model-value="form.sourceAccountId" required native @update:model-value="field('sourceAccountId', String($event ?? ''))">
                      <BsSelectOption value="" disabled>{{ copy.addChooseAccount }}</BsSelectOption>
                      <BsSelectOption v-for="a in options.paymentAccounts" :key="a.id" :value="a.id">{{ a.name }}</BsSelectOption>
                    </BsSelect>
                  </BsBox>
                  <BsBox>
                    <BsFieldLabel for="cat">{{ copy.addCategory }}</BsFieldLabel>
                    <BsSelect id="cat" :model-value="form.categoryId" required native @update:model-value="field('categoryId', String($event ?? ''))">
                      <BsSelectOption value="" disabled>{{ copy.addChooseCategory }}</BsSelectOption>
                      <BsSelectOption v-for="c in options.expenseCategories" :key="c.id" :value="c.id">{{ c.name }}</BsSelectOption>
                    </BsSelect>
                  </BsBox>
                </template>
                <!-- Transfer -->
                <template v-if="flow === 'transfer'">
                  <BsBox>
                    <BsFieldLabel for="src">{{ copy.addFrom }}</BsFieldLabel>
                    <BsSelect id="src" :model-value="form.sourceAccountId" required native @update:model-value="field('sourceAccountId', String($event ?? ''))">
                      <BsSelectOption value="" disabled>{{ copy.addChooseAccount }}</BsSelectOption>
                      <BsSelectOption v-for="a in options.paymentAccounts" :key="a.id" :value="a.id">{{ a.name }}</BsSelectOption>
                    </BsSelect>
                  </BsBox>
                  <BsBox>
                    <BsFieldLabel for="dest">{{ copy.addTo }}</BsFieldLabel>
                    <BsSelect id="dest" :model-value="form.destinationAccountId" required native @update:model-value="field('destinationAccountId', String($event ?? ''))">
                      <BsSelectOption value="" disabled>{{ copy.addChooseAccount }}</BsSelectOption>
                      <BsSelectOption v-for="a in options.paymentAccounts" :key="a.id" :value="a.id">{{ a.name }}</BsSelectOption>
                    </BsSelect>
                  </BsBox>
                  <BsBox>
                    <BsFieldLabel for="fee">{{ copy.addTransferFee }} ({{ copy.commonOptional }})</BsFieldLabel>
                    <BsInput id="fee" :model-value="form.feeAmount" inputmode="decimal" placeholder="0.00" @update:model-value="field('feeAmount', String($event ?? ''))" />
                    <BsText>{{ copy.addTransferFeeHint }}</BsText>
                  </BsBox>
                </template>
                <!-- Asset purchase -->
                <template v-if="flow === 'asset_purchase'">
                  <BsBox>
                    <BsFieldLabel for="asset">{{ copy.addAssetAccount }}</BsFieldLabel>
                    <BsSelect id="asset" :model-value="form.assetAccountId" required native @update:model-value="field('assetAccountId', String($event ?? ''))">
                      <BsSelectOption value="" disabled>{{ copy.addChooseAccount }}</BsSelectOption>
                      <BsSelectOption v-for="a in options.assetAccounts" :key="a.id" :value="a.id">{{ a.name }}</BsSelectOption>
                    </BsSelect>
                  </BsBox>
                  <BsBox>
                    <BsFieldLabel for="src">{{ copy.addPaidFrom }}</BsFieldLabel>
                    <BsSelect id="src" :model-value="form.sourceAccountId" required native @update:model-value="field('sourceAccountId', String($event ?? ''))">
                      <BsSelectOption value="" disabled>{{ copy.addChooseAccount }}</BsSelectOption>
                      <BsSelectOption v-for="a in options.paymentAccounts" :key="a.id" :value="a.id">{{ a.name }}</BsSelectOption>
                    </BsSelect>
                  </BsBox>
                  <BsBox>
                    <BsFieldLabel for="life">{{ copy.addUsefulLife }} ({{ copy.commonOptional }})</BsFieldLabel>
                    <BsInput id="life" :model-value="form.usefulLifeMonths" type="number" min="1" @update:model-value="field('usefulLifeMonths', String($event ?? ''))" />
                    <BsText>{{ copy.addUsefulLifeHint }}</BsText>
                  </BsBox>
                </template>
                <!-- Liability created -->
                <template v-if="flow === 'liability_created'">
                  <BsBox>
                    <BsFieldLabel for="liab">{{ copy.addLiabilityAccount }}</BsFieldLabel>
                    <BsSelect id="liab" :model-value="form.liabilityAccountId" required native @update:model-value="field('liabilityAccountId', String($event ?? ''))">
                      <BsSelectOption value="" disabled>{{ copy.addChooseAccount }}</BsSelectOption>
                      <BsSelectOption v-for="a in options.liabilityAccounts" :key="a.id" :value="a.id">{{ a.name }}</BsSelectOption>
                    </BsSelect>
                  </BsBox>
                  <BsBox>
                    <BsFieldLabel for="dest">{{ copy.addReceivedInto }}</BsFieldLabel>
                    <BsSelect id="dest" :model-value="form.destinationAccountId" required native @update:model-value="field('destinationAccountId', String($event ?? ''))">
                      <BsSelectOption value="" disabled>{{ copy.addChooseAccount }}</BsSelectOption>
                      <BsSelectOption v-for="a in options.paymentAccounts" :key="a.id" :value="a.id">{{ a.name }}</BsSelectOption>
                    </BsSelect>
                  </BsBox>
                  <BsBox>
                    <BsFieldLabel for="due">{{ copy.addDueDate }} ({{ copy.commonOptional }})</BsFieldLabel>
                    <BsInput id="due" :model-value="form.dueDate" type="date" @update:model-value="field('dueDate', String($event ?? ''))" />
                  </BsBox>
                </template>
                <!-- Liability payment -->
                <template v-if="flow === 'liability_payment'">
                  <BsBox>
                    <BsFieldLabel for="liab">{{ copy.addLiability }}</BsFieldLabel>
                    <BsSelect id="liab" :model-value="form.liabilityAccountId" required native @update:model-value="field('liabilityAccountId', String($event ?? ''))">
                      <BsSelectOption value="" disabled>{{ copy.addChooseAccount }}</BsSelectOption>
                      <BsSelectOption v-for="a in options.liabilityAccounts" :key="a.id" :value="a.id">{{ a.name }}</BsSelectOption>
                    </BsSelect>
                  </BsBox>
                  <BsBox>
                    <BsFieldLabel for="src">{{ copy.addPaidFrom }}</BsFieldLabel>
                    <BsSelect id="src" :model-value="form.sourceAccountId" required native @update:model-value="field('sourceAccountId', String($event ?? ''))">
                      <BsSelectOption value="" disabled>{{ copy.addChooseAccount }}</BsSelectOption>
                      <BsSelectOption v-for="a in options.paymentAccounts" :key="a.id" :value="a.id">{{ a.name }}</BsSelectOption>
                    </BsSelect>
                  </BsBox>
                  <BsBox>
                    <BsFieldLabel for="principal">{{ copy.addPrincipal }}</BsFieldLabel>
                    <BsInput id="principal" :model-value="form.principal" inputmode="decimal" placeholder="0.00" @update:model-value="field('principal', String($event ?? ''))" />
                  </BsBox>
                  <BsBox>
                    <BsFieldLabel for="interest">{{ copy.addInterest }}</BsFieldLabel>
                    <BsInput id="interest" :model-value="form.interest" inputmode="decimal" placeholder="0.00" @update:model-value="field('interest', String($event ?? ''))" />
                  </BsBox>
                  <BsBox>
                    <BsFieldLabel for="fees">{{ copy.addFees }}</BsFieldLabel>
                    <BsInput id="fees" :model-value="form.fees" inputmode="decimal" placeholder="0.00" @update:model-value="field('fees', String($event ?? ''))" />
                    <BsText>{{ copy.addLiabilityPaymentHint }}</BsText>
                  </BsBox>
                </template>
                <!-- Owner contribution -->
                <template v-if="flow === 'owner_contribution'">
                  <BsBox>
                    <BsFieldLabel for="dest">{{ copy.addReceivedInto }}</BsFieldLabel>
                    <BsSelect id="dest" :model-value="form.destinationAccountId" required native @update:model-value="field('destinationAccountId', String($event ?? ''))">
                      <BsSelectOption value="" disabled>{{ copy.addChooseAccount }}</BsSelectOption>
                      <BsSelectOption v-for="a in options.paymentAccounts" :key="a.id" :value="a.id">{{ a.name }}</BsSelectOption>
                    </BsSelect>
                  </BsBox>
                  <BsBox>
                    <BsFieldLabel for="equity">{{ copy.addEquityAccount }} ({{ copy.commonOptional }})</BsFieldLabel>
                    <BsSelect id="equity" :model-value="form.equityAccountId" native @update:model-value="field('equityAccountId', String($event ?? ''))">
                      <BsSelectOption value="">{{ copy.addOwnerCapitalDefault }}</BsSelectOption>
                      <BsSelectOption v-for="a in options.equityAccounts" :key="a.id" :value="a.id">{{ a.name }}</BsSelectOption>
                    </BsSelect>
                  </BsBox>
                </template>
                <!-- Owner withdrawal -->
                <template v-if="flow === 'owner_withdrawal'">
                  <BsBox>
                    <BsFieldLabel for="src">{{ copy.addTakenFrom }}</BsFieldLabel>
                    <BsSelect id="src" :model-value="form.sourceAccountId" required native @update:model-value="field('sourceAccountId', String($event ?? ''))">
                      <BsSelectOption value="" disabled>{{ copy.addChooseAccount }}</BsSelectOption>
                      <BsSelectOption v-for="a in options.paymentAccounts" :key="a.id" :value="a.id">{{ a.name }}</BsSelectOption>
                    </BsSelect>
                  </BsBox>
                  <BsBox>
                    <BsFieldLabel for="equity">{{ copy.addDrawingsAccount }} ({{ copy.commonOptional }})</BsFieldLabel>
                    <BsSelect id="equity" :model-value="form.equityAccountId" native @update:model-value="field('equityAccountId', String($event ?? ''))">
                      <BsSelectOption value="">{{ copy.addOwnerDrawingsDefault }}</BsSelectOption>
                      <BsSelectOption v-for="a in options.equityAccounts" :key="a.id" :value="a.id">{{ a.name }}</BsSelectOption>
                    </BsSelect>
                  </BsBox>
                </template>
                <!-- Counterparty, where it means something -->
                <BsBox v-if="['income', 'expense', 'asset_purchase', 'liability_created', 'liability_payment'].includes(flow)">
                  <BsFieldLabel for="cp">{{ copy.addCounterparty }} ({{ copy.commonOptional }})</BsFieldLabel>
                  <BsSelect id="cp" :model-value="form.counterpartyId" native @update:model-value="field('counterpartyId', String($event ?? ''))">
                    <BsSelectOption value="">{{ copy.commonNone }}</BsSelectOption>
                    <BsSelectOption v-for="c in options.counterparties" :key="c.id" :value="c.id">{{ c.name }}</BsSelectOption>
                  </BsSelect>
                </BsBox>
                <BsBox>
                  <BsFieldLabel for="descr">{{ copy.addDescription }}</BsFieldLabel>
                  <BsInput
                    id="descr"
                    :model-value="form.description" :required="flow === 'adjustment'"
                    :placeholder="copy.addDescriptionPlaceholder"
                    @update:model-value="field('description', String($event ?? ''))"
                  />
                </BsBox>
                <BsBox v-if="flow !== 'adjustment'">
                  <BsFieldLabel for="ref">{{ copy.addReference }} ({{ copy.commonOptional }})</BsFieldLabel>
                  <BsInput id="ref" :model-value="form.reference" :placeholder="copy.addReferencePlaceholder" @update:model-value="field('reference', String($event ?? ''))" />
                </BsBox>
                <BsBox v-if="flow === 'adjustment'" :span="2">
                  <BsFieldLabel for="reason">{{ copy.addAdjustmentReason }}</BsFieldLabel>
                  <BsInput id="reason" :model-value="form.reason" required :placeholder="copy.addAdjustmentReasonPlaceholder" @update:model-value="field('reason', String($event ?? ''))" />
                </BsBox>
              </BsGrid>
              <!-- Manual journal -->
              <BsBox v-if="flow === 'adjustment'">
                <BsInline gap="none" :wrap="false" justify="between">
                  <BsHeading :level="3" size="body">{{ copy.addJournalLines }}</BsHeading>
                  <BsButton type="button" size="sm" @click="addLine">{{ copy.addAddLine }}</BsButton>
                </BsInline>
                <BsStack gap="sm">
                  <BsBox v-for="(line, index) in form.lines" :key="index" padding="md" border radius="control">
                    <BsGrid :columns="1" gap="sm">
                      <BsBox>
                        <BsFieldLabel :for="`line-account-${index}`">{{ copy.detailAccount }}</BsFieldLabel>
                        <BsSelect :id="`line-account-${index}`" :model-value="line.accountId" native @update:model-value="lineField(index, 'accountId', String($event ?? ''))">
                          <BsSelectOption value="" disabled>{{ copy.detailAccount }}</BsSelectOption>
                          <BsSelectOption v-for="a in options.postableAccounts" :key="a.id" :value="a.id">{{ a.name }}</BsSelectOption>
                        </BsSelect>
                      </BsBox>
                      <BsBox>
                        <BsFieldLabel :for="`line-side-${index}`">{{ copy.addSide }}</BsFieldLabel>
                        <BsSelect :id="`line-side-${index}`" :model-value="line.side" native @update:model-value="lineField(index, 'side', String($event ?? ''))">
                          <BsSelectOption value="debit">{{ copy.addDebit }}</BsSelectOption>
                          <BsSelectOption value="credit">{{ copy.addCredit }}</BsSelectOption>
                        </BsSelect>
                      </BsBox>
                      <BsBox>
                        <BsFieldLabel :for="`line-amount-${index}`">{{ copy.transactionsAmount }}</BsFieldLabel>
                        <BsInput :id="`line-amount-${index}`" :model-value="line.amount" inputmode="decimal" placeholder="0.00" @update:model-value="lineField(index, 'amount', String($event ?? ''))" />
                      </BsBox>
                      <BsButton
                        type="button"
                        :disabled="form.lines.length <= 2"
                        :aria-label="view.lineRemoveLabels[index]"
                        size="sm"
                        @click="removeLine(index)"
                      >
                        <BsIcon name="delete" :size="18" />
                      </BsButton>
                    </BsGrid>
                    <BsStack v-if="view.canAllocate" gap="sm">
                      <BsInline gap="sm" :wrap="true">
                        <BsButton type="button" size="sm" @click="addAllocation(index, 'cost_center')">{{ copy.allocateCostCenter }}</BsButton>
                        <BsButton type="button" size="sm" @click="addAllocation(index, 'project')">{{ copy.allocateProject }}</BsButton>
                      </BsInline>
                      <BsGrid v-for="(allocation, allocationIndex) in line.allocations" :key="allocationIndex" :columns="1" gap="sm">
                        <BsSelect :model-value="allocation.valueId" native @update:model-value="allocationField(index, allocationIndex, 'valueId', String($event ?? ''))">
                          <BsSelectOption value="">{{ copy.dimensionKinds[allocation.kind] }}</BsSelectOption>
                          <BsSelectOption
                            v-for="value in view.dimensions.filter(item => item.kind === allocation.kind)"
                            :key="value.id"
                            :value="value.id"
                          >{{ value.name }}</BsSelectOption>
                        </BsSelect>
                        <BsInput :model-value="allocation.amount" inputmode="decimal" :aria-label="copy.dimensionsAllocationAmount" @update:model-value="allocationField(index, allocationIndex, 'amount', String($event ?? ''))" />
                        <BsButton type="button" :aria-label="copy.dimensionsRemoveAllocation" size="sm" @click="removeAllocation(index, allocationIndex)">
                          <BsIcon name="delete" :size="18" />
                        </BsButton>
                      </BsGrid>
                    </BsStack>
                  </BsBox>
                </BsStack>
                <BsInline gap="sm" :wrap="true" justify="between" surface="muted" radius="control">
                  <BsText as="span">{{ copy.addDebitsTotal }} <BsText as="span">{{ view.debitTotal }}</BsText>
                · {{ copy.addCreditsTotal }} <BsText as="span">{{ view.creditTotal }}</BsText></BsText>
                  <BsText as="span" emphasis="semibold" :tone="view.balanced ? 'success' : 'danger'">{{ view.balanced ? copy.addBalanced : copy.addNotBalanced }}</BsText>
                </BsInline>
              </BsBox>
            </BsBox>
            <template #actions="{ close: dismiss }">
              <BsButton type="button" :disabled="view.pending" @click="dismiss">{{ copy.commonCancel }}</BsButton>
              <BsButton type="submit" variant="accent" :pending="view.pending">{{ copy.commonSave }}</BsButton>
            </template>
          </BsRecordActionDialog>

</template>
