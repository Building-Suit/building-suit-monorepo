<script setup lang="ts">
import type { BsAppointmentsView,BsAppointmentsCopy } from '../types/appointmentsPresentation'
import type { BsDataTableQueryAdapter } from '@building-suit/ux'
interface Copy { title: string; queue: string; date: string; create: string; retry: string; save: string; cancel: string; patient: string; clinic: string; slot: string; reason: string; time: string; status: string; history: string; actor: string; event: string; original: string; replacement: string; previous: string; next: string; pages: string; empty: string; searchHint: string; loadMore: string; calendar: Pick<BsAppointmentsCopy,'title'|'empty'|'actions'|'edit'|'reschedule'|'saving'|'history'> }
interface QueueRow { id: string; time: string; patient: string; status: string; actions: { value: string; label: string }[] }
const props = defineProps<{
  copy: Copy; scopeLabel: string; notice: string; liveLabel: string; liveTone: 'success'|'warning'|'info'
  loading: boolean; refreshing?: boolean; pending: boolean; error: string | null; denied: string | null; canCreate: boolean; scopeKey: string | null
  days: BsAppointmentsView['days']; queue: QueueRow[]; total: number; page: number; queueTotal: number; queuePage: number
  editor: { title: string; dirty: boolean; pending: boolean; error: string | null; disabled: boolean; selectingPatient: boolean;reasonRequired?:boolean; earliestDate: string; latestDate: string; timezone: string; patientLoading: boolean; patientError: string | null; offersLoading: boolean; offersError: string | null }
  patientOptions: { value: string; label: string }[]; clinicOptions: { value: string; label: string }[]; slotOptions: { value: number; label: string }[]
  accessAction?:{label:string};
  canWalkIn?:boolean;walkInLabel?:string;queuePolicy?:string;
  consultationLabel?:string;consultationOptions?:{value:string;label:string}[]
  reasonOptions?: { value: string; label: string }[]
  transition: { title: string; description: string; reasonRequired: boolean; dirty: boolean; pending: boolean; error: string | null; disabled: boolean }
  history: { title: string; record?: { id: string; label: string; value: string }[]; hasHistory?: boolean; loadLabel?: string; loading: boolean; error: string | null; total: number; page: number; rows: { id: string; event: string; actor: string; at: string; reason: string; original: string; replacement: string }[] }
}>()
const date = defineModel<string>('date',{ required: true })
const form = defineModel<{ consultationId?:string;patientId: string; destinationId: string; date: string; minute: number | null; reason: string }>('form',{ required: true })
const reason = defineModel<string>('reason',{ required: true })
const editorOpen = defineModel<boolean>('editorOpen',{ required: true })
const transitionOpen = defineModel<boolean>('transitionOpen',{ required: true })
const historyOpen = defineModel<boolean>('historyOpen',{ required: true })
const emit = defineEmits<{ access: []; create: [];walkIn: []; reschedule: [id: string]; action: [id: string,action: string]; retry: []; date: []; page: [scope: string | null,page: number]; queuePage: [scope: string | null,page: number]; save: []; confirm: []; patients: [query: string]; offers: []; historyPage: [page: number]; historyRetry: [] }>()
const queueAdapter = computed<BsDataTableQueryAdapter>(() => { const scope = props.scopeKey;return { page: value => emit('queuePage',scope,value.page) } })
const queueColumns = computed(() => [{ key: 'patient',field: 'patient',header: props.copy.patient },{ key: 'time',field: 'time',header: props.copy.time },{ key: 'status',field: 'status',header: props.copy.status },{ key: 'actions',header: props.copy.calendar.actions || props.copy.history }])
const historyColumns = computed(() => [{ key: 'at',field: 'at',header: props.copy.time },{ key: 'event',field: 'event',header: props.copy.event },{ key: 'actor',field: 'actor',header: props.copy.actor },{ key: 'reason',field: 'reason',header: props.copy.reason },{ key: 'original',field: 'original',header: props.copy.original },{ key: 'replacement',field: 'replacement',header: props.copy.replacement }])
</script>
<template>
  <BsStack gap="lg">
    <BsPageHeader :title="copy.title" :subtitle="scopeLabel"><template #actions><BsButton :disabled="pending || loading || refreshing" :pending="loading || refreshing" @click="emit('retry')">{{ copy.retry }}</BsButton><BsButton v-if="canWalkIn && walkInLabel" :disabled="pending || loading" @click="emit('walkIn')">{{walkInLabel}}</BsButton><BsButton v-if="canCreate" variant="primary" :disabled="pending || loading" @click="emit('create')">{{ copy.create }}</BsButton></template></BsPageHeader>
    <BsAlert tone="info" :description="notice" /><BsStatusBadge :status="liveTone" :label="liveLabel" :tone="liveTone" />
    <BsStateSurface v-if="denied" state="permission" :title="denied" :action-label="accessAction?.label" @action="emit('access')" />
    <BsSectionSkeleton v-else-if="loading" :rows="4" />
    <BsStateSurface v-else-if="error" state="error" :title="error"><BsButton @click="emit('retry')">{{ copy.retry }}</BsButton></BsStateSurface>
    <template v-else>
      <BsField v-slot="field" :label="copy.date"><BsInput :id="field.id" v-model="date" :aria-describedby="field.describedby" type="date" :disabled="pending || loading || refreshing" @change="emit('date')" /></BsField>
      <BsAppointmentCalendar :days="days" view="day" :copy="copy.calendar" :transitioning="pending || refreshing" @edit="emit('reschedule',$event)" @transition="(id,action) => emit('action',id,action)" />
      <BsPagination :page="page+1" :total="total" :label="copy.pages" :previous-label="copy.previous" :next-label="copy.next" @update:page="emit('page',scopeKey,$event-1)" />
      <BsPanel padding="md"><BsStack gap="md"><BsHeading :level="2">{{ copy.queue }}</BsHeading><BsText v-if="queuePolicy" as="p" size="sm" tone="muted">{{queuePolicy}}</BsText><BsDataTable :value="queue" :columns="queueColumns" row-key="id" :label="copy.queue" :scroll-label="copy.queue" lazy paginator :page-size="20" :first="queuePage*20" :total-records="queueTotal" :query-adapter="queueAdapter" :row-action-pending="pending || refreshing"><template #cell-actions="{ row }"><BsInline wrap><BsButton v-for="action in row.actions" :key="action.value" size="sm" :disabled="pending || loading || refreshing" @click="emit('action',row.id,action.value)">{{ action.label }}</BsButton></BsInline></template><template #empty><BsStateSurface state="empty" :title="copy.empty" /></template></BsDataTable></BsStack></BsPanel>
    </template>
    <BsRecordActionDialog v-model:visible="editorOpen" :pinned-actions="editor.reasonRequired" :title="editor.title" :dirty="editor.dirty" :pending="editor.pending" :error="editor.error" :submit-disabled="editor.disabled" :submit-label="copy.save" :cancel-label="copy.cancel" @submit="emit('save')">
      <BsEntityPicker v-if="editor.selectingPatient" :model-value="form.patientId" :label="copy.patient" :options="patientOptions" option-label="label" option-value="value" :loading="editor.patientLoading" :error="editor.patientError" :load-more-label="copy.loadMore" :retry-label="copy.retry" :disabled="editor.pending" @update:model-value="form.patientId=String($event || '')" @search="emit('patients',$event)" @retry="emit('patients','')" />
      <BsText v-if="editor.selectingPatient" as="p" size="sm">{{ copy.searchHint }}</BsText>
      <BsSelect v-model="form.destinationId" :label="copy.clinic" :options="clinicOptions" option-label="label" option-value="value" :disabled="editor.pending || editor.selectingPatient" @update:model-value="emit('offers')" />
      <BsSelect v-if="editor.selectingPatient && consultationLabel" v-model="form.consultationId" :label="consultationLabel" :options="consultationOptions" option-label="label" option-value="value" :disabled="editor.pending || editor.offersLoading" @update:model-value="emit('offers')" />
      <BsField v-slot="field" :label="copy.date" required><BsInput :id="field.id" v-model="form.date" :aria-describedby="field.describedby" type="date" :min="editor.earliestDate" :max="editor.latestDate" required :disabled="editor.pending" @change="emit('offers')" /></BsField>
      <BsText as="p">{{ editor.timezone }}</BsText>
      <BsStateSurface v-if="editor.offersError" state="error" :title="editor.offersError"><BsButton @click="emit('offers')">{{ copy.retry }}</BsButton></BsStateSurface>
      <BsSelect v-model="form.minute" :label="copy.slot" :options="slotOptions" option-label="label" option-value="value" :loading="editor.offersLoading" :disabled="editor.pending || editor.offersLoading" />
      <BsSelect v-if="!editor.selectingPatient && reasonOptions" v-model="form.reason" :label="copy.reason" :options="reasonOptions" option-label="label" option-value="value" :disabled="editor.pending" />
      <BsField v-else-if="!editor.selectingPatient || editor.reasonRequired" v-slot="field" :label="copy.reason" required><BsInput :id="field.id" v-model="form.reason" :aria-describedby="field.describedby" :maxlength="200" required :disabled="editor.pending" /></BsField>
    </BsRecordActionDialog>
    <BsRecordActionDialog v-model:visible="transitionOpen" :title="transition.title" :dirty="transition.dirty" :pending="transition.pending" :error="transition.error" :submit-disabled="transition.disabled" :submit-label="transition.title" :cancel-label="copy.cancel" @submit="emit('confirm')"><BsText as="p">{{ transition.description }}</BsText><BsSelect v-if="transition.reasonRequired && reasonOptions" v-model="reason" :label="copy.reason" :options="reasonOptions" option-label="label" option-value="value" :disabled="transition.pending" /><BsField v-else-if="transition.reasonRequired" v-slot="field" :label="copy.reason" required><BsInput :id="field.id" v-model="reason" :aria-describedby="field.describedby" :maxlength="200" required :disabled="transition.pending" /></BsField></BsRecordActionDialog>
    <BsDialog v-model:visible="historyOpen" :title="history.title"><BsStack gap="md">
      <BsDescriptionList v-if="history.record?.length"><BsDescriptionItem v-for="field in history.record" :key="field.id" :term="field.label">{{ field.value }}</BsDescriptionItem></BsDescriptionList>
      <BsStateSurface v-if="history.error" state="error" :title="history.error"><BsButton @click="emit('historyRetry')">{{ copy.retry }}</BsButton></BsStateSurface>
      <BsSectionSkeleton v-else-if="history.hasHistory === false && history.loading" :rows="3" />
      <template v-else-if="history.hasHistory !== false"><BsDataTable :value="history.rows" :columns="historyColumns" row-key="id" :label="history.title" :loading="history.loading" /><BsPagination :page="history.page+1" :total="history.total" :label="copy.pages" :previous-label="copy.previous" :next-label="copy.next" @update:page="emit('historyPage',$event-1)" /></template>
      <BsButton v-else @click="emit('historyRetry')">{{ history.loadLabel || copy.history }}</BsButton>
    </BsStack></BsDialog>
  </BsStack>
</template>
