<script setup lang="ts">
definePageMeta({ layout: 'practice',middleware: 'doctor-auth' })
const { context,patients,query,form,acknowledged,copy,scopeKey,scopeLabel,hydrated,canCreate,rows,editorView,archiveView,editorOpen,archiveOpen,create,edit,archive,save,confirmArchive,reload,search,page,status,statusOptions,error } = useDoctorPatientDirectory()
await context.refresh()
await reload()
</script>
<template>
  <BsPatientDirectoryPage :key="scopeKey || 'no-context'" v-model:form="form" v-model:editor-open="editorOpen" v-model:archive-open="archiveOpen" v-model:acknowledged="acknowledged" :title="copy.title" :description="copy.description" :scope-label="scopeLabel" :notice="copy.notice" :rows="rows" :total="patients.state.directory?.total || 0" :page="query.page" :page-size="query.size" :scope-key="scopeKey" :status="query.status" :status-options="statusOptions" :loading="patients.state.loading || !hydrated" :error="error" :denied="!scopeKey ? copy.denied : null" :can-create="canCreate" :copy="copy" :editor="editorView" :archive="archiveView" @create="create" @edit="edit" @archive="archive" @save="save" @confirm-archive="confirmArchive" @retry="reload" @search="search" @page="page" @status="status" />
</template>
