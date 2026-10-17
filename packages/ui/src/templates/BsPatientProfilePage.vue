<script setup lang="ts">
import type { BsDataTableRowAction } from '@building-suit/ux'
interface FileRow { id: string; versionId: string; name: string; revision: string; size: string; mime: string; uploader: string; uploaded: string; location: string; status: string; canReplace: boolean; canArchive: boolean; canDownload: boolean; canPreview: boolean }
interface VersionRow { id: string; documentId: string; name: string; revision: string; size: string; uploader: string; uploaded: string; location: string; canDownload: boolean; canPreview: boolean }
const props = defineProps<{
  title: string; scopeLabel: string; backHref: string; notice: string; loading: boolean; error: string | null; denied: string | null
  profile: { name: string; fields: { label: string; value: string }[]; source: string } | null
  activity: { id: number; event: string; actor: string; location: string; date: string; version: string }[]; activityCount: string
  documents: { rows: FileRow[]; total: number; page: number; size: number; loading: boolean; error: string | null; denied: boolean; canUpload: boolean; pending: boolean; actionError: string | null }
  upload: { title: string; dirty: boolean; pending: boolean; error: string | null; disabled: boolean }
  history: { rows: VersionRow[]; total: number; page: number; loading: boolean; error: string | null; events: { id: number; event: string; actor: string; location: string; date: string }[] }
  preview: { url: string; name: string }
  copy: { back: string; retry: string; identity: string; activity: string; attachments: string; attachmentNotice: string; denied: string; name: string; revision: string; size: string; mime: string; uploader: string; uploaded: string; location: string; status: string; actions: string; upload: string; replace: string; archive: string; history: string; download: string; preview: string; close: string; cancel: string; save: string; file: string; fileHelp: string; event: string; actor: string; date: string; version: string; empty: string; archiveDescription: string; unreviewed: string }
}>()
const file = defineModel<File | null>('file',{ required: true })
const uploadOpen = defineModel<boolean>('uploadOpen',{ required: true })
const historyOpen = defineModel<boolean>('historyOpen',{ required: true })
const previewOpen = defineModel<boolean>('previewOpen',{ required: true })
const emit = defineEmits<{ retry: []; retryDocuments: []; upload: []; replace: [id: string]; archive: [id: string]; save: []; history: [id: string]; download: [id: string,versionId: string]; preview: [id: string,versionId: string]; documentsPage: [page: number,size: number]; historyPage: [page: number]; retryHistory: [] }>()
const fileColumns = computed(() => [{ key: 'name',field: 'name',header: props.copy.name },{ key: 'revision',field: 'revision',header: props.copy.revision },{ key: 'size',field: 'size',header: props.copy.size },{ key: 'uploader',field: 'uploader',header: props.copy.uploader },{ key: 'uploaded',field: 'uploaded',header: props.copy.uploaded },{ key: 'location',field: 'location',header: props.copy.location },{ key: 'status',field: 'status',header: props.copy.status },{ key: 'delivery',header: props.copy.actions }])
const versionColumns = computed(() => fileColumns.value.filter(column => column.key!=='status'))
const activityColumns = computed(() => [{ key: 'event',field: 'event',header: props.copy.event },{ key: 'actor',field: 'actor',header: props.copy.actor },{ key: 'location',field: 'location',header: props.copy.location },{ key: 'date',field: 'date',header: props.copy.date },{ key: 'version',field: 'version',header: props.copy.version }])
const eventColumns = computed(() => activityColumns.value.filter(column => column.key!=='version'))
function canAction(action: BsDataTableRowAction,row: FileRow) { return action==='edit' ? row.canReplace : action==='archive' ? row.canArchive : false }
</script>
<template>
  <BsStack gap="lg">
    <BsPageHeader :title="profile?.name || title" :subtitle="scopeLabel"><template #actions><BsLink :to="backHref">{{ copy.back }}</BsLink></template></BsPageHeader>
    <BsAlert tone="info" :description="notice" />
    <BsStateSurface v-if="denied" state="permission" :title="denied" />
    <BsSectionSkeleton v-else-if="loading" :rows="4" />
    <BsStateSurface v-else-if="error" state="error" :title="error"><BsButton @click="emit('retry')">{{ copy.retry }}</BsButton></BsStateSurface>
    <template v-else-if="profile">
      <BsPanel padding="md"><BsStack gap="md"><BsHeading :level="2">{{ copy.identity }}</BsHeading><BsText as="p">{{ profile.source }}</BsText><BsDescriptionList :columns="2"><BsDescriptionItem v-for="field in profile.fields" :key="field.label" :term="field.label">{{ field.value }}</BsDescriptionItem></BsDescriptionList></BsStack></BsPanel>
      <BsPanel padding="md"><BsStack gap="md"><BsHeading :level="2">{{ copy.activity }}</BsHeading><BsText as="p" size="sm">{{ activityCount }}</BsText><BsDataTable :value="activity" :columns="activityColumns" row-key="id" :label="copy.activity" /></BsStack></BsPanel>
      <BsPanel padding="md"><BsStack gap="md">
        <BsInline justify="between"><BsHeading :level="2">{{ copy.attachments }}</BsHeading><BsButton v-if="documents.canUpload" variant="primary" :disabled="documents.pending" @click="emit('upload')">{{ copy.upload }}</BsButton></BsInline>
        <BsAlert tone="info" :description="copy.attachmentNotice" />
        <BsAlert v-if="documents.actionError" tone="error" :description="documents.actionError" />
        <BsStateSurface v-if="documents.denied" state="permission" :title="copy.denied" />
        <template v-else>
          <BsAlert v-if="documents.error" tone="warning" :description="documents.error"><BsButton @click="emit('retryDocuments')">{{ copy.retry }}</BsButton></BsAlert>
          <BsDataTable :value="documents.rows" :columns="fileColumns" row-key="id" :label="copy.attachments" :loading="documents.loading" lazy paginator :first="documents.page*documents.size" :page-size="documents.size" :total-records="documents.total" :row-action-pending="documents.pending" :capabilities="{ edit: true,archive: true }" :can-row-action="canAction" :action-labels="{ edit: copy.replace,archive: copy.archive }" @edit="emit('replace',$event.id)" @archive="emit('archive',$event.id)" @page="emit('documentsPage',$event.page,$event.rows)">
            <template #cell-name="{ row }"><BsButton variant="link" :disabled="documents.pending" @click="emit('history',row.id)">{{ row.name }}</BsButton></template>
            <template #cell-delivery="{ row }"><BsInline><BsButton :disabled="!row.canDownload || documents.pending" @click="emit('download',row.id,row.versionId)">{{ copy.download }}</BsButton><BsButton v-if="row.canPreview" :disabled="!row.canDownload || documents.pending" @click="emit('preview',row.id,row.versionId)">{{ copy.preview }}</BsButton></BsInline></template>
            <template #empty><BsStateSurface state="empty" :title="copy.empty" /></template>
          </BsDataTable>
        </template>
      </BsStack></BsPanel>
    </template>
    <BsRecordActionDialog v-model:visible="uploadOpen" :title="upload.title" :dirty="upload.dirty" :pending="upload.pending" :error="upload.error" :submit-label="copy.save" :cancel-label="copy.cancel" :submit-disabled="upload.disabled" @submit="emit('save')"><BsText as="p">{{ copy.unreviewed }}</BsText><BsFileDrop v-model="file" :label="copy.file" :description="copy.fileHelp" accept="application/pdf,image/png,image/jpeg" :disabled="upload.pending" /></BsRecordActionDialog>
    <BsDialog v-model:visible="historyOpen" :title="copy.history" size="lg" :pending="documents.pending">
      <BsStack gap="md"><BsAlert tone="info" :description="copy.unreviewed" /><BsStateSurface v-if="history.error" state="error" :title="history.error"><BsButton @click="emit('retryHistory')">{{ copy.retry }}</BsButton></BsStateSurface>
        <BsDataTable :value="history.rows" :columns="versionColumns" row-key="id" :label="copy.history" :loading="history.loading" lazy paginator :first="history.page*20" :page-size="20" :total-records="history.total" @page="emit('historyPage',$event.page)"><template #cell-delivery="{ row }"><BsInline><BsButton :disabled="!row.canDownload || documents.pending" @click="emit('download',row.documentId,row.id)">{{ copy.download }}</BsButton><BsButton v-if="row.canPreview" :disabled="!row.canDownload || documents.pending" @click="emit('preview',row.documentId,row.id)">{{ copy.preview }}</BsButton></BsInline></template></BsDataTable>
        <BsDataTable :value="history.events" :columns="eventColumns" row-key="id" :label="copy.activity" />
      </BsStack>
    </BsDialog>
    <BsDialog v-model:visible="previewOpen" :title="preview.name" size="lg"><BsStack gap="md"><BsAlert tone="info" :description="copy.unreviewed" /><BsImage v-if="preview.url" :src="preview.url" :alt="preview.name" fit="contain" /></BsStack></BsDialog>
  </BsStack>
</template>
