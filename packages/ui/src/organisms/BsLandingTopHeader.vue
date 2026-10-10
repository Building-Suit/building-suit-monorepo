<script setup lang="ts">
withDefaults(defineProps<{
  navigation: Array<{ to: string; label: string }>
  labels: { home: string; navigation: string; openApp: string; signIn: string; startTrial: string; close: string; open: string }
  signedIn?: boolean
  loginPath?: string
  signupPath?: string
  dashboardPath?: string
  elevated?: boolean
}>(), { signedIn: false, loginPath: '/login', signupPath: '/signup', dashboardPath: '/dashboard', elevated: false })

const open = ref(false)
const route = useRoute()
watch(() => route.fullPath, () => { open.value = false })
defineExpose({ close: () => { open.value = false } })
</script>

<template>
  <header class="bs-marketing-header sticky top-0 z-30" :class="{ 'is-elevated': elevated, 'is-open': open }">
    <div class="mx-auto flex min-h-[4.5rem] max-w-[90rem] items-center gap-3 px-5 sm:px-8 lg:px-12">
      <NuxtLink to="/" class="inline-flex shrink-0" :aria-label="labels.home"><slot name="logo" /></NuxtLink>
      <nav class="ms-auto hidden items-center gap-1 text-sm xl:flex" :aria-label="labels.navigation">
        <NuxtLink v-for="item in navigation" :key="item.to" :to="item.to" class="bs-marketing-nav-link">{{ item.label }}</NuxtLink>
      </nav>
      <div class="ms-auto flex items-center gap-2 xl:ms-3">
        <BsSettingsMenu />
        <NuxtLink :to="signedIn ? dashboardPath : loginPath" class="ls-btn ls-btn-sm hidden xl:inline-flex">{{ signedIn ? labels.openApp : labels.signIn }}</NuxtLink>
        <NuxtLink v-if="!signedIn" :to="signupPath" class="ls-btn ls-btn-primary ls-btn-sm hidden xl:inline-flex">{{ labels.startTrial }}</NuxtLink>
        <button type="button" class="ls-btn ls-btn-sm xl:hidden" :aria-label="open ? labels.close : labels.open" :aria-expanded="open" aria-controls="marketing-mobile-navigation" @click="open = !open"><BsIcon :name="open ? 'close' : 'menu'" /></button>
      </div>
    </div>
    <Transition name="bs-marketing-menu">
      <div v-if="open" id="marketing-mobile-navigation" class="bs-marketing-mobile xl:hidden">
        <div class="mx-auto max-w-[90rem] px-5 py-5 sm:px-8 lg:px-12">
          <nav class="grid text-sm" :aria-label="labels.navigation">
            <NuxtLink v-for="item in navigation" :key="`mobile-${item.to}`" :to="item.to" class="bs-marketing-mobile-link"><span>{{ item.label }}</span><BsIcon name="arrowRight" directional /></NuxtLink>
          </nav>
          <div class="mt-5 grid grid-cols-2 gap-2 border-t border-line pt-5">
            <NuxtLink :to="signedIn ? dashboardPath : loginPath" class="ls-btn ls-btn-sm">{{ signedIn ? labels.openApp : labels.signIn }}</NuxtLink>
            <NuxtLink v-if="!signedIn" :to="signupPath" class="ls-btn ls-btn-primary ls-btn-sm">{{ labels.startTrial }}</NuxtLink>
          </div>
        </div>
      </div>
    </Transition>
  </header>
</template>
