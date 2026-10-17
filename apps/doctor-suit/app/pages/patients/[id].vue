<script setup lang="ts">
definePageMeta({ layout: 'practice',middleware: 'doctor-auth' })
const { context,profile,copy,scopeKey,hydrated,file,uploadOpen,historyOpen,previewOpen,reload,view,scopeLabel,backHref,activity,activityCount,documentsView,uploadView,historyView,previewView,error,openUpload,save,archive,showHistory,download,showPreview,documentsPage,retryDocuments,historyPage,retryHistory } = useDoctorPatientProfile()
await context.refresh()
await reload()
</script>
<template>
  <BsPatientProfilePage :key="scopeKey || 'no-context'" v-model:file="file" v-model:upload-open="uploadOpen" v-model:history-open="historyOpen" v-model:preview-open="previewOpen" :title="copy.title" :scope-label="scopeLabel" :back-href="backHref" :notice="copy.notice" :loading="profile.state.loading || !hydrated" :error="error" :denied="!scopeKey ? copy.denied : null" :profile="view" :activity="activity" :activity-count="activityCount" :documents="documentsView" :upload="uploadView" :history="historyView" :preview="previewView" :copy="copy" @retry="reload" @retry-documents="retryDocuments" @upload="openUpload()" @replace="openUpload" @archive="archive" @save="save" @history="showHistory" @download="download" @preview="showPreview" @documents-page="documentsPage" @history-page="historyPage" @retry-history="retryHistory" />
</template>
