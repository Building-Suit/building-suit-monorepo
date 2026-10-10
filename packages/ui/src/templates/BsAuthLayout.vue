<script setup lang="ts">
defineProps<{ wide?: boolean; productName: string; homeLabel: string; title: string; description: string }>()
defineSlots<{ default(): unknown; logo(props: { tone: 'auto' | 'light' | 'dark' }): unknown; legal(): unknown }>()
useTheme()
</script>
<template>
  <main class="bs-auth-layout ls-auth-page" :data-wide="wide || undefined">
    <section class="bs-auth-layout__panel ls-auth-panel">
      <div class="bs-auth-layout__form-shell ls-auth-form-shell" :class="wide ? 'bs-auth-layout__form-shell--wide' : ''">
        <NuxtLink to="/" class="bs-auth-layout__mobile-logo" :aria-label="homeLabel">
          <slot name="logo" :tone="'auto'" />
        </NuxtLink>
        <slot />
        <slot name="legal" />
        <div class="bs-auth-layout__settings"><BsSettingsMenu /></div>
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
.bs-auth-layout { min-height: 100dvh; background: var(--bs-bg); }
.bs-auth-layout__panel { display: flex; align-items: center; justify-content: center; padding: var(--bs-space-9) var(--bs-space-5); background: radial-gradient(circle at 50% 18%, color-mix(in oklab, var(--bs-accent) 9%, transparent), transparent 25rem), var(--bs-bg); }
.bs-auth-layout__form-shell { display: flex; width: 100%; max-width: 27rem; flex-direction: column; align-items: center; }
.bs-auth-layout__form-shell--wide { max-width: 36rem; }
.bs-auth-layout__mobile-logo { display: inline-flex; margin-bottom: var(--bs-space-9); }
.bs-auth-layout__settings { display: flex; justify-content: center; margin-top: var(--bs-space-5); }
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
@media (min-width: 640px) { .bs-auth-layout__panel { padding-inline: var(--bs-space-8); } }
@media (min-width: 1024px) {
  .bs-auth-layout { display: grid; grid-template-columns: minmax(0, .92fr) minmax(0, 1.08fr); }
  .bs-auth-layout__panel { padding-inline: var(--bs-space-9); }
  .bs-auth-layout__mobile-logo { display: none; }
}
</style>
