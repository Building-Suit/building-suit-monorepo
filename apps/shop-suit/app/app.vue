<script setup lang="ts">
const website = isTenantWebsiteRequest()
const privateApp = website ? null : useShopPrivateApplication()
const renderPage = computed(() => website || privateApp!.canRenderPage.value)
const layout = computed(() => website ? false as const : privateApp!.pageLayout.value)
const layoutKey = computed(() => website ? 'public-website' : privateApp!.layoutKey.value)
const pageKey = computed(() => website ? 'public-website' : privateApp!.pageKey.value)
const privacy = privateApp?.privacy
</script>
<template><BsAppRoot :privacy="privacy" :render-page="renderPage" :layout="layout" :layout-key="layoutKey" :page-key="pageKey" /></template>
