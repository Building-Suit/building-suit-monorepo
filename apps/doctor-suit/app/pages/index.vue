<script setup lang="ts">
import { doctorLandingContent } from '../utils/landingPresentation'
definePageMeta({ layout: 'marketing' })
const { locale } = useI18n()
const content = computed(() => doctorLandingContent(locale.value === 'ar'))
</script>
<template><BsLandingPage :content="content" :preview="{ kind:'features' }" signup-path="/sign-up" /></template>
