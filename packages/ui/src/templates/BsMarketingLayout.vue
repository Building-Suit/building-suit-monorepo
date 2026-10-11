<script setup lang="ts">
withDefaults(defineProps<{
  navigation: Array<{ to: string; label: string }>
  legalLinks: Array<{ to: string; label: string }>
  labels: { home: string; navigation: string; openApp: string; signIn: string; startTrial: string; close: string; open: string; footer: string; footerNavigation: string }
  signedIn?: boolean; loginPath?: string; signupPath?: string; dashboardPath?: string
}>(), { signedIn: false, loginPath: '/login', signupPath: '/signup', dashboardPath: '/dashboard' })

const hydrated = ref(false)
const topSentinel = ref<HTMLElement | null>(null)
const headerElevated = ref(false)
let topObserver: IntersectionObserver | undefined

useTheme()

onMounted(() => {
  hydrated.value = true
  if (topSentinel.value) {
    topObserver = new IntersectionObserver(([entry]) => { headerElevated.value = !entry?.isIntersecting }, { threshold: 0.01 })
    topObserver.observe(topSentinel.value)
  }
})
onBeforeUnmount(() => topObserver?.disconnect())
</script>

<template>
  <div class="bs-marketing min-h-dvh bg-background text-fg" :data-hydrated="hydrated">
    <div ref="topSentinel" class="pointer-events-none absolute inset-x-0 top-0 h-px" aria-hidden="true" />
    <BsLandingTopHeader :navigation="navigation" :labels="labels" :signed-in="signedIn" :login-path="loginPath" :signup-path="signupPath" :dashboard-path="dashboardPath" :elevated="headerElevated"><template #logo><slot name="logo" /></template></BsLandingTopHeader>

    <slot />

    <BsLandingFooter :legal-links="legalLinks" :footer="labels.footer" :navigation-label="labels.footerNavigation"><template #logo><slot name="logo" /></template></BsLandingFooter>
  </div>
</template>
