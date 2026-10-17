<script setup lang="ts">
import { doctorPageMetadata } from './utils/previewMetadata'
import { usePageExitCleanup, useFreshPageOnRestore, usePageRevalidation } from '@building-suit/ux'
const context = useDoctorContext()
const auth = useDoctorAuth()
const route = useRoute()
const nuxt = useNuxtApp()
const transitioning = ref(false)
const stopStart = nuxt.hook('page:loading:start', () => { transitioning.value = true })
const stopEnd = nuxt.hook('page:loading:end', () => { transitioning.value = false })
onBeforeUnmount(() => { stopStart(); stopEnd() })
const revalidation = usePageRevalidation(() => context.refresh(), () => !transitioning.value && auth.state.phase === 'authenticated' && /^\/(?:workspace|locations|team|patients|appointments|availability|settings|audit)(?:\/|$)/.test(route.path))
watch(() => [auth.state.phase, auth.state.identity?.userId, auth.state.identity?.sessionId, route.path, transitioning.value].join(':'), () => { void revalidation.refresh() })
usePageExitCleanup(() => { void context.clear() })
useFreshPageOnRestore()
const { locale, localeProperties,t } = useI18n()
const metadata = computed(() => doctorPageMetadata(route.path,locale.value==='ar',{ title: t('workflow'),description: t('description') }))
useHead(() => ({ title: metadata.value.title }))
useSeoMeta({ description: () => metadata.value.description,robots: () => metadata.value.robots,
  ogTitle: () => metadata.value.publicPage ? metadata.value.title : undefined,
  ogDescription: () => metadata.value.publicPage ? metadata.value.description : undefined,
  ogLocale: () => metadata.value.publicPage ? metadata.value.locale : undefined,
  twitterCard: () => metadata.value.publicPage ? 'summary' : undefined,
  twitterTitle: () => metadata.value.publicPage ? metadata.value.title : undefined,
  twitterDescription: () => metadata.value.publicPage ? metadata.value.description : undefined,
})
useHead(() => ({ htmlAttrs: { lang: localeProperties.value.language || locale.value, dir: localeProperties.value.dir || 'ltr' } }))
</script>
<template><BsAppRoot toast-host /></template>
