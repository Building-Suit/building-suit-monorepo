<script setup lang="ts">
const { isMenuOpen, toggleMenu } = useNavigation();
</script>

<template>
  <!-- Simple top nav -->
  <header
    :class="[
      'w-full border-b dark:border-gray-800 bg-white/80 dark:bg-gray-900/80 backdrop-blur',
      'fixed top-0 z-50',
    ]"
  >
    <div
      :class="[
        'max-w-6xl mx-auto',
        'flex items-center justify-between px-4 py-3',
        'z-50',
      ]"
    >
      <NuxtLink to="/" class="flex flex-col items-center">
        <span class="font-extrabold text-xl tracking-tight text-primary">
          Shop CRM
        </span>
        <span class="text-xs opacity-70 tracking-tight">
          by <strong>Building Suit</strong>
        </span>
      </NuxtLink>

      <div class="lg:flex hidden items-center gap-2">
        <LandingHeaderNavLinks />
      </div>

      <LandingHeaderCTAs class="lg:flex hidden items-center gap-2" />

      <div
        class="lg:hidden flex items-center gap-2"
        @click="() => toggleMenu()"
      >
        <Icon
          v-show="!isMenuOpen"
          name="solar:hamburger-menu-outline"
          size="32"
        />
        <Icon v-show="isMenuOpen" name="solar:close-circle-outline" size="32" />
      </div>
    </div>

    <Transition name="slide-fade">
      <div
        v-if="isMenuOpen"
        :class="[
          'lg:hidden grid items-start gap-2 p-4 bg-background',
          'absolute inset-x-0 -z-10 overflow-hidden',
          'border-b border-border',
        ]"
      >
        <LandingHeaderNavLinks />

        <LandingHeaderCTAs
          class="grid items-center gap-2 border-t border-border pt-4"
        />
      </div>
    </Transition>
  </header>
</template>

<style>
.slide-fade-enter-active {
  transition: all 0.1s ease-out;
}
.slide-fade-leave-active {
  transition: all 0.1s ease-in;
}
.slide-fade-enter-from,
.slide-fade-leave-to {
  opacity: 0;
  transform: translateY(-20px);
}
</style>
