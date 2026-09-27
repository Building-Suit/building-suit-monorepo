<script setup lang="ts">
withDefaults(defineProps<{
  navigation: Array<{ to: string; label: string }>
  legalLinks: Array<{ to: string; label: string }>
  labels: { home: string; navigation: string; openApp: string; signIn: string; startTrial: string; close: string; open: string; footer: string; footerNavigation: string }
  signedIn?: boolean; loginPath?: string; signupPath?: string; dashboardPath?: string
}>(), { signedIn: false, loginPath: '/login', signupPath: '/signup', dashboardPath: '/dashboard' })

const route = useRoute()
const hydrated = ref(false)
const mobileNavOpen = ref(false)
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
watch(() => route.fullPath, () => { mobileNavOpen.value = false })
</script>

<template>
  <div class="bs-marketing min-h-dvh bg-background text-fg" :data-hydrated="hydrated">
    <div ref="topSentinel" class="pointer-events-none absolute inset-x-0 top-0 h-px" aria-hidden="true" />
    <header class="bs-marketing-header sticky top-0 z-30" :class="{ 'is-elevated': headerElevated, 'is-open': mobileNavOpen }">
      <div class="mx-auto flex min-h-[4.5rem] max-w-[90rem] items-center gap-3 px-5 sm:px-8 lg:px-12">
        <NuxtLink to="/" class="inline-flex shrink-0" :aria-label="labels.home">
          <slot name="logo" />
        </NuxtLink>

        <nav class="ms-auto hidden items-center gap-1 text-sm xl:flex" :aria-label="labels.navigation">
          <NuxtLink v-for="item in navigation" :key="item.to" :to="item.to" class="bs-marketing-nav-link">
            {{ item.label }}
          </NuxtLink>
        </nav>

        <div class="ms-auto flex items-center gap-2 xl:ms-3">
          <SettingsMenu />
          <NuxtLink :to="signedIn ? dashboardPath : loginPath" class="ls-btn ls-btn-sm hidden xl:inline-flex">
            {{ signedIn ? labels.openApp : labels.signIn }}
          </NuxtLink>
          <NuxtLink v-if="!signedIn" :to="signupPath" class="ls-btn ls-btn-primary ls-btn-sm hidden xl:inline-flex">
            {{ labels.startTrial }}
          </NuxtLink>
          <button
            type="button"
            class="ls-btn ls-btn-sm xl:hidden"
            :aria-label="mobileNavOpen ? labels.close : labels.open"
            :aria-expanded="mobileNavOpen"
            aria-controls="marketing-mobile-navigation"
            @click="mobileNavOpen = !mobileNavOpen"
          >
            <AppIcon :name="mobileNavOpen ? 'close' : 'menu'" />
          </button>
        </div>
      </div>

      <Transition name="bs-marketing-menu">
        <div v-if="mobileNavOpen" id="marketing-mobile-navigation" class="bs-marketing-mobile xl:hidden">
          <div class="mx-auto max-w-[90rem] px-5 py-5 sm:px-8 lg:px-12">
            <nav class="grid text-sm" :aria-label="labels.navigation">
              <NuxtLink v-for="item in navigation" :key="`mobile-${item.to}`" :to="item.to" class="bs-marketing-mobile-link">
                <span>{{ item.label }}</span><AppIcon name="arrowRight" directional />
              </NuxtLink>
            </nav>
            <div class="mt-5 grid grid-cols-2 gap-2 border-t border-line pt-5">
              <NuxtLink :to="signedIn ? dashboardPath : loginPath" class="ls-btn ls-btn-sm">
                {{ signedIn ? labels.openApp : labels.signIn }}
              </NuxtLink>
              <NuxtLink v-if="!signedIn" :to="signupPath" class="ls-btn ls-btn-primary ls-btn-sm">
                {{ labels.startTrial }}
              </NuxtLink>
            </div>
          </div>
        </div>
      </Transition>
    </header>

    <slot />

    <footer class="bs-marketing-footer border-t border-line">
      <div class="mx-auto grid max-w-[90rem] gap-8 px-5 py-10 text-xs text-fg-muted sm:px-8 md:grid-cols-[1fr_auto] md:items-end lg:px-12">
        <div>
          <slot name="logo" />
          <p class="mt-5 max-w-sm text-sm leading-6">{{ labels.footer }}</p>
        </div>
        <div class="md:text-end">
          <nav class="flex flex-wrap gap-x-5 gap-y-3 md:justify-end" :aria-label="labels.footerNavigation">
            <NuxtLink v-for="item in legalLinks" :key="item.to" :to="item.to" class="hover:text-fg">
              {{ item.label }}
            </NuxtLink>
          </nav>
          <p class="mt-5" dir="ltr">© {{ new Date().getFullYear() }} Building Suit</p>
        </div>
      </div>
    </footer>
  </div>
</template>
