<script setup lang="ts">
const { t } = useI18n()
</script>

<template>
  <div class="min-h-dvh bg-[#0b0b0d] text-[#fafafa] lg:grid lg:grid-cols-[minmax(0,0.9fr)_minmax(34rem,1.1fr)]">
    <!-- Ledger Suit-style brand side: graphite first, navy/gold only as brand accents. -->
    <aside class="relative hidden min-h-dvh overflow-hidden border-e border-white/10 lg:flex lg:flex-col lg:justify-between lg:p-10 xl:p-14">
      <div
        class="pointer-events-none absolute inset-0 opacity-90"
        style="background:
          radial-gradient(circle at 18% 15%, rgba(216,155,66,.18), transparent 28rem),
          radial-gradient(circle at 90% 85%, rgba(22,41,59,.55), transparent 34rem);"
      />

      <div class="relative z-10">
        <NuxtLink to="/" class="inline-flex items-center gap-3">
          <div class="grid size-11 place-items-center rounded-xl border border-[#d89b42]/35 bg-[#141416] shadow-2xl">
            <span class="text-lg font-extrabold text-[#ebb45a]">S</span>
          </div>
          <div>
            <p class="text-lg font-extrabold tracking-tight">Shop Suit</p>
            <p class="text-xs text-white/50">by Building Suit</p>
          </div>
        </NuxtLink>
      </div>

      <div class="relative z-10 max-w-xl space-y-5">
        <div class="inline-flex items-center gap-2 rounded-full border border-[#d89b42]/25 bg-[#d89b42]/10 px-3 py-1.5 text-xs font-semibold text-[#f4ce86]">
          <span class="size-1.5 rounded-full bg-[#ebb45a]" />
          {{ t('hero.badge') }}
        </div>

        <h1 class="max-w-lg text-4xl font-extrabold leading-tight tracking-tight xl:text-5xl">
          {{ t('hero.title') }}
          <span class="block text-[#ebb45a]">{{ t('hero.subtitle') }}</span>
        </h1>

        <p class="max-w-lg text-base leading-7 text-white/60">
          {{ t('hero.description') }}
        </p>

        <div class="grid max-w-lg grid-cols-3 gap-3 pt-3">
          <div class="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
            <Icon name="lucide:receipt-text" class="mb-3 size-5 text-[#ebb45a]" />
            <p class="text-xs font-semibold text-white/75">Invoices</p>
          </div>
          <div class="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
            <Icon name="lucide:package-check" class="mb-3 size-5 text-[#ebb45a]" />
            <p class="text-xs font-semibold text-white/75">Inventory</p>
          </div>
          <div class="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
            <Icon name="lucide:chart-no-axes-combined" class="mb-3 size-5 text-[#ebb45a]" />
            <p class="text-xs font-semibold text-white/75">Profit</p>
          </div>
        </div>
      </div>

      <p class="relative z-10 text-xs text-white/35">
        © {{ new Date().getFullYear() }} Shop Suit · Building Suit
      </p>
    </aside>

    <!-- Form side -->
    <main class="flex min-h-dvh items-center justify-center bg-[var(--background)] px-5 py-8 text-[var(--foreground)] sm:px-8 lg:px-12">
      <div class="w-full max-w-[30rem]">
        <header class="mb-10 flex items-center justify-between lg:hidden">
          <NuxtLink to="/" class="inline-flex items-center gap-3">
            <div class="grid size-10 place-items-center rounded-xl bg-[#141416]">
              <span class="font-extrabold text-[#ebb45a]">S</span>
            </div>
            <div>
              <p class="font-extrabold leading-none">Shop Suit</p>
              <p class="mt-1 text-[11px] text-muted-foreground">by Building Suit</p>
            </div>
          </NuxtLink>
          <ThemeToggle />
        </header>

        <slot />
      </div>
    </main>
  </div>
</template>
