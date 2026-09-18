<script setup lang="ts">
defineProps<{ wide?: boolean; productName: string; homeLabel: string; title: string; description: string }>()
defineSlots<{ default(): unknown; logo(props: { tone: 'auto' | 'light' | 'dark' }): unknown; legal(): unknown }>()
useTheme()
</script>
<template>
  <main class="ls-auth-page min-h-dvh lg:grid lg:grid-cols-[minmax(0,.92fr)_minmax(0,1.08fr)]">
    <section class="ls-auth-panel flex items-center justify-center px-5 py-10 sm:px-8 lg:px-12">
      <div class="ls-auth-form-shell flex w-full flex-col items-center" :class="wide ? 'max-w-[36rem]' : 'max-w-[27rem]'">
        <NuxtLink to="/" class="mb-12 inline-flex lg:hidden" :aria-label="homeLabel">
          <slot name="logo" :tone="'auto'" />
        </NuxtLink>
        <slot />
        <slot name="legal" />
        <div class="mt-5 flex justify-center"><SettingsMenu /></div>
      </div>
    </section>
    <section class="ls-auth-showcase relative hidden overflow-hidden lg:flex lg:items-center lg:justify-center" :aria-label="productName">

      <div class="ls-auth-orbit ls-auth-orbit-one" aria-hidden="true" />
      <div class="ls-auth-orbit ls-auth-orbit-two" aria-hidden="true" />
      <div class="ls-auth-showcase-content relative z-10 flex max-w-xl flex-col items-center px-12 text-center">
        <NuxtLink to="/" class="ls-auth-brand z-10 inline-flex" :aria-label="homeLabel">
          <slot name="logo" :tone="'light'" />
        </NuxtLink>
        <h2 class="mt-5 text-5xl font-black leading-[1.25] tracking-[-.045em]">{{ title }}</h2>
        <p class="ls-brand-hero-muted mt-6 max-w-lg text-base leading-8">{{ description }}</p>
        <div class="ls-auth-ledger mt-12" aria-hidden="true">
          <div class="ls-auth-ledger-top"><span /><span /><span /></div>
          <div class="ls-auth-ledger-row"><span /><i /></div>
          <div class="ls-auth-ledger-row"><span /><i /></div>
          <div class="ls-auth-ledger-row"><span /><i /></div>
        </div>
      </div>
    </section>
  </main>
</template>

<style>
.ls-auth-page { background: var(--bs-bg); }
.ls-auth-panel { background: radial-gradient(circle at 50% 18%, color-mix(in oklab, var(--bs-accent) 9%, transparent), transparent 25rem), var(--bs-bg); }
.ls-auth-eyebrow, .ls-auth-showcase-eyebrow { color: var(--bs-accent); font-size: 11px; font-weight: var(--bs-weight-bold); letter-spacing: .12em; }
.ls-auth-card { border: 1px solid color-mix(in oklab, var(--bs-border) 88%, transparent); border-radius: 20px; background: color-mix(in oklab, var(--bs-surface) 94%, transparent); box-shadow: 0 24px 64px rgb(0 0 0 / .18), 0 1px 0 rgb(255 255 255 / .04) inset; }
.ls-auth-showcase { isolation: isolate; color: var(--bs-pearl-white); background: linear-gradient(135deg, rgb(22 41 59 / .88), rgb(13 27 40 / .98)), var(--bs-gradient-navy); }
/* .ls-auth-brand { top: 48px; left: 50%; transform: translateX(-50%); } */
.ls-auth-showcase::before { position: absolute; z-index: -1; inset: 0; content: ''; opacity: .75; background-image: linear-gradient(to right, rgb(235 180 90 / .08) 1px, transparent 1px), linear-gradient(to bottom, rgb(235 180 90 / .08) 1px, transparent 1px); background-size: 64px 64px; mask-image: linear-gradient(to bottom, black, transparent 82%); }
.ls-auth-orbit { position: absolute; z-index: -1; border: 1px solid rgb(235 180 90 / .15); border-radius: 999px; pointer-events: none; }
.ls-auth-orbit-one { width: 42rem; height: 42rem; top: 50%; left: 50%; transform: translate(-50%, -50%); }
.ls-auth-orbit-two { width: 28rem; height: 28rem; top: 50%; left: 50%; border-color: rgb(235 180 90 / .09); transform: translate(-50%, -50%); }
.ls-auth-ledger { width: min(100%, 27rem); padding: 20px; border: 1px solid rgb(220 230 241 / .13); border-radius: 18px; background: rgb(10 17 26 / .28); box-shadow: 0 20px 42px rgb(0 0 0 / .14); backdrop-filter: blur(10px); }
.ls-auth-ledger-top, .ls-auth-ledger-row { display: flex; align-items: center; gap: 8px; }
.ls-auth-ledger-top { padding-bottom: 16px; border-bottom: 1px solid rgb(220 230 241 / .1); }
.ls-auth-ledger-top span { width: 7px; height: 7px; border-radius: 999px; background: rgb(235 180 90 / .7); }
.ls-auth-ledger-row { justify-content: space-between; padding-top: 14px; }
.ls-auth-ledger-row span, .ls-auth-ledger-row i { display: block; height: 7px; border-radius: 999px; background: rgb(220 230 241 / .22); }
.ls-auth-ledger-row span { width: 46%; }.ls-auth-ledger-row i { width: 23%; background: rgb(235 180 90 / .72); }
@media (max-width: 1023px) { .ls-auth-card { box-shadow: var(--bs-elevation-2); } }
</style>
