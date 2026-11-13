<script setup lang="ts">
import { doctorPolicyDocument } from '../../utils/policyPresentation'
definePageMeta({ layout: 'marketing' })
const { locale } = useI18n()
const document = computed(() => doctorPolicyDocument('health-data',locale.value === 'ar'))
</script>
<template><BsPublicLegalPage presentation="flat" :document="document" eyebrow="Doctor Suit" :last-updated-label="locale === 'ar' ? 'تاريخ المسودة' : 'Draft updated'" /></template>
