<script setup lang="ts">
import { doctorLaunchPricing } from '../utils/launchPricing'
import { doctorLandingContent } from '../utils/landingPresentation'
definePageMeta({ layout: 'marketing' })
const interval=ref('monthly')
const pricing=computed(()=>doctorLaunchPricing(locale.value==='ar',interval.value))
const { locale } = useI18n()
const content = computed(() => doctorLandingContent(locale.value === 'ar'))
</script>
<template><BsLandingPage :content="content" :pricing="pricing" :preview="{ kind:'features' }" signup-path="/sign-up" @interval="interval=$event" /></template>
