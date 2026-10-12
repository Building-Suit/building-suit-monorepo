<script setup lang="ts">
import type { BsAppointmentsCopy, BsAppointmentsView, BsAppointmentChoices, BsAppointmentForm, BsAppointmentScheduleForm } from '../types/appointmentsPresentation'
defineProps<{ selectedDate?: string; copy: BsAppointmentsCopy; presentation: BsAppointmentsView; choices: BsAppointmentChoices }>()
const view = defineModel<string>('view', { required: true })
const staffId = defineModel<string | null>('staffId', { required: true })
const showForm = defineModel<boolean>('showForm', { required: true })
const showSchedule = defineModel<boolean>('showSchedule', { required: true })
const form = defineModel<BsAppointmentForm>('form', { required: true })
const scheduleForm = defineModel<BsAppointmentScheduleForm>('scheduleForm', { required: true })
const scheduleMemberId = defineModel<string>('scheduleMemberId', { required: true })
const emit = defineEmits<{ date: [value: string]; create: [walkIn: boolean]; edit: [id: string]; transition: [id: string, status: string]; move: [amount: number]; today: []; retry: []; location: [id: string]; save: []; openSchedule: []; scheduleMember: []; saveSchedule: []; addBlock: []; removeBlock: [index: number] }>()
function updateForm(key: keyof BsAppointmentForm, value: string | number | boolean | null | undefined) { form.value = { ...form.value, [key]: String(value ?? '') } }
function updateSchedule(key: Exclude<keyof BsAppointmentScheduleForm, 'weekdays'>, value: string | number | boolean | null | undefined) { scheduleForm.value = { ...scheduleForm.value, [key]: String(value ?? '') } }
function updateDay(weekday: number, key: 'enabled' | 'startsLocal' | 'endsLocal', value: string | number | boolean | null | undefined) { scheduleForm.value = { ...scheduleForm.value, weekdays: scheduleForm.value.weekdays.map(day => day.weekday === weekday ? { ...day, [key]: key === 'enabled' ? Boolean(value) : String(value ?? '') } : day) } }
</script>
<template>
  <BsStack>
    <BsPageHeader  :title="copy.title" :subtitle="copy.subtitle">
      <template #actions>
        <BsButton v-if="presentation.canSchedule" severity="secondary" :disabled="presentation.scheduleDisabled" @click="emit('openSchedule')">{{ copy.schedule }}</BsButton>
      </template>
    </BsPageHeader>
    <BsPanel v-if="!presentation.exists && !presentation.shopLoading" padding="md">{{ copy.noShop }}</BsPanel>
    <template v-else-if="presentation.exists">
      <BsToolbar sticky :label="copy.title">
        <BsText as="p" size="sm">
          <BsText as="strong">{{ copy.branch }}:</BsText> {{ presentation.locationName }} · <BsText as="strong">{{ copy.barber }}:</BsText> {{ presentation.staffName }}</BsText>
        <BsInline v-if="presentation.canManage">
          <BsButton variant="primary" :disabled="!presentation.canCreate" @click="emit('create', false)">{{ copy.add }}</BsButton>
          <BsButton :disabled="!presentation.canCreate" @click="emit('create', true)">{{ copy.walkIn }}</BsButton>
        </BsInline>
      </BsToolbar>
      <BsText v-if="presentation.error && !showForm && !showSchedule" role="alert" as="p" size="sm" tone="danger">{{ presentation.error }}</BsText>
      <BsFilterBar :label="copy.title">
        <BsGrid :columns="3">
        <BsField v-slot="field" :label="copy.branch">
          <BsSelect :input-id="field.id" :aria-describedby="field.describedby" :model-value="presentation.locationId ?? ''" :label="copy.branch" :options="choices.locations" option-label="label" option-value="value" option-disabled="disabled" @update:model-value="value => emit('location', String(value ?? ''))"/>
        </BsField>
        <BsField v-slot="field" :label="copy.barber">
          <BsSelect v-model="staffId" :input-id="field.id" :aria-describedby="field.describedby" :label="copy.barber" :options="choices.staff" option-label="label" option-value="value" option-disabled="disabled"/>
        </BsField>
        <BsField v-if="selectedDate !== undefined" v-slot="field" :label="copy.date || copy.start"><BsInput :id="field.id" :model-value="selectedDate" type="date" :aria-describedby="field.describedby" @update:model-value="emit('date', String($event ?? ''))" /></BsField>
        </BsGrid>
        <template #actions><BsInline>
          <BsButton severity="secondary" :aria-label="copy.previous" @click="emit('move', -1)">
            <BsText aria-hidden="true" as="span">{{ presentation.previousSymbol }}</BsText>
          </BsButton>
          <BsButton severity="secondary" @click="emit('today')">{{ copy.today }}</BsButton>
          <BsButton severity="secondary" :aria-label="copy.next" @click="emit('move', 1)">
            <BsText aria-hidden="true" as="span">{{ presentation.nextSymbol }}</BsText>
          </BsButton>
        </BsInline>
        <BsInline>
          <BsInline role="group" :aria-label="copy.title">
            <BsButton variant="chip" type="button" :aria-pressed="view === 'day'" @click="view = 'day'">{{ copy.day }}</BsButton>
            <BsButton variant="chip" type="button" :aria-pressed="view === 'week'" @click="view = 'week'">{{ copy.week }}</BsButton>
            <BsButton v-if="copy.month" variant="chip" :aria-pressed="view === 'month'" @click="view = 'month'">{{ copy.month }}</BsButton>
          </BsInline>
        </BsInline>
        </template>
      </BsFilterBar>
      <BsInline v-if="presentation.rangeLabel" justify="between"><BsHeading :level="2">{{ presentation.rangeLabel }}</BsHeading><BsText v-if="presentation.timezone" size="xs" tone="muted">{{ presentation.timezone }}</BsText></BsInline>
      <BsText v-if="presentation.loading" role="status" as="p" size="sm" tone="muted">{{ copy.loading }}</BsText>
      <BsPanel v-else-if="presentation.failed" role="alert" padding="md">
        <BsText as="p">{{ presentation.failureMessage }}</BsText>
        <BsButton severity="secondary" @click="emit('retry')">{{ copy.retry }}</BsButton>
      </BsPanel>
      <BsText v-else-if="!presentation.locationId" as="p" size="sm">{{ copy.noLocation }}</BsText>
      <BsAppointmentCalendar v-else :days="presentation.days" :view="view" :copy="copy" :transitioning="presentation.transitioning" @edit="emit('edit', $event)" @transition="(id, status) => emit('transition', id, status)" @day="date => { emit('date', date); view = 'day' }" />
      <BsText v-if="presentation.noStaff" role="status" as="p" size="sm">{{ copy.noStaff }}</BsText>
      <BsPanel v-if="!presentation.loading && !presentation.failed && presentation.locationId" padding="md">
        <BsHeading :level="2">{{ copy.queue }}</BsHeading>
        <BsText v-if="!presentation.queue.length" as="p" size="sm" tone="muted">{{ copy.queueEmpty }}</BsText>
        <BsList v-else ordered>
          <BsListItem v-for="appointment in presentation.queue" :key="appointment.id">
            <BsInline justify="between">
              <BsText as="strong">{{ appointment.customerName }}</BsText>
              <BsText as="span" size="xs" emphasis="semibold">{{ appointment.statusLabel }}</BsText>
            </BsInline>
            <BsText as="p" size="xs" tone="muted">{{ appointment.queueDetail }}</BsText>
            <BsButton v-if="appointment.queueAction" severity="secondary" :disabled="presentation.transitioning" :pending="appointment.pending" @click="emit('transition', appointment.id, appointment.queueAction.id)">{{ appointment.queueAction.label }}</BsButton>
          </BsListItem>
        </BsList>
      </BsPanel>
    </template>
    <BsRecordActionDialog v-model:visible="showForm" :title="presentation.formTitle" :dirty="presentation.formDirty" :pending="presentation.saving" :error="presentation.error" :submit-label="copy.save" :cancel-label="copy.cancel" @submit="emit('save')">
      <BsField v-slot="field" :label="copy.service">
        <BsSelect :model-value="form.serviceId" :input-id="field.id" :aria-describedby="field.describedby" :label="copy.service" :options="choices.services" option-label="label" option-value="value" filter virtual :aria-required="true" @update:model-value="updateForm('serviceId', $event)"/>
      </BsField>
      <BsField v-slot="field" :label="copy.barber">
        <BsSelect :model-value="form.membershipId" :input-id="field.id" :aria-describedby="field.describedby" :label="copy.barber" :options="choices.eligibleStaff" option-label="label" option-value="value" filter virtual :aria-required="true" @update:model-value="updateForm('membershipId', $event)"/>
      </BsField>
      <BsField v-slot="field" :label="copy.start">
        <BsInput :id="field.id" :model-value="form.startsLocal" :aria-describedby="field.describedby" type="datetime-local" required @update:model-value="updateForm('startsLocal', $event)"/>
      </BsField>
      <BsFieldGroup :legend="(copy.customerType)">
        <BsInline>
          <BsRadio  :model-value="form.identityKind" value="customer" :label="copy.customer" @update:model-value="updateForm('identityKind', $event)" />
          <BsRadio  :model-value="form.identityKind" value="walk_in" :label="copy.walkIn" @update:model-value="updateForm('identityKind', $event)" />
        </BsInline>
      </BsFieldGroup>
      <BsField v-if="form.identityKind === 'customer'" v-slot="field" :label="copy.customer">
        <BsSelect :model-value="form.customerId" :input-id="field.id" :aria-describedby="field.describedby" :label="copy.customer" :options="choices.customers" option-label="label" option-value="value" :placeholder="copy.selectCustomer" filter virtual :aria-required="true" @update:model-value="updateForm('customerId', $event)"/>
      </BsField>
      <template v-else>
        <BsField v-slot="field" :label="copy.name">
          <BsInput :id="field.id" :model-value="form.walkInName" :aria-describedby="field.describedby" :minlength="presentation.constraints.nameMin" :maxlength="presentation.constraints.nameMax" required @update:model-value="updateForm('walkInName', $event)"/>
        </BsField>
        <BsField v-slot="field" :label="copy.phone">
          <BsInput :id="field.id" :model-value="form.walkInPhone" :aria-describedby="field.describedby" :maxlength="presentation.constraints.phoneMax" dir="ltr" @update:model-value="updateForm('walkInPhone', $event)"/>
        </BsField>
      </template>
      <BsField v-slot="field" :label="copy.notes">
        <BsTextarea :id="field.id" :model-value="form.notes" :aria-describedby="field.describedby" :maxlength="presentation.constraints.notesMax" :rows="2" @update:model-value="updateForm('notes', $event)"/>
      </BsField>
    </BsRecordActionDialog>
    <BsDialog v-model:visible="showSchedule" :title="copy.scheduleTitle" size="lg" :dirty="presentation.scheduleDirty" :pending="presentation.scheduleSaving">
      <template #default="{ close }">
        <BsForm :pending="presentation.scheduleSaving" :error="presentation.error" @submit="emit('saveSchedule')">
          <BsField v-slot="field" :label="copy.barber">
            <BsSelect v-model="scheduleMemberId" :input-id="field.id" :aria-describedby="field.describedby" required :label="copy.barber" :options="choices.scheduleStaff" option-label="label" option-value="value" option-disabled="disabled" @change="emit('scheduleMember')"/>
          </BsField>
          <BsFieldGroup :legend="(copy.workDays)">
            <BsStack>
              <BsGrid v-for="day in scheduleForm.weekdays" :key="day.weekday" :columns="2">
                <BsCheckbox  :model-value="day.enabled" :label="presentation.weekdayNames[day.weekday] ?? String(day.weekday)" @update:model-value="updateDay(day.weekday, 'enabled', Boolean($event))" />
                <BsInput :model-value="day.startsLocal" type="time" :aria-label="`${presentation.weekdayNames[day.weekday]} · ${copy.from}`" :disabled="!day.enabled" @update:model-value="updateDay(day.weekday, 'startsLocal', $event)"/>
                <BsInput :model-value="day.endsLocal" type="time" :aria-label="`${presentation.weekdayNames[day.weekday]} · ${copy.to}`" :disabled="!day.enabled" @update:model-value="updateDay(day.weekday, 'endsLocal', $event)"/>
              </BsGrid>
            </BsStack>
          </BsFieldGroup>
          <BsFieldGroup :legend="(copy.break) + ' / ' + (copy.timeOff)">
            <BsGrid :columns="2">
              <BsField v-slot="field" :label="copy.blockKind">
                <BsSelect :model-value="scheduleForm.blockKind" :input-id="field.id" :aria-describedby="field.describedby" :label="copy.blockKind" :options="[{ value: 'break', label: (copy.break), disabled: false }, { value: 'time_off', label: (copy.timeOff), disabled: false }]" option-label="label" option-value="value" option-disabled="disabled" @update:model-value="updateSchedule('blockKind', $event)"/>
              </BsField>
              <BsField v-slot="field" :label="copy.blockNote">
                <BsInput :id="field.id" :model-value="scheduleForm.blockNote" :aria-describedby="field.describedby" :maxlength="presentation.constraints.blockNoteMax" @update:model-value="updateSchedule('blockNote', $event)"/>
              </BsField>
              <BsField v-slot="field" :label="copy.blockStart">
                <BsInput :id="field.id" :model-value="scheduleForm.blockStarts" :aria-describedby="field.describedby" type="datetime-local" @update:model-value="updateSchedule('blockStarts', $event)"/>
              </BsField>
              <BsField v-slot="field" :label="copy.blockEnd">
                <BsInput :id="field.id" :model-value="scheduleForm.blockEnds" :aria-describedby="field.describedby" type="datetime-local" @update:model-value="updateSchedule('blockEnds', $event)"/>
              </BsField>
              <BsButton severity="secondary" @click="emit('addBlock')">{{ copy.addBlock }}</BsButton>
            </BsGrid>
            <BsList>
              <BsListItem v-for="block in presentation.blocks" :key="block.id">
                <BsText as="span">{{ block.label }}</BsText>
                <BsButton variant="text" type="button" @click="emit('removeBlock', block.index)">{{ copy.remove }}</BsButton>
              </BsListItem>
            </BsList>
          </BsFieldGroup>
          <BsInline>
            <BsButton type="submit" :pending="presentation.scheduleSaving">{{ copy.saveSchedule }}</BsButton>
            <BsButton severity="secondary" :disabled="presentation.scheduleSaving" @click="close">{{ copy.cancel }}</BsButton>
          </BsInline>
        </BsForm>
      </template>
    </BsDialog>
  </BsStack>
</template>
