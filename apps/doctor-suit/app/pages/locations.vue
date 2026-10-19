<script setup lang="ts">
definePageMeta({ layout: 'practice', middleware: 'doctor-auth' })
const { context, locations, copy, hydrated, query, form, scopeKey, search, page, error, rows, editorView, archiveView, editorOpen, archiveOpen, create, edit, archive, save, confirmArchive, reload } = useDoctorLocationManagement()
await context.refresh()
await reload()
</script>
<template>
  <BsLocationManagementPage :key="scopeKey || 'no-context'" v-model:form="form" v-model:editor-open="editorOpen" v-model:archive-open="archiveOpen" :title="copy.title" :description="copy.description" :practice-name="locations.state.directory?.practiceName || ''" :rows="rows" :total="locations.state.directory?.total || 0" :page="query.page" :page-size="query.size" :scope-key="scopeKey" :loading="locations.state.loading || !hydrated" :error="error" :denied="!scopeKey ? copy.denied : undefined" :can-create="hydrated && Boolean(locations.state.directory?.canCreate)" :copy="copy" :editor="editorView" :archive="archiveView" :limits="{ name: 160, timezone: 100, phone: 60, address: 500 }" @create="create" @edit="edit" @archive="archive" @save="save" @confirm-archive="confirmArchive" @retry="reload" @search="search" @page="page" />
</template>
