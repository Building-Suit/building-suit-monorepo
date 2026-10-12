<script setup lang="ts">
defineProps<{ legalLinks: Array<{ to: string; label: string }>; footer: string; navigationLabel: string; copyright?: string }>()
</script>
<template>
  <footer class="bs-marketing-footer border-t border-line">
    <div class="mx-auto grid max-w-[90rem] gap-8 px-5 py-10 text-xs text-fg-muted sm:px-8 md:grid-cols-[1fr_auto] md:items-end lg:px-12">
      <div><slot name="logo" /><p class="mt-5 max-w-sm text-sm leading-6">{{ footer }}</p></div>
      <div class="md:text-end">
        <nav class="flex flex-wrap gap-x-5 gap-y-3 md:justify-end" :aria-label="navigationLabel"><NuxtLink v-for="item in legalLinks" :key="item.to" :to="item.to" class="hover:text-fg">{{ item.label }}</NuxtLink></nav>
        <p class="mt-5" dir="ltr">© {{ new Date().getFullYear() }} {{ copyright || 'Building Suit' }}</p>
      </div>
    </div>
  </footer>
</template>
