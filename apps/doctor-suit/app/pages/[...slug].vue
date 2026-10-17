<script setup lang="ts">
import { doctorMissingPage } from '../utils/previewMetadata'
definePageMeta({ layout: 'default' })
const { locale } = useI18n()
const copy = computed(() => doctorMissingPage(locale.value==='ar'))
if(import.meta.server) { const event = useRequestEvent();if(event)setResponseStatus(event,404) }
useHead(() => ({ title: `Doctor Suit · ${copy.value.title}` }))
</script>
<template><BsRouteStatusPage :status="404" :title="copy.title" :description="copy.description" :links="copy.links" /></template>
