<script setup lang="ts">
import type {BsAppointmentAccessView} from '../types/appointmentAccessPresentation'
import { useOverlayState } from '@building-suit/ux'
import type { BsAppointmentsCopy, BsAppointmentsView, BsAppointmentChoices, BsAppointmentForm, BsAppointmentScheduleForm } from '../types/appointmentsPresentation'
const props = defineProps<{ accessView?: BsAppointmentAccessView; selectedDate?: string; copy: BsAppointmentsCopy; presentation: BsAppointmentsView; choices: BsAppointmentChoices }>()
const accessOpen=defineModel<boolean>('accessOpen',{default:false})
const view = defineModel<string>('view', { required: true })
const search = defineModel<string>('search', { default: '' })
const status = defineModel<string | null>('status', { default: null })
const serviceId = defineModel<string | null>('serviceId', { default: null })
const staffId = defineModel<string | null>('staffId', { required: true })
const showForm = defineModel<boolean>('showForm', { required: true })
const showSchedule = defineModel<boolean>('showSchedule', { required: true })
const form = defineModel<BsAppointmentForm>('form', { required: true })
const scheduleForm = defineModel<BsAppointmentScheduleForm>('scheduleForm', { required: true })
const scheduleMemberId = defineModel<string>('scheduleMemberId', { required: true })
const emit = defineEmits<{ access:[id:string]; issueAccess:[]; revokeAccess:[]; clearFilters: []; createSlot: [date: string, time: string]; date: [value: string]; create: [walkIn: boolean]; edit: [id: string]; transition: [id: string, status: string]; move: [amount: number]; today: []; retry: []; location: [id: string]; save: []; openSchedule: []; scheduleMember: []; saveSchedule: []; addBlock: []; removeBlock: [index: number] }>()
function updateForm(key: keyof BsAppointmentForm, value: string | number | boolean | null | undefined) { form.value = { ...form.value, [key]: String(value ?? '') } }
function updateSchedule(key: Exclude<keyof BsAppointmentScheduleForm, 'weekdays'>, value: string | number | boolean | null | undefined) { scheduleForm.value = { ...scheduleForm.value, [key]: String(value ?? '') } }
function updateDay(weekday: number, key: 'enabled' | 'startsLocal' | 'endsLocal', value: string | number | boolean | null | undefined) { scheduleForm.value = { ...scheduleForm.value, weekdays: scheduleForm.value.weekdays.map(day => day.weekday === weekday ? { ...day, [key]: key === 'enabled' ? Boolean(value) : String(value ?? '') } : day) } }
const { open: blockOpen, show: openBlock, close: closeBlock } = useOverlayState()
const blockId = ref<string | null>(null)
const selectedBlock = computed(() => props.presentation.days.flatMap(day => day.blocks ?? []).find(block => block.id === blockId.value))
function showBlock(id: string) {
  if (props.presentation.loading || props.presentation.failed) return
  blockId.value = id
  if (selectedBlock.value) openBlock()
}
watch(() => [props.presentation.exists, props.presentation.locationId, props.presentation.loading, props.presentation.failed, props.selectedDate, staffId.value], () => { closeBlock(); blockId.value = null })
watch(selectedBlock, value => { if (!value) closeBlock() })
const { open: appointmentOpen, show: openAppointment, close: closeAppointment } = useOverlayState()
const appointmentId = ref<string | null>(null)
const selectedAppointment = computed(() => [...props.presentation.days.flatMap(day => day.appointments), ...props.presentation.queue].find(appointment => appointment.id === appointmentId.value))
function showAppointment(id: string) {
  if (props.presentation.loading || props.presentation.failed) return
  appointmentId.value = id
  if (selectedAppointment.value) openAppointment()
}
// Keep the details dialog mounted beneath its editor so closing/discarding the
// editor restores focus to the same Reschedule control and preserves context.
function editSelectedAppointment() { const id = selectedAppointment.value?.id; if (id) emit('edit', id) }
function accessSelectedAppointment() { const id = selectedAppointment.value?.id; if (id) { closeAppointment(); emit('access', id) } }
watch([() => props.presentation.exists, () => props.presentation.locationId, () => props.selectedDate, staffId], () => { closeAppointment(); appointmentId.value = null })
watch(selectedAppointment, value => { if (!value) closeAppointment() })
const { locale } = useI18n()
const number = (value: number) => new Intl.NumberFormat(locale.value).format(value)
const ui = useUiCopy()
</script>
<template>
  <BsStack>
    <BsPageHeader :title="copy.title" :subtitle="copy.subtitle">
      <template #actions>
        <BsButton v-if="presentation.canSchedule" severity="secondary" :disabled="presentation.scheduleDisabled" @click="emit('openSchedule')"><BsIcon name="settings" :size="16" />{{ copy.schedule }}</BsButton>
        <BsButton v-if="presentation.canManage" :disabled="!presentation.canCreate" @click="emit('create', true)">{{ copy.walkIn }}</BsButton>
        <BsButton v-if="presentation.canManage" variant="primary" :disabled="!presentation.canCreate" @click="emit('create', false)"><BsIcon name="add" :size="18" />{{ copy.add }}</BsButton>
      </template>
    </BsPageHeader>
    <BsPanel v-if="!presentation.exists && !presentation.shopLoading" padding="md">{{ copy.noShop }}</BsPanel>
    <section v-else-if="presentation.exists" class="bs-appointments" :aria-label="copy.title">
      <aside class="bs-appointments__sidebar">
        <div class="bs-appointments__sidebar-controls">
          <div v-if="selectedDate" class="bs-appointments__mini"><BsMiniCalendar :model-value="selectedDate" :label="copy.date || copy.title" :previous-label="copy.previous" :next-label="copy.next" @update:model-value="emit('date', $event)" /></div>
          <BsDisclosure :summary="copy.filters || copy.title" open density="compact" class="bs-appointments__filters">
            <div class="bs-appointments__filter-fields">
              <BsField v-slot="field" :label="copy.search || copy.customer" class="bs-appointments__search"><BsInput :id="field.id" v-model="search" type="search" :placeholder="copy.searchPlaceholder" :aria-describedby="field.describedby" /></BsField>
              <BsField v-slot="field" :label="copy.branch"><BsSelect :input-id="field.id" :aria-describedby="field.describedby" :model-value="presentation.locationId ?? ''" :label="copy.branch" :options="choices.locations" option-label="label" option-value="value" @update:model-value="value => emit('location', String(value ?? ''))" /></BsField>
              <BsField v-slot="field" :label="copy.barber"><BsSelect v-model="staffId" :placeholder="copy.allBarbers" :input-id="field.id" :aria-describedby="field.describedby" :label="copy.barber" :options="choices.staff" option-label="label" option-value="value" filter /></BsField>
              <BsField v-if="choices.filterServices" v-slot="field" :label="copy.service"><BsSelect v-model="serviceId" :input-id="field.id" :aria-describedby="field.describedby" :label="copy.service" :options="choices.filterServices" option-label="label" option-value="value" filter /></BsField>
              <BsField v-if="choices.statuses" v-slot="field" :label="copy.status || copy.actions || copy.title"><BsSelect v-model="status" :input-id="field.id" :aria-describedby="field.describedby" :label="copy.status || copy.title" :options="choices.statuses" option-label="label" option-value="value" /></BsField>
            </div>
            <BsButton v-if="presentation.filtersActive" variant="text" size="sm" @click="emit('clearFilters')">{{ copy.clearFilters }}</BsButton>
          </BsDisclosure>
          <div v-if="choices.statuses" class="bs-appointments__legend" :aria-label="copy.status"><span v-for="item in choices.statuses.filter(item => item.value)" :key="item.value!" :data-status="item.value"><i aria-hidden="true" />{{ item.label }}</span></div>
        </div>
        <section v-if="!presentation.loading && !presentation.failed && presentation.locationId" class="bs-appointments__queue" :aria-label="copy.queue">
          <div class="bs-appointments__queue-heading"><h2>{{ copy.queue }}</h2><span>{{ number(presentation.queue.length) }}</span></div>
          <p v-if="copy.queueScope" class="bs-appointments__queue-hint">{{ copy.queueScope }}</p>
          <p v-if="!presentation.queue.length" class="bs-appointments__queue-empty">{{ copy.queueEmpty }}</p>
          <ol v-else class="bs-appointments__queue-items">
            <li v-for="appointment in presentation.queue" :key="appointment.id" class="bs-appointments__queue-item" :data-status="appointment.status">
              <button type="button" class="bs-appointments__queue-summary" @click="showAppointment(appointment.id)"><strong>{{ appointment.customerName }}</strong><span>{{ appointment.queueDetail }}</span><span class="bs-appointments__queue-status">{{ appointment.statusLabel }}</span></button>
              <BsButton v-if="appointment.queueAction" variant="text" size="sm" :disabled="presentation.transitioning" :pending="appointment.pending" @click="emit('transition', appointment.id, appointment.queueAction.id)">{{ appointment.queueAction.label }}</BsButton>
            </li>
          </ol>
        </section>
      </aside>
      <div class="bs-appointments__main">
        <header class="bs-appointments__toolbar">
          <div class="bs-appointments__period">
            <div class="bs-appointments__navigation"><BsButton variant="icon" :aria-label="copy.previous" @click="emit('move', -1)"><span aria-hidden="true">{{ presentation.previousSymbol }}</span></BsButton><BsButton variant="icon" :aria-label="copy.next" @click="emit('move', 1)"><span aria-hidden="true">{{ presentation.nextSymbol }}</span></BsButton></div>
            <div><h2 aria-live="polite">{{ presentation.rangeLabel }}</h2><p>{{ presentation.locationName }}<span v-if="presentation.timezone"> · {{ presentation.timezone }}</span></p></div>
          </div>
          <div class="bs-appointments__toolbar-actions"><BsButton size="sm" @click="emit('today')">{{ copy.today }}</BsButton><div class="bs-appointments__views" role="group" :aria-label="copy.title"><BsButton variant="tab" :aria-pressed="view === 'day'" @click="view = 'day'">{{ copy.day }}</BsButton><BsButton variant="tab" :aria-pressed="view === 'week'" @click="view = 'week'">{{ copy.week }}</BsButton><BsButton v-if="copy.month" variant="tab" :aria-pressed="view === 'month'" @click="view = 'month'">{{ copy.month }}</BsButton></div><BsButton variant="icon" :aria-label="copy.refresh || copy.retry" :pending="presentation.refreshing" @click="emit('retry')"><BsIcon name="automation" :size="18" /></BsButton></div>
        </header>
        <div class="bs-appointments__context"><span v-if="presentation.filteredCountLabel && !presentation.loading && !presentation.failed && presentation.locationId" role="status">{{ presentation.filteredCountLabel }}</span><BsField v-if="selectedDate" v-slot="field" :label="copy.date || copy.start" class="bs-appointments__date-input"><BsInput :id="field.id" :model-value="selectedDate" type="date" :aria-describedby="field.describedby" @update:model-value="emit('date', String($event ?? ''))" /></BsField></div>
        <BsAlert v-if="presentation.error && !showForm && !showSchedule" tone="error">{{ presentation.error }}</BsAlert>
        <div v-if="presentation.loading" class="bs-appointments__state" role="status"><BsSectionSkeleton :rows="5" /><BsText size="sm" tone="muted">{{ copy.loading }}</BsText></div>
        <div v-else-if="presentation.failed" class="bs-appointments__state" role="alert"><BsText>{{ presentation.failureMessage }}</BsText><BsButton severity="secondary" @click="emit('retry')">{{ copy.retry }}</BsButton></div>
        <div v-else-if="!presentation.locationId" class="bs-appointments__state">{{ copy.noLocation }}</div>
        <template v-else>
          <BsAppointmentCalendar variant="calendar" :days="presentation.days" :view="view" :copy="copy" :can-create="presentation.canManage && presentation.canCreate" :transitioning="presentation.transitioning" @appointment="showAppointment" @block="showBlock" @day="date => { emit('date', date); view = 'day' }" @create="(date, time) => emit('createSlot', date, time)" />
          <p v-if="presentation.visibleAppointmentCount === 0" class="bs-appointments__empty" role="status">{{ presentation.filtersActive ? copy.calendarEmpty || copy.empty : copy.empty }}</p>
        </template>
        <p v-if="presentation.noStaff" class="bs-appointments__notice" role="status">{{ copy.noStaff }}</p>
        <footer v-if="copy.availabilityHint && presentation.canManage && presentation.locationId && !presentation.failed" class="bs-appointments__footer">{{ copy.availabilityHint }}</footer>
      </div>
    </section>
    <BsDialog v-if="selectedAppointment" v-model:visible="appointmentOpen" :title="selectedAppointment.customerName" :pending="selectedAppointment.pending || showForm">
      <BsStack gap="md">
        <BsInline justify="between" wrap><BsStatusBadge :status="selectedAppointment.status" :label="selectedAppointment.statusLabel" :tone="selectedAppointment.tone" /><BsText size="sm" tone="muted">{{ selectedAppointment.identityLabel }}</BsText></BsInline>
        <BsAlert v-if="presentation.error" tone="error">{{ presentation.error }}</BsAlert>
        <BsDescriptionList>
          <BsDescriptionTerm>{{ copy.start }}</BsDescriptionTerm><BsDescriptionValue>{{ selectedAppointment.dateLabel || selectedAppointment.time }}</BsDescriptionValue>
          <BsDescriptionTerm>{{ copy.service }}</BsDescriptionTerm><BsDescriptionValue>{{ selectedAppointment.serviceName || selectedAppointment.detail }}</BsDescriptionValue>
          <BsDescriptionTerm>{{ copy.barber }}</BsDescriptionTerm><BsDescriptionValue>{{ selectedAppointment.staffName || presentation.staffName }}</BsDescriptionValue>
          <BsDescriptionTerm>{{ copy.branch }}</BsDescriptionTerm><BsDescriptionValue>{{ presentation.locationName }}</BsDescriptionValue>
          <template v-if="selectedAppointment.phone"><BsDescriptionTerm>{{ copy.phone }}</BsDescriptionTerm><BsDescriptionValue><span dir="ltr">{{ selectedAppointment.phone }}</span></BsDescriptionValue></template>
          <template v-if="selectedAppointment.notes"><BsDescriptionTerm>{{ copy.notes }}</BsDescriptionTerm><BsDescriptionValue><p class="bs-appointments__notes">{{ selectedAppointment.notes }}</p></BsDescriptionValue></template>
        </BsDescriptionList>
        <BsInline v-if="selectedAppointment.canEdit || selectedAppointment.actions.length" wrap :aria-label="copy.actions" :aria-busy="selectedAppointment.pending">
          <BsButton v-for="(action, index) in selectedAppointment.actions" :key="action.id" :variant="index === 0 && !action.text ? 'primary' : action.text ? 'text' : 'secondary'" :disabled="presentation.transitioning" @click="emit('transition', selectedAppointment!.id, action.id)">{{ action.label }}</BsButton>
          <BsButton v-if="selectedAppointment.canEdit" :disabled="presentation.transitioning" @click="editSelectedAppointment">{{ copy.reschedule }}</BsButton>
          <BsText v-if="selectedAppointment.pending" role="status" size="sm">{{ copy.saving }}</BsText>
        </BsInline>
        <BsButton v-if="selectedAppointment.access" :disabled="presentation.transitioning" @click="accessSelectedAppointment">{{ selectedAppointment.access.label }}</BsButton>
        <BsLink v-if="selectedAppointment.link" :to="selectedAppointment.link.to">{{ selectedAppointment.link.label }}</BsLink>
        <BsDisclosure v-if="selectedAppointment.history.length" :summary="copy.history"><BsList ordered><BsListItem v-for="event in selectedAppointment.history" :key="event.id">{{ event.label }}</BsListItem></BsList></BsDisclosure>
      </BsStack>
      <template #footer><BsButton :disabled="selectedAppointment.pending" @click="closeAppointment">{{ ui('close') }}</BsButton></template>
    </BsDialog>
    <BsDialog v-if="accessView" v-model:visible="accessOpen" :title="accessView.title" :pending="accessView.pending">
      <BsStack gap="md">
        <BsText as="p">{{accessView.help}}</BsText>
        <BsText v-if="accessView.loading" role="status">{{accessView.copy.loading}}</BsText>
        <BsAlert v-if="accessView.error" tone="error">{{accessView.error}}</BsAlert>
        <BsText v-if="!accessView.loading">{{accessView.enabled?accessView.copy.enabled:accessView.copy.disabled}}</BsText>
        <BsAlert v-if="!accessView.loading&&!accessView.usablePhone" tone="warning">{{accessView.copy.phoneRequired}}</BsAlert>
        <BsField v-if="accessView.code" v-slot="field" :label="accessView.copy.code"><BsInput :id="field.id" :model-value="accessView.code" readonly dir="ltr" autocomplete="off"/></BsField>
        <BsText v-if="accessView.code" as="p" role="status">{{accessView.copy.oneTime}}</BsText>
        <BsInline wrap>
          <BsButton :disabled="accessView.loading||accessView.pending||!accessView.usablePhone" :pending="accessView.pending" @click="emit('issueAccess')">{{accessView.enabled?accessView.copy.rotate:accessView.copy.issue}}</BsButton>
          <BsButton :disabled="accessView.loading||accessView.pending||!accessView.enabled" @click="emit('revokeAccess')">{{accessView.copy.revoke}}</BsButton>
          <BsButton :disabled="accessView.pending" @click="accessOpen=false">{{accessView.copy.close}}</BsButton>
        </BsInline>
      </BsStack>
    </BsDialog>
    <BsDialog v-if="selectedBlock" v-model:visible="blockOpen" :title="copy.blockDetails || copy.scheduleTitle">
      <BsDescriptionList>
        <BsDescriptionTerm>{{ copy.blockKind }}</BsDescriptionTerm><BsDescriptionValue>{{ selectedBlock.kindLabel }}</BsDescriptionValue>
        <BsDescriptionTerm>{{ copy.barber }}</BsDescriptionTerm><BsDescriptionValue>{{ selectedBlock.staff }}</BsDescriptionValue>
        <BsDescriptionTerm>{{ copy.blockStart }}</BsDescriptionTerm><BsDescriptionValue>{{ selectedBlock.starts }}</BsDescriptionValue>
        <BsDescriptionTerm>{{ copy.blockEnd }}</BsDescriptionTerm><BsDescriptionValue>{{ selectedBlock.ends }}</BsDescriptionValue>
        <BsDescriptionTerm>{{ copy.blockNote }}</BsDescriptionTerm><BsDescriptionValue>{{ selectedBlock.note || '—' }}</BsDescriptionValue>
      </BsDescriptionList>
      <template #footer><BsButton @click="closeBlock">{{ ui('close') }}</BsButton></template>
    </BsDialog>
    <BsRecordActionDialog v-model:visible="showForm" pinned-actions :title="presentation.formTitle" :dirty="presentation.formDirty" :pending="presentation.saving" :error="presentation.error" :submit-label="copy.save" :cancel-label="copy.cancel" @submit="emit('save')">
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
    <BsRecordActionDialog v-model:visible="showSchedule" pinned-actions :title="copy.scheduleTitle" size="lg" :dirty="presentation.scheduleDirty" :pending="presentation.scheduleSaving" :error="presentation.error" :submit-label="copy.saveSchedule" :cancel-label="copy.cancel" :submit-disabled="Boolean(scheduleForm.blockStarts || scheduleForm.blockEnds || scheduleForm.blockNote)" @submit="emit('saveSchedule')">
      <BsField v-slot="field" :label="copy.barber">
        <BsSelect v-model="scheduleMemberId" :disabled="presentation.scheduleDirty || presentation.scheduleSaving" :input-id="field.id" :aria-describedby="field.describedby" required :label="copy.barber" :options="choices.scheduleStaff" option-label="label" option-value="value" option-disabled="disabled" @change="emit('scheduleMember')"/>
        <BsText v-if="presentation.scheduleDirty && copy.scheduleSwitchHint" role="status" size="xs" tone="muted">{{ copy.scheduleSwitchHint }}</BsText>
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
          <BsText v-if="(scheduleForm.blockStarts || scheduleForm.blockEnds || scheduleForm.blockNote) && copy.blockDraft" role="status" size="xs" tone="muted">{{ copy.blockDraft }}</BsText>
        </BsGrid>
        <BsList>
          <BsListItem v-for="block in presentation.blocks" :key="block.id">
            <BsText as="span">{{ block.label }}</BsText>
            <BsButton variant="text" type="button" @click="emit('removeBlock', block.index)">{{ copy.remove }}</BsButton>
          </BsListItem>
        </BsList>
      </BsFieldGroup>
    </BsRecordActionDialog>
  </BsStack>
