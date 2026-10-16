<script setup lang="ts">
import { usePageExitCleanup, useFreshPageOnRestore } from '@building-suit/ux'
const practice = useDoctorPractice()
usePageExitCleanup(() => practice.clear())
useFreshPageOnRestore()
const { locale, localeProperties } = useI18n()
useHead(() => ({ htmlAttrs: { lang: localeProperties.value.language || locale.value, dir: localeProperties.value.dir || 'ltr' } }))
</script>
<template><BsAppRoot toast-host /></template>
