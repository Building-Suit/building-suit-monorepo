<script setup lang="ts">
definePageMeta({ layout: 'practice',middleware: 'doctor-auth' })
const { state,copy,search,scopeKey,hydrated,rows,windowLabel,error,controls,reload,submit,page } = useDoctorAuditPage()
</script>
<template>
  <BsAuditHistoryPage :key="scopeKey || 'no-audit-scope'" v-model:search="search" :items="rows" :copy="copy" :window-label="windowLabel" :error-message="error" :loading="state.pending || !hydrated" :loading-more="false" :has-more="false" summary-only :controls="controls" @search="submit" @retry="reload" @page="page" />
</template>
