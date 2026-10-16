<script setup lang="ts">
import type {BsBookingPolicyForm,BsBookingPolicyView} from '../types/appointmentBookingPresentation'
defineProps<{view:BsBookingPolicyView}>()
const form=defineModel<BsBookingPolicyForm>('form',{required:true}),open=defineModel<boolean>('open',{default:false})
const emit=defineEmits<{edit:[];save:[];retry:[]}>()
function number(key:'lead_minutes'|'horizon_days'|'change_notice_minutes'|'reminder_lead_minutes',v:string|number){form.value={...form.value,[key]:Number(v)}}
function flag(key:'enabled'|'allow_reschedule'|'allow_cancel',v:boolean|string|number|(string|number)[]){form.value={...form.value,[key]:v===true}}
function staff(id:string,key:'publicName'|'published',v:string|number|boolean|(string|number)[]){form.value={...form.value,staff:form.value.staff.map(s=>s.membershipId===id?{...s,[key]:key==='published'?v===true:String(v)}:s)}}
</script>
<template>
 <BsPanel id="public-booking-settings" padding="md"><BsStack gap="md">
  <BsHeading :level="2">{{view.title}}</BsHeading><BsText as="p" tone="muted">{{view.help}}</BsText>
  <BsText v-if="view.loading" role="status">{{view.copy.loading}}</BsText><BsText v-else-if="view.denied" role="status">{{view.copy.denied}}</BsText>
  <BsAlert v-else-if="view.failed" tone="error">{{view.copy.failed}} <BsButton @click="emit('retry')">{{view.copy.retry}}</BsButton></BsAlert>
  <template v-else><BsText emphasis="semibold">{{view.enabled?view.copy.enabled:view.copy.disabled}}</BsText><BsText as="p">{{view.copy.remindersDisabled}}</BsText><BsText v-if="view.success" role="status">{{view.success}}</BsText><BsButton :disabled="view.pending" @click="emit('edit')">{{view.copy.edit}}</BsButton></template>
 </BsStack>
 <BsRecordActionDialog v-model:visible="open" :title="view.title" :pending="view.pending" :dirty="view.dirty" :error="view.error" :submit-label="view.copy.save" :cancel-label="view.copy.cancel" :submit-disabled="view.denied" pinned-actions @submit="emit('save')">
  <BsCheckbox :model-value="form.enabled" :label="view.copy.enabled" @update:model-value="flag('enabled',$event)"/>
  <BsField v-for="key in (['lead_minutes','horizon_days','change_notice_minutes','reminder_lead_minutes'] as const)" :key="key" v-slot="field" :label="view.copy[key]"><BsInput :id="field.id" type="number" :model-value="form[key]" :min="key==='horizon_days'?1:key==='reminder_lead_minutes'?15:0" :max="key==='horizon_days'?90:10080" :step="1" required @update:model-value="number(key,$event)"/></BsField>
  <BsCheckbox v-for="key in (['allow_reschedule','allow_cancel'] as const)" :key="key" :model-value="form[key]" :label="view.copy[key]" @update:model-value="flag(key,$event)"/>
  <BsText as="p" tone="muted">{{view.copy.remindersDisabled}}</BsText>
  <BsFieldGroup :legend="view.copy.staff"><BsStack v-for="person in form.staff" :key="person.membershipId" gap="sm"><BsCheckbox :model-value="person.published" :label="view.copy.publishStaff+': '+person.name" @update:model-value="staff(person.membershipId,'published',$event)"/><BsField v-if="person.published" v-slot="field" :label="view.copy.publicName"><BsInput :id="field.id" :model-value="person.publicName" :minlength="2" :maxlength="120" required @update:model-value="staff(person.membershipId,'publicName',$event)"/></BsField></BsStack></BsFieldGroup>
 </BsRecordActionDialog>
 </BsPanel>
</template>