</template>
<style scoped>
.bs-appointments { display: grid; grid-template-columns: 15.5rem minmax(0, 1fr); min-inline-size: 0; border: 1px solid var(--bs-border); border-radius: var(--bs-radius-card); background: var(--bs-surface); overflow: clip; }
.bs-appointments__sidebar { min-inline-size: 0; border-inline-end: 1px solid var(--bs-border); background: color-mix(in oklab, var(--bs-surface-muted) 25%, var(--bs-surface)); }
.bs-appointments__sidebar-controls { padding: var(--bs-space-4); }
.bs-appointments__mini { margin-block-end: var(--bs-space-4); padding-block-end: var(--bs-space-4); border-block-end: 1px solid var(--bs-border); }
.bs-appointments__filter-fields { display: grid; gap: var(--bs-space-3); }
.bs-appointments__filters :deep(.ls-field__label) { font-size: .75rem; font-weight: 500; }
.bs-appointments__filters :deep(.ls-input), .bs-appointments__filters :deep([data-pc-name='select']) { min-inline-size: 0; font-size: .8125rem; }
.bs-appointments__legend { display: flex; flex-wrap: wrap; gap: var(--bs-space-2) var(--bs-space-3); margin-block-start: var(--bs-space-4); font-size: .6875rem; color: var(--bs-text-muted); }
.bs-appointments__legend span { display: flex; align-items: center; gap: var(--bs-space-1); }
.bs-appointments__legend i { display: inline-block; inline-size: .45rem; block-size: .45rem; border-radius: var(--bs-radius-full); background: var(--bs-status-info); }
.bs-appointments__legend [data-status='waiting'] i, .bs-appointments__legend [data-status='arrived'] i { background: var(--bs-status-warning); }
.bs-appointments__legend [data-status='completed'] i { background: var(--bs-status-success); }
.bs-appointments__legend [data-status='cancelled'] i, .bs-appointments__legend [data-status='no_show'] i { background: var(--bs-status-error); }
.bs-appointments__queue { padding: var(--bs-space-4); border-block-start: 1px solid var(--bs-border); }
.bs-appointments__queue-heading { display: flex; align-items: start; justify-content: space-between; gap: var(--bs-space-2); }
.bs-appointments__queue-heading h2 { font-size: .8125rem; line-height: 1.6; font-weight: 600; }
.bs-appointments__queue-heading > span { padding: 0 var(--bs-space-2); border-radius: var(--bs-radius-chip); background: var(--bs-surface-muted); font-size: .75rem; font-variant-numeric: tabular-nums; }
.bs-appointments__queue-hint, .bs-appointments__queue-empty { margin-block-start: var(--bs-space-2); font-size: .6875rem; line-height: 1.7; color: var(--bs-text-muted); }
.bs-appointments__queue-items { display: grid; gap: var(--bs-space-3); max-block-size: 24rem; overflow: auto; margin-block-start: var(--bs-space-4); padding: 0 var(--bs-space-1); list-style: none; }
.bs-appointments__queue-item { padding-inline-start: var(--bs-space-3); border-inline-start: 2px solid var(--bs-status-warning); }
.bs-appointments__queue-item[data-status='in_service'] { border-color: var(--bs-status-info); }
.bs-appointments__queue-summary { display: grid; gap: var(--bs-space-1); inline-size: 100%; min-inline-size: 0; padding-block: var(--bs-space-1); border: 0; background: transparent; text-align: start; color: var(--bs-text); cursor: pointer; }
.bs-appointments__queue-summary strong { font-size: .8125rem; font-weight: 600; overflow-wrap: anywhere; }
.bs-appointments__queue-summary span { font-size: .6875rem; color: var(--bs-text-muted); }
.bs-appointments__queue-summary .bs-appointments__queue-status { color: var(--bs-text); }
.bs-appointments__queue-summary:focus-visible { outline: 2px solid var(--bs-focus-ring); outline-offset: 2px; }
.bs-appointments__main { min-inline-size: 0; }
.bs-appointments__toolbar { display: flex; flex-wrap: wrap; justify-content: space-between; align-items: center; gap: var(--bs-space-3); padding: var(--bs-space-5); padding-block-end: var(--bs-space-3); }
.bs-appointments__period { display: flex; align-items: center; gap: var(--bs-space-3); min-inline-size: 0; }
.bs-appointments__period h2 { font-size: 1.125rem; font-weight: 600; overflow-wrap: anywhere; }
.bs-appointments__period p { margin-block-start: var(--bs-space-1); font-size: .6875rem; color: var(--bs-text-muted); }
.bs-appointments__navigation { display: flex; gap: var(--bs-space-1); }
.bs-appointments__navigation :deep(button) { font-size: 1.5rem; }
.bs-appointments__toolbar-actions { display: flex; flex-wrap: wrap; align-items: center; gap: var(--bs-space-2); }
.bs-appointments__views { display: flex; align-items: center; gap: 2px; padding: var(--bs-space-1); border: 1px solid var(--bs-border); border-radius: var(--bs-radius-button); background: var(--bs-surface-muted); }
.bs-appointments__views :deep(button) { min-block-size: 2rem; padding: var(--bs-space-1) var(--bs-space-3); border: 0; border-radius: var(--bs-radius-chip); font-size: .75rem; }
.bs-appointments__views :deep(button[aria-pressed='true']) { background: var(--bs-surface); color: var(--bs-text); box-shadow: var(--bs-shadow-elevation1); }
.bs-appointments__context { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: var(--bs-space-3); padding: 0 var(--bs-space-5) var(--bs-space-3); color: var(--bs-text-muted); font-size: .75rem; }
.bs-appointments__date-input { display: flex; align-items: center; gap: var(--bs-space-2); }
.bs-appointments__date-input :deep(.ls-field__label) { font-size: .6875rem; font-weight: 400; }
.bs-appointments__date-input :deep(input) { inline-size: 10rem; min-block-size: 2rem; padding: var(--bs-space-1) var(--bs-space-2); font-size: .75rem; }
.bs-appointments__state { display: grid; justify-items: start; gap: var(--bs-space-4); padding: var(--bs-space-5); min-block-size: 28rem; align-content: start; }
.bs-appointments__state :deep(.bs-section-skeleton) { inline-size: 100%; }
.bs-appointments__empty, .bs-appointments__notice, .bs-appointments__footer { padding: var(--bs-space-3) var(--bs-space-5); font-size: .75rem; line-height: 1.7; color: var(--bs-text-muted); }
.bs-appointments__footer { border-block-start: 1px solid var(--bs-border); font-size: .6875rem; }
.bs-appointments__notes { white-space: pre-wrap; overflow-wrap: anywhere; }
@media (max-width: 1000px) {
  .bs-appointments { grid-template-columns: 13.5rem minmax(0, 1fr); }
  .bs-appointments__sidebar-controls, .bs-appointments__queue { padding: var(--bs-space-3); }
  .bs-appointments__toolbar { padding: var(--bs-space-4); }
}
@media (max-width: 760px) {
  .bs-appointments { display: flex; flex-direction: column; }
  .bs-appointments__sidebar { display: contents; }
  .bs-appointments__sidebar-controls { order: 0; border-block-end: 1px solid var(--bs-border); }
  .bs-appointments__main { order: 1; }
  .bs-appointments__queue { order: 2; }
  .bs-appointments__mini, .bs-appointments__legend { display: none; }
  .bs-appointments__filter-fields { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .bs-appointments__search { grid-column: 1 / -1; }
  .bs-appointments__period h2 { font-size: 1rem; }
  .bs-appointments__context { padding-inline: var(--bs-space-3); }
  .bs-appointments__toolbar-actions { inline-size: 100%; justify-content: space-between; }
  .bs-appointments__queue-items { grid-template-columns: repeat(auto-fit, minmax(12rem, 1fr)); }
}
</style>
