<script setup lang="ts">
import type { BsAdminPlanCopy, BsAdminPlanDialog, BsAdminPlanForms } from '../types/platformAdministrationPresentation'
defineProps<{ copy: BsAdminPlanCopy; view: BsAdminPlanDialog }>()
const terms = defineModel<BsAdminPlanForms['terms']>('terms', { required: true })
const availability = defineModel<BsAdminPlanForms['availability']>('availability', { required: true })
const change = defineModel<BsAdminPlanForms['change']>('change', { required: true })
const price = defineModel<BsAdminPlanForms['price']>('price', { required: true })
const emit = defineEmits<{ close: []; publishTerms: []; availability: []; change: []; renew: []; suspend: []; price: []; removePrice: [] }>()
function term<K extends keyof BsAdminPlanForms['terms']>(key: K, value: BsAdminPlanForms['terms'][K]) { terms.value = { ...terms.value, [key]: value } }
function setAvailability<K extends keyof BsAdminPlanForms['availability']>(key: K, value: BsAdminPlanForms['availability'][K]) { availability.value = { ...availability.value, [key]: value } }
function setChange<K extends keyof BsAdminPlanForms['change']>(key: K, value: BsAdminPlanForms['change'][K]) { change.value = { ...change.value, [key]: value } }
function setPrice<K extends keyof BsAdminPlanForms['price']>(key: K, value: BsAdminPlanForms['price'][K]) { price.value = { ...price.value, [key]: value } }
</script>
<template>
  <BsRecordActionDialog :visible="view.kind !== null" :title="view.title" :dirty="view.dirty" :pending="view.pending" :error="view.error" :submit-label="copy.save" :cancel-label="copy.cancel" :submit-disabled="view.kind === 'change' && !!view.blockers.length" @update:visible="value => { if (!value) emit('close') }" @submit="view.kind === 'terms' ? emit('publishTerms') : view.kind === 'availability' ? emit('availability') : view.kind === 'change' ? emit('change') : emit('price')">
    <template v-if="view.kind === 'terms'">
      <BsFloatingField :label="copy.displayName"><BsInput :model-value="terms.name" :maxlength="120" required @update:model-value="term('name', String($event ?? ''))"/></BsFloatingField>
      <BsGrid :columns="2">
        <BsFloatingField :label="copy.price"><BsInput :model-value="terms.amount" type="number" :min="0" :step="1" required @update:model-value="term('amount', Number($event))"/></BsFloatingField>
        <BsFloatingField :label="copy.currency"><BsInput :model-value="terms.currency" :maxlength="3" required @update:model-value="term('currency', String($event ?? ''))"/></BsFloatingField>
        <BsFloatingField :label="copy.interval"><BsSelect :model-value="terms.interval" :label="copy.interval" :options="[{ value: 'monthly', label: 'monthly' }, { value: 'quarterly', label: 'quarterly' }, { value: 'annual', label: 'annual' }]" option-label="label" option-value="value" @update:model-value="term('interval', String($event))"/></BsFloatingField>
        <BsFloatingField :label="copy.effectiveFrom"><BsInput :model-value="terms.effectiveFrom" type="datetime-local" required @update:model-value="term('effectiveFrom', String($event ?? ''))"/></BsFloatingField>
        <BsFloatingField v-for="key in (['locations', 'members', 'products', 'services', 'customers', 'suppliers'] as const)" :key="key" :label="copy[key]"><BsInput :model-value="terms[key]" type="number" :min="1" :step="1" :placeholder="copy.unlimited" @update:model-value="term(key, $event === '' || $event == null ? null : Number($event))"/></BsFloatingField>
      </BsGrid><BsFloatingField :label="copy.reason"><BsTextarea :model-value="terms.reason" :minlength="2" :maxlength="1000" required @update:model-value="term('reason', String($event ?? ''))"/></BsFloatingField>
    </template>
    <template v-else-if="view.kind === 'availability'"><BsCheckbox v-for="key in (['active', 'public', 'purchasable', 'comingSoon'] as const)" :key="key" :model-value="availability[key]" :label="copy[key]" @update:model-value="setAvailability(key, Boolean($event))"/><BsFloatingField :label="copy.reason"><BsTextarea :model-value="availability.reason" :minlength="2" :maxlength="1000" required @update:model-value="setAvailability('reason', String($event ?? ''))"/></BsFloatingField></template>
    <template v-else-if="view.kind === 'change'">
      <BsFloatingField :label="copy.targetPlan"><BsSelect :model-value="change.plan" :label="copy.targetPlan" :options="view.plans" option-label="label" option-value="value" @update:model-value="setChange('plan', String($event))"/></BsFloatingField><BsFloatingField :label="copy.timing"><BsSelect :model-value="change.timing" :label="copy.timing" :options="view.timing" option-label="label" option-value="value" @update:model-value="setChange('timing', String($event))"/></BsFloatingField>
      <BsBox v-if="view.blockers.length" role="alert"><BsText emphasis="semibold">{{ copy.blockers }}</BsText><BsList><BsListItem v-for="blocker in view.blockers" :key="blocker">{{ blocker }}</BsListItem></BsList></BsBox><BsFloatingField :label="copy.reason"><BsTextarea :model-value="change.reason" :minlength="2" :maxlength="1000" required @update:model-value="setChange('reason', String($event ?? ''))"/></BsFloatingField>
    </template>
    <template v-else-if="view.kind === 'override'">
      <BsFloatingField :label="copy.amount"><BsInput :model-value="price.amount" type="number" :min="0.01" :step="0.01" required @update:model-value="setPrice('amount', Number($event))"/></BsFloatingField><BsFloatingField :label="copy.currency"><BsInput :model-value="price.currency" :maxlength="3" required @update:model-value="setPrice('currency', String($event ?? ''))"/></BsFloatingField><BsFloatingField :label="copy.effectiveFrom"><BsInput :model-value="price.effectiveFrom" type="datetime-local" required @update:model-value="setPrice('effectiveFrom', String($event ?? ''))"/></BsFloatingField><BsFloatingField :label="copy.expiresAt"><BsInput :model-value="price.expiresAt" type="datetime-local" @update:model-value="setPrice('expiresAt', String($event ?? ''))"/></BsFloatingField><BsFloatingField :label="copy.reason"><BsTextarea :model-value="price.reason" :minlength="2" :maxlength="1000" required @update:model-value="setPrice('reason', String($event ?? ''))"/></BsFloatingField>
    </template>
    <template #actions="{ close }"><BsButton type="submit" variant="primary" :disabled="view.kind === 'change' && !!view.blockers.length">{{ view.kind === 'change' ? copy.changePlan : view.kind === 'override' ? copy.setPrice : copy.save }}</BsButton><BsButton v-if="view.kind === 'change'" @click="emit('renew')">{{ copy.renew }}</BsButton><BsButton v-if="view.kind === 'change'" @click="emit('suspend')">{{ copy.suspend }}</BsButton><BsButton v-if="view.kind === 'override' && view.canRemovePrice" @click="emit('removePrice')">{{ copy.removePrice }}</BsButton><BsButton @click="close">{{ copy.cancel }}</BsButton></template>
  </BsRecordActionDialog>
</template>
