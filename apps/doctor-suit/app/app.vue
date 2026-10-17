<script setup lang="ts">
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
const { locale, localeProperties } = useI18n()
useHead(() => ({ htmlAttrs: { lang: localeProperties.value.language || locale.value, dir: localeProperties.value.dir || 'ltr' } }))
</script>
<template><BsAppRoot toast-host /></template>
