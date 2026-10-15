<script setup lang="ts">
import type { BsCommissionForm, BsCommissionCopy, BsCommissionRow, BsCommissionAssignment } from '../types/commissionPresentation'
import type { BsDataTableColumn } from '@building-suit/ux'
const props = defineProps<{ copy: BsCommissionCopy; available: boolean; loading: boolean; error: boolean; pending: boolean; dirty: boolean; first: number; totalRecords: number; actionError: boolean; saved: boolean; records: BsCommissionRow[]; assignments: BsCommissionAssignment[] }>()
const editor = defineModel<boolean>('editor', { required: true })
const form = defineModel<BsCommissionForm>('form', { required: true })
const emit = defineEmits<{ save: []; retry: []; page: [offset: number]; assign: [lineId: string, membershipId: string | null, appointmentId: string | null] }>()
const options = computed(() => [{ value: 'percentage', label: props.copy.percentage }, { value: 'fixed', label: props.copy.fixed }])
const overrideOptions = computed(() => [{ value: '', label: props.copy.inherit }, ...options.value])
const memberOptions = computed(() => [{ id: '', name: props.copy.none }, ...form.value.employees])
const columns = computed<BsDataTableColumn<BsCommissionRow>[]>(() => [
 { key: 'employee', field: 'employee', header: props.copy.employee }, { key: 'sale', field: 'sale', header: props.copy.sale },
 { key: 'estimate', field: 'estimate', header: props.copy.estimate }, { key: 'earned', field: 'earned', header: props.copy.earned },
 { key: 'adjustments', field: 'adjustments', header: props.copy.adjustments }, { key: 'postExport', field: 'postExport', header: props.copy.postExport },
])
const selected = reactive<Record<string, { member: string | number | null; appointment: string | number | null }>>({})
function selection(line: BsCommissionAssignment) { return selected[line.id] ??= { member: line.membershipId, appointment: line.appointmentId } }
function assign(line: BsCommissionAssignment) {
 const value = selection(line)
 emit('assign', line.id, value.member ? String(value.member) : null, value.appointment ? String(value.appointment) : null)
}
</script>
<template>
 <BsStack gap="lg">
  <BsPageHeader :title="copy.title" :subtitle="copy.help"><template #actions><BsButton v-if="available && !loading && !error" @click="editor = true">{{ copy.edit }}</BsButton></template></BsPageHeader>
  <BsText v-if="loading" role="status">{{ copy.loading }}</BsText>
  <BsBox v-else-if="error" role="alert"><BsText>{{ copy.error }}</BsText><BsButton @click="emit('retry')">{{ copy.retry }}</BsButton></BsBox>
  <BsText v-else-if="!available" role="status">{{ copy.noContext }}</BsText>
  <template v-else>
   <BsRecordActionDialog v-model:visible="editor" :title="copy.title" :dirty="dirty" :pending="pending" :error="actionError ? copy.error : undefined" :submit-label="copy.save" @submit="emit('save')">
    <BsCheckbox v-model="form.enabled" :label="copy.enabled" />
    <BsField :label="copy.currency"><BsInput v-model="form.currency" required pattern="[A-Z]{3}" :aria-label="copy.currency" /></BsField>
    <BsPanel v-for="category in (['service', 'product'] as const)" :key="category">
     <BsHeading :level="2">{{ copy[category] }}</BsHeading>
     <BsSelect v-model="form[category].type" :label="copy[category]" :options="options" option-label="label" option-value="value" />
     <BsField :label="copy.rate"><BsInput v-model="form[category].rate" type="number" min="0" step="0.0001" required :aria-label="copy.rate" /></BsField>
    </BsPanel>
    <BsHeading :level="2">{{ copy.employees }}</BsHeading>
    <BsPanel v-for="employee in form.employees" :key="employee.id">
     <BsCheckbox v-model="employee.enabled" :label="employee.name" />
     <BsStack v-for="category in (['service', 'product'] as const)" :key="category">
      <BsSelect v-model="employee[category].type" :label="copy[category]" :options="overrideOptions" option-label="label" option-value="value" />
      <BsField v-if="employee[category].type" :label="copy.rate"><BsInput v-model="employee[category].rate" type="number" min="0" step="0.0001" required :aria-label="copy.rate" /></BsField>
     </BsStack>
    </BsPanel>
    <BsField :label="copy.reason"><BsInput v-model="form.reason" required minlength="2" maxlength="1000" :aria-label="copy.reason" /></BsField>
    <BsText v-if="saved" role="status">{{ copy.saved }}</BsText>
   </BsRecordActionDialog>
   <BsStack v-if="assignments.length"><BsHeading :level="2">{{ copy.assignments }}</BsHeading>
    <BsPanel v-for="line in assignments" :key="line.id">
     <BsHeading :level="3">{{ line.name }}</BsHeading>
     <BsSelect v-model="selection(line).member" :label="copy.employee" :options="memberOptions" option-label="name" option-value="id" />
     <BsSelect v-if="line.itemType === 'service'" v-model="selection(line).appointment" :label="copy.appointment" :options="[{ id: '', label: copy.none }, ...line.appointments]" option-label="label" option-value="id" />
     <BsButton :disabled="pending" @click="assign(line)">{{ copy.assign }}</BsButton>
    </BsPanel>
   </BsStack>
   <BsStack><BsHeading :level="2">{{ copy.history }}</BsHeading><BsDataTable :value="records" :columns="columns" row-key="id" :label="copy.history" lazy paginator :rows="100" :first="first" :total-records="totalRecords" @page="emit('page', $event.first)" /></BsStack>
  </template>
 </BsStack>
</template>
