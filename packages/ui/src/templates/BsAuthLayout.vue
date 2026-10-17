<script setup lang="ts">
withDefaults(defineProps<{
  wide?: boolean
  presentation?: 'default' | 'flat' | 'glass'
  productName: string
  homeLabel: string
  title: string
  description: string
}>(), { presentation: 'glass' })
defineSlots<{
  default(): unknown
  logo(props: { tone: 'auto' | 'light' | 'dark' }): unknown
  legal(): unknown
}>()
useTheme()
</script>

<template>
  <main class="bs-auth-layout ls-auth-page" :data-presentation="presentation" :data-wide="wide || undefined">
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
    <!-- This original showcase is retained for non-glass auth and signup screens. -->
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
/* Original, backwards-compatible split-screen/default/flat presentation. */
.bs-auth-layout { min-height: 100dvh; background: var(--bs-bg); }
.bs-auth-layout__panel { display: flex; align-items: center; justify-content: center; padding: var(--bs-space-9) var(--bs-space-5); background: radial-gradient(circle at 50% 18%, color-mix(in oklab, var(--bs-accent) 9%, transparent), transparent 25rem), var(--bs-bg); }
.bs-auth-layout__form-shell { display: flex; min-inline-size: 0; width: 100%; max-width: 27rem; flex-direction: column; align-items: center; }
.bs-auth-layout__form-shell--wide { max-width: 36rem; }
.bs-auth-layout__mobile-logo { display: inline-flex; max-inline-size: 100%; margin-bottom: var(--bs-space-9); }
.bs-auth-layout .ls-auth-brand { max-inline-size: 100%; }
.bs-auth-layout__mobile-logo .ls-logo,
.bs-auth-layout .ls-auth-brand .ls-logo { min-inline-size: 0; max-inline-size: 100%; }
.bs-auth-layout__settings { display: flex; justify-content: center; margin-top: var(--bs-space-5); }
.ls-auth-showcase { isolation: isolate; color: var(--bs-pearl-white); background: linear-gradient(135deg, rgb(22 41 59 / .88), rgb(13 27 40 / .98)), var(--bs-gradient-navy); }
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
.bs-auth-layout[data-presentation='flat'] .bs-auth-layout__panel { background: var(--bs-bg); }
.bs-auth-layout[data-presentation='flat'] .bs-auth-form { background: var(--bs-surface); border-color: var(--bs-border); border-radius: var(--bs-radius-card); box-shadow: none; }
.bs-auth-layout[data-presentation='flat'] .bs-auth-form__title { font-size: var(--bs-type-h2-size); line-height: var(--bs-type-h2-lh); font-weight: var(--bs-weight-bold); letter-spacing: normal; }
.bs-auth-layout[data-presentation='flat'] .ls-auth-showcase-content h2 { font-size: var(--bs-type-display-size); line-height: var(--bs-type-display-lh); font-weight: var(--bs-weight-extrabold); letter-spacing: normal; }

/* ============================================================
 * Auth glass: screenshot-matched, one centered card at every width.
 * Uses the canonical tokens; no Suit-local palette or component fork.
 * The title/description, genuine product logo and sign-in actions
 * continue to come from the owning Suit.
 * ============================================================ */
.bs-auth-layout[data-presentation='glass'] {
  position: relative;
  isolation: isolate;
  display: flex;
  grid-template-columns: none;
  width: 100%;
  min-height: 100dvh;
  overflow: hidden;
  align-items: center;
  justify-content: center;
  background:
    radial-gradient(ellipse 52rem 36rem at 51% 0%, color-mix(in srgb, var(--bs-surface-muted) 70%, transparent), transparent 82%),
    radial-gradient(ellipse 36rem 29rem at 50% 45%, color-mix(in srgb, var(--bs-text) 2.5%, transparent), transparent 90%),
    linear-gradient(170deg, color-mix(in srgb, var(--bs-bg) 85%, var(--bs-surface)), var(--bs-bg));
}
.bs-auth-layout[data-presentation='glass']::before {
  position: absolute;
  z-index: 0;
  inset: 0;
  content: '';
  pointer-events: none;
  background-image: radial-gradient(circle, color-mix(in srgb, var(--bs-text-muted) 20%, transparent) .75px, transparent .95px);
  background-size: 13px 13px;
  background-position: 1px 2px;
  mask-image: linear-gradient(to bottom, black 0%, rgb(0 0 0 / .48) 80%, transparent 100%);
}
.bs-auth-layout[data-presentation='glass']::after {
  position: absolute;
  z-index: 0;
  inset: 0;
  content: '';
  pointer-events: none;
  background: radial-gradient(ellipse 34rem 27rem at 52% 16%, color-mix(in srgb, var(--bs-accent) 4%, transparent), transparent 83%);
}
.bs-auth-layout[data-presentation='glass'] .bs-auth-layout__panel {
  position: relative;
  z-index: 1;
  display: flex;
  width: 100%;
  min-height: 100dvh;
  align-items: center;
  justify-content: center;
  padding: 48px 20px;
  background: transparent;
}
.bs-auth-layout[data-presentation='glass'] .ls-auth-showcase { display: none !important; }
.bs-auth-layout[data-presentation='glass'] .bs-auth-layout__form-shell {
  position: relative;
  display: flex;
  width: min(568px, 100%);
  max-width: 568px;
  flex-direction: column;
  align-items: stretch;
  transform: none;
}
.bs-auth-layout[data-presentation='glass'] .bs-auth-layout__mobile-logo {
  position: absolute;
  z-index: 4;
  top: 35px;
  inset-inline-start: 50%;
  display: inline-flex;
  width: 74px;
  height: 74px;
  align-items: center;
  justify-content: center;
  margin: 0;
  text-decoration: none;
  transform: translateX(-50%);
}
.bs-auth-layout[data-presentation='glass'] .bs-auth-layout__mobile-logo .bs-product-logo--auth {
  width: 74px;
  height: 74px;
  max-width: none;
  margin: 0;
  border-radius: 20px;
  filter: drop-shadow(0 0 15px color-mix(in srgb, var(--bs-highlight-gold) 13%, transparent));
}
.bs-auth-layout[data-presentation='glass'] .bs-auth-layout__mobile-logo .ls-logo-image { width: 100%; height: 100%; }
.bs-auth-layout[data-presentation='glass'] .bs-auth-form {
  position: relative;
  isolation: isolate;
  width: 100%;
  min-height: 682px;
  padding: 122px 38px 49px;
  overflow: hidden;
  border: 1px solid color-mix(in srgb, var(--bs-border-strong) 88%, var(--bs-premium-gold) 12%);
  border-radius: 54px;
  background:
    radial-gradient(ellipse 18rem 14rem at 68% 0%, color-mix(in srgb, var(--bs-highlight-gold) 8%, transparent), transparent 85%),
    radial-gradient(ellipse 31rem 22rem at 48% 0%, color-mix(in srgb, var(--bs-text) 4%, transparent), transparent 90%),
    linear-gradient(168deg, color-mix(in srgb, var(--bs-surface-raised) 91%, transparent), color-mix(in srgb, var(--bs-surface) 95%, transparent));
  box-shadow: 0 29px 68px rgb(0 0 0 / .24), inset 0 1px 0 rgb(255 255 255 / .07);
  backdrop-filter: blur(22px) saturate(113%);
  -webkit-backdrop-filter: blur(22px) saturate(113%);
}
.bs-auth-layout[data-presentation='glass'] .bs-auth-form::before {
  position: absolute;
  z-index: 0;
  top: -1px;
  inset-inline: 0;
  height: 2px;
  content: '';
  pointer-events: none;
  background: linear-gradient(90deg, transparent 5%, color-mix(in srgb, var(--bs-premium-gold) 19%, transparent) 36%, var(--bs-highlight-gold) 67%, transparent 100%);
  box-shadow: 0 0 18px 3px color-mix(in srgb, var(--bs-premium-gold) 24%, transparent);
}
.bs-auth-layout[data-presentation='glass'] .bs-auth-form::after {
  position: absolute;
  z-index: 0;
  top: 0;
  inset-inline: 0;
  height: 53%;
  content: '';
  pointer-events: none;
  opacity: .35;
  background-image: radial-gradient(circle, color-mix(in srgb, var(--bs-pearl-white) 19%, transparent) .55px, transparent .95px);
  background-size: 9px 9px;
  mask-image: linear-gradient(to bottom, black, transparent);
}
.bs-auth-layout[data-presentation='glass'] .bs-auth-form > form { position: relative; z-index: 1; }
.bs-auth-layout[data-presentation='glass'] .bs-auth-form .bs-form-fields[data-layout='stack'] { display: block; }
.bs-auth-layout[data-presentation='glass'] .bs-auth-form__eyebrow { display: none; }
.bs-auth-layout[data-presentation='glass'] .bs-auth-form__header {
  margin: 0 0 37px;
  text-align: center;
}
.bs-auth-layout[data-presentation='glass'] .bs-auth-form__title {
  margin: 0;
  color: var(--bs-text);
  font-size: clamp(29px, 3.8vw, 40px);
  line-height: 48px;
  font-weight: var(--bs-weight-medium);
  letter-spacing: -.047em;
}
.bs-auth-layout[data-presentation='glass'] .bs-auth-form__description {
  margin-top: 7px;
  color: var(--bs-text-muted);
  font-size: 17px;
  line-height: 24px;
  font-weight: var(--bs-weight-regular);
}
.bs-auth-layout[data-presentation='glass'] .bs-auth-form__body { display: flex; flex-direction: column; gap: 0; }
.bs-auth-layout[data-presentation='glass'] .bs-sign-in__identity {
  position: relative;
  width: 100%;
  min-width: 0;
  height: 72px;
}
.bs-auth-layout[data-presentation='glass'] .bs-sign-in__identity > .ls-field { position: relative; height: 72px; display: block; }
.bs-auth-layout[data-presentation='glass'] .bs-sign-in__identity .ls-field__label {
  position: absolute;
  z-index: 1;
  top: 11px;
  inset-inline-start: 23px;
  margin: 0;
  color: var(--bs-text-muted);
  font-size: 14px;
  line-height: 20px;
  font-weight: var(--bs-weight-regular);
  pointer-events: none;
}
.bs-auth-layout[data-presentation='glass'] .bs-sign-in__identity .ls-field__label > span { display: none; }
.bs-auth-layout[data-presentation='glass'] .bs-sign-in__identity .ls-input {
  width: 100%;
  height: 72px;
  min-height: 72px;
  padding: 27px 83px 7px 23px;
  border: 1px solid color-mix(in srgb, var(--bs-border-strong) 52%, transparent);
  border-radius: 19px;
  background: color-mix(in srgb, var(--bs-surface-raised) 88%, var(--bs-surface));
  color: var(--bs-text);
  font-size: 17px;
  line-height: 24px;
  box-shadow: none;
  outline: none;
}
.bs-auth-layout[data-presentation='glass'] .bs-sign-in__identity .ls-input:focus-visible {
  border-color: var(--bs-focus-ring);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--bs-focus-ring) 21%, transparent);
}
.bs-auth-layout[data-presentation='glass'] .bs-sign-in__identity .ls-input {
  transition: background .25s ease, border-color .25s ease, color .25s ease, opacity .25s ease, box-shadow .25s ease;
}
.bs-auth-layout[data-presentation='glass'] .bs-sign-in__identity--locked .ls-input {
  cursor: not-allowed;
  background: color-mix(in srgb, var(--bs-surface) 74%, var(--bs-surface-muted));
  color: var(--bs-text-muted);
  border-color: color-mix(in srgb, var(--bs-border) 70%, transparent);
  opacity: .83;
}
.bs-auth-layout[data-presentation='glass'] .bs-sign-in__identity--locked .ls-field__label { opacity: .65; }
.bs-auth-layout[data-presentation='glass'] .bs-sign-in__identity .ls-input[readonly] { user-select: text; }

/* The email lookup owns its inline error. Keep the field height stable while
   reserving space for an accessible, localized validation message. */
.bs-auth-layout[data-presentation='glass'] .bs-sign-in__identity--invalid {
  margin-bottom: 35px;
}
.bs-auth-layout[data-presentation='glass'] .bs-sign-in__identity--invalid .ls-input,
.bs-auth-layout[data-presentation='glass'] .bs-sign-in__identity--invalid .ls-input:focus-visible {
  border-color: var(--bs-status-error);
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--bs-status-error) 16%, transparent);
}
.bs-auth-layout[data-presentation='glass'] .bs-sign-in__identity .ls-field__error {
  position: absolute;
  z-index: 3;
  top: calc(100% + 8px);
  inset-inline-start: 8px;
  inset-inline-end: 8px;
  margin: 0;
  color: var(--bs-status-error);
  font-size: 13px;
  line-height: 19px;
  font-weight: 500;
}

.bs-auth-layout[data-presentation='glass'] .bs-sign-in__arrow.ls-btn {
  position: absolute;
  z-index: 2;
  top: 12px;
  inset-inline-end: 12px;
  display: inline-flex;
  width: 46px;
  min-width: 46px;
  height: 46px;
  min-height: 46px;
  align-items: center;
  justify-content: center;
  padding: 0;
  border: 0;
  border-radius: 14px;
  background: linear-gradient(140deg, var(--bs-gold-300), var(--bs-premium-gold) 85%);
  color: var(--bs-deep-structure-navy);
  box-shadow: 0 7px 21px color-mix(in srgb, var(--bs-premium-gold) 21%, transparent);
}
.bs-auth-layout[data-presentation='glass'] .bs-sign-in__arrow.ls-btn:hover:not(:disabled) {
  background: linear-gradient(140deg, var(--bs-highlight-gold), var(--bs-premium-gold));
}
.bs-auth-layout[data-presentation='glass'] .bs-sign-in__spinner {
  display: inline-block;
  width: 21px;
  height: 21px;
  border: 2px solid currentColor;
  border-inline-end-color: transparent;
  border-radius: 50%;
  animation: bs-sign-in-spin .7s linear infinite;
}
@keyframes bs-sign-in-spin { to { transform: rotate(360deg); } }
.bs-auth-layout[data-presentation='glass'] .bs-sign-in__edit-email.ls-action-link {
  position: absolute;
  z-index: 2;
  top: 25px;
  inset-inline-end: 17px;
  display: inline-flex;
  max-width: 98px;
  min-height: 22px;
  padding: 0;
  color: var(--bs-link);
  font-size: 12px;
  line-height: 18px;
  font-weight: 600;
  white-space: normal;
  text-align: center;
}
.bs-auth-layout[data-presentation='glass'] .bs-sign-in__edit-email:hover { text-decoration: underline; }
.bs-sign-in-arrow-enter-active, .bs-sign-in-arrow-leave-active {
  transition: opacity .23s ease, transform .23s ease;
}
.bs-sign-in-arrow-enter-from, .bs-sign-in-arrow-leave-to {
  opacity: 0;
  transform: translateY(-8px) scale(.85);
}
.bs-sign-in-password-enter-active, .bs-sign-in-password-leave-active {
  overflow: hidden;
  transition: opacity .34s ease, transform .34s ease, max-height .38s ease, margin-top .38s ease;
}
.bs-sign-in-password-enter-from, .bs-sign-in-password-leave-to {
  opacity: 0;
  transform: translateY(-18px);
  max-height: 0;
  margin-top: 0 !important;
}
.bs-sign-in-password-enter-to, .bs-sign-in-password-leave-from {
  opacity: 1;
  transform: translateY(0);
  max-height: 88px;
  margin-top: 16px;
}
.bs-auth-layout[data-presentation='glass'] .bs-sign-in__password-row { margin-top: 16px; }
.bs-auth-layout[data-presentation='glass'] .bs-sign-in__options {
  display: flex;
  min-height: 24px;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-top: 19px;
}
.bs-auth-layout[data-presentation='glass'] .bs-sign-in__options .bs-check-control {
  display: inline-flex;
  min-height: 24px;
  align-items: center;
  gap: 10px;
  padding: 0 4px;
  border-radius: 5px;
  background: transparent;
}
.bs-auth-layout[data-presentation='glass'] .bs-sign-in__options .bs-check-control__input {
  width: 17px;
  height: 17px;
  margin: 0;
  accent-color: var(--bs-primary);
}
.bs-auth-layout[data-presentation='glass'] .bs-sign-in__options .bs-check-control__label,
.bs-auth-layout[data-presentation='glass'] .bs-sign-in__options .bs-link {
  color: var(--bs-text-muted);
  font-size: 14px;
  line-height: 20px;
  font-weight: var(--bs-weight-regular);
}
.bs-auth-layout[data-presentation='glass'] .bs-sign-in__divider {
  display: flex;
  min-height: 19px;
  align-items: center;
  gap: 18px;
  margin-top: 22px;
  color: var(--bs-text-muted);
  font-size: 16px;
  text-align: center;
}
.bs-auth-layout[data-presentation='glass'] .bs-sign-in__divider::before,
.bs-auth-layout[data-presentation='glass'] .bs-sign-in__divider::after {
  display: block;
  height: 1px;
  flex: 1;
  content: '';
  background: linear-gradient(90deg, transparent, color-mix(in srgb, var(--bs-border-strong) 62%, transparent));
}
.bs-auth-layout[data-presentation='glass'] .bs-sign-in__divider::after { transform: rotate(180deg); }
.bs-auth-layout[data-presentation='glass'] .bs-sign-in__providers {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 19px;
  margin-top: 18px;
}
.bs-auth-layout[data-presentation='glass'] .bs-sign-in__provider.ls-btn {
  display: flex;
  width: 100%;
  min-height: 70px;
  align-items: center;
  justify-content: flex-start;
  gap: 12px;
  padding: 8px 11px;
  border: 1px solid color-mix(in srgb, var(--bs-border-strong) 56%, transparent);
  border-radius: 20px;
  background: color-mix(in srgb, var(--bs-surface-raised) 76%, var(--bs-surface));
  color: var(--bs-text-muted);
  font-size: 16px;
  line-height: 22px;
  font-weight: var(--bs-weight-regular);
  box-shadow: inset 0 1px 0 color-mix(in srgb, var(--bs-text) 2%, transparent);
}
.bs-auth-layout[data-presentation='glass'] .bs-sign-in__provider.ls-btn:hover:not(:disabled) {
  background: var(--bs-surface-raised);
  border-color: var(--bs-accent);
  color: var(--bs-text);
}
.bs-auth-layout[data-presentation='glass'] .bs-sign-in__provider-icon,
.bs-auth-layout[data-presentation='glass'] .bs-sign-in__provider-arrow {
  display: flex;
  width: 46px;
  height: 46px;
  flex: 0 0 46px;
  align-items: center;
  justify-content: center;
  border-radius: 14px;
  background: color-mix(in srgb, var(--bs-bg) 70%, var(--bs-surface));
}
.bs-auth-layout[data-presentation='glass'] .bs-sign-in__provider-icon { color: var(--bs-text); }
.bs-auth-layout[data-presentation='glass'] .bs-sign-in__provider-arrow { margin-inline-start: auto; color: var(--bs-text-muted); }
.bs-auth-layout[data-presentation='glass'] .bs-sign-in__provider-label { text-align: start; white-space: normal; }
.bs-auth-layout[data-presentation='glass'] .bs-auth-form__footer {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 37px;
  color: var(--bs-text-muted);
  font-size: 14px;
  line-height: 22px;
}
.bs-auth-layout[data-presentation='glass'] .bs-auth-form__footer .bs-link {
  color: var(--bs-link);
  font-weight: var(--bs-weight-semibold);
  text-decoration: underline;
  text-underline-offset: 4px;
}
.bs-auth-layout[data-presentation='glass'] .bs-auth-layout__settings {
  position: relative;
  z-index: 6;
  inset: auto;
  display: flex;
  align-self: center;
  justify-content: center;
  width: max-content;
  max-width: 100%;
  margin: 22px auto 0;
  opacity: .85;
}
.bs-auth-layout[data-presentation='glass'] .bs-auth-layout__settings .ls-btn {
  background: var(--bs-surface);
  border-color: var(--bs-border);
  box-shadow: 0 5px 18px rgb(0 0 0 / .12);
}
.bs-auth-layout[data-presentation='glass'] .bs-auth-layout__settings:hover,
.bs-auth-layout[data-presentation='glass'] .bs-auth-layout__settings:focus-within { opacity: 1; }
.bs-auth-layout[data-presentation='glass'] .bs-auth-layout__form-shell > nav { margin-top: 10px; }
.bs-auth-layout[data-presentation='glass'] .bs-auth-layout__form-shell > .ls-state-surface { min-height: 20rem; margin-top: 85px; }
:lang(ar) .bs-auth-layout[data-presentation='glass'] .bs-auth-form__title,
[dir='rtl'] .bs-auth-layout[data-presentation='glass'] .bs-auth-form__title { letter-spacing: normal; line-height: 1.35; }
[dir='rtl'] .bs-auth-layout[data-presentation='glass'] .bs-sign-in__identity .ls-input { padding-inline: 83px 23px; }
[dir='rtl'] .bs-auth-layout[data-presentation='glass'] .bs-auth-layout__mobile-logo { transform: translateX(50%); }
@media (max-width: 639px) {
  .bs-auth-layout[data-presentation='glass'] .bs-auth-layout__panel { padding: 25px 14px 55px; }
  .bs-auth-layout[data-presentation='glass'] .bs-auth-layout__form-shell { transform: none; }
  .bs-auth-layout[data-presentation='glass'] .bs-auth-form { min-height: 0; padding: 112px 23px 38px; border-radius: 33px; }
  .bs-auth-layout[data-presentation='glass'] .bs-auth-layout__mobile-logo { top: 30px; }
  .bs-auth-layout[data-presentation='glass'] .bs-auth-form__header { margin-bottom: 28px; }
  .bs-auth-layout[data-presentation='glass'] .bs-auth-form__title { font-size: 32px; line-height: 42px; }
  .bs-auth-layout[data-presentation='glass'] .bs-auth-form__description { font-size: 14px; }
  .bs-auth-layout[data-presentation='glass'] .bs-sign-in__provider.ls-btn { min-height: 62px; }
  .bs-auth-layout[data-presentation='glass'] .bs-sign-in__provider-icon,
  .bs-auth-layout[data-presentation='glass'] .bs-sign-in__provider-arrow { width: 42px; height: 42px; flex-basis: 42px; }
  .bs-auth-layout[data-presentation='glass'] .bs-auth-form__footer { margin-top: 26px; }
}
@media (prefers-reduced-motion: reduce) {
  .bs-auth-layout[data-presentation='glass'] .bs-sign-in__arrow,
  .bs-auth-layout[data-presentation='glass'] .bs-sign-in__provider,
  .bs-sign-in-arrow-enter-active, .bs-sign-in-arrow-leave-active,
  .bs-sign-in-password-enter-active, .bs-sign-in-password-leave-active { transition: none; animation: none; }
}

/* Shared charcoal glass for signup, OTP verification and recovery.
   These selectors intentionally only affect explicit glass presentation. */
.bs-auth-layout[data-presentation='glass'] { overflow: visible; }
.bs-auth-layout[data-presentation='glass'] .bs-auth-layout__form-shell--wide {
  width: min(748px, 100%);
  max-width: 748px;
}
.bs-auth-layout[data-presentation='glass'] .bs-auth-layout__form-shell {
  animation: bs-auth-scene-in .38s cubic-bezier(.2, .75, .25, 1) both;
}
@keyframes bs-auth-scene-in {
  from { opacity: 0; transform: translateY(14px) scale(.988); }
  to { opacity: 1; transform: translateY(0) scale(1); }
}
/* Sign-up progress is visually separate from the rounded card. Because the
   progress is owned by BsSignupWizard, its semantics and step labels are
   preserved while it is positioned just above the card. */
.bs-auth-layout[data-presentation='glass']:has(.bs-signup-wizard__steps) .bs-auth-layout__panel {
  padding-block-start: 143px;
}
.bs-auth-layout[data-presentation='glass'] .bs-auth-form:has(.bs-signup-wizard) {
  min-height: 0;
  overflow: visible;
  padding-bottom: 43px;
}
.bs-auth-layout[data-presentation='glass'] .bs-signup-wizard {
  gap: 22px;
}
.bs-auth-layout[data-presentation='glass'] .bs-signup-wizard__steps {
  position: absolute;
  z-index: 8;
  /* BsAuthForm positions its <form> 122px inside the card: offset both. */
  top: -213px;
  inset-inline: 0;
  display: flex;
  min-height: 69px;
  align-items: center;
  justify-content: center;
  gap: 12px;
  margin: 0;
  padding: 10px 14px;
  border: 1px solid color-mix(in srgb, var(--bs-border-strong) 74%, var(--bs-premium-gold) 26%);
  border-radius: 23px;
  background: linear-gradient(155deg,
    color-mix(in srgb, var(--bs-surface-raised) 92%, var(--bs-surface)),
    color-mix(in srgb, var(--bs-surface) 93%, transparent));
  box-shadow: 0 18px 34px rgb(0 0 0 / .18), inset 0 1px 0 rgb(255 255 255 / .055);
  backdrop-filter: blur(16px);
}
.bs-auth-layout[data-presentation='glass'] .bs-signup-wizard__step {
  flex: 0 1 auto;
  min-width: 0;
  align-items: center;
  gap: 9px;
  padding: 4px 8px;
  border-radius: 15px;
  transition: opacity .25s ease, background .25s ease;
}
.bs-auth-layout[data-presentation='glass'] .bs-signup-wizard__step[data-state='current'] {
  background: color-mix(in srgb, var(--bs-premium-gold) 11%, transparent);
}
.bs-auth-layout[data-presentation='glass'] .bs-signup-wizard__step[data-state='upcoming'] {
  opacity: .64;
}
.bs-auth-layout[data-presentation='glass'] .bs-signup-wizard__number {
  width: 39px;
  height: 39px;
  flex: 0 0 39px;
  border-color: color-mix(in srgb, var(--bs-border-strong) 76%, transparent);
  border-radius: 12px;
  background: var(--bs-surface);
  color: var(--bs-text-muted);
  font-size: 13px;
  transition: background .25s ease, color .25s ease, border-color .25s ease, box-shadow .25s ease;
}
.bs-auth-layout[data-presentation='glass'] .bs-signup-wizard__step[data-state='current'] .bs-signup-wizard__number {
  border-color: var(--bs-premium-gold);
  background: linear-gradient(145deg, var(--bs-highlight-gold), var(--bs-premium-gold));
  color: var(--bs-deep-structure-navy);
  box-shadow: 0 4px 13px color-mix(in srgb, var(--bs-premium-gold) 19%, transparent);
}
.bs-auth-layout[data-presentation='glass'] .bs-signup-wizard__step[data-state='complete'] .bs-signup-wizard__number {
  border-color: var(--bs-premium-gold);
  color: var(--bs-premium-gold);
}
.bs-auth-layout[data-presentation='glass'] .bs-signup-wizard__step-copy p {
  color: var(--bs-text);
  font-size: 13px;
  font-weight: 600;
}
.bs-auth-layout[data-presentation='glass'] .bs-signup-wizard__step-copy small {
  max-width: 160px;
  color: var(--bs-text-muted);
  font-size: 11px;
  line-height: 16px;
}
.bs-auth-layout[data-presentation='glass'] .bs-signup-wizard__header {
  padding-bottom: 16px;
  border-bottom: 1px solid color-mix(in srgb, var(--bs-border) 70%, transparent);
}
.bs-auth-layout[data-presentation='glass'] .bs-signup-wizard__header h2 {
  color: var(--bs-text);
  font-size: 20px;
  font-weight: 600;
}
.bs-auth-layout[data-presentation='glass'] .bs-signup-wizard__count {
  color: var(--bs-premium-gold);
  font-size: 12px;
  font-weight: 600;
}
.bs-auth-layout[data-presentation='glass'] .bs-signup-wizard__content {
  min-height: 90px;
}
.bs-auth-layout[data-presentation='glass'] .bs-signup-wizard__actions {
  gap: 12px;
  padding-top: 4px;
}
.bs-auth-layout[data-presentation='glass'] .bs-signup-wizard__submit.ls-btn-primary,
.bs-auth-layout[data-presentation='glass'] .bs-auth-form__actions .ls-btn-primary,
.bs-auth-layout[data-presentation='glass'] .bs-verification-form__body .ls-btn-primary {
  border: 0;
  border-radius: 13px;
  background: linear-gradient(145deg, var(--bs-highlight-gold), var(--bs-premium-gold));
  color: var(--bs-deep-structure-navy);
  font-weight: 700;
}
.bs-auth-layout[data-presentation='glass'] .bs-signup-wizard__submit.ls-btn-primary:hover:not(:disabled),
.bs-auth-layout[data-presentation='glass'] .bs-auth-form__actions .ls-btn-primary:hover:not(:disabled),
.bs-auth-layout[data-presentation='glass'] .bs-verification-form__body .ls-btn-primary:hover:not(:disabled) {
  filter: brightness(1.07);
  box-shadow: 0 8px 20px color-mix(in srgb, var(--bs-premium-gold) 22%, transparent);
}
.bs-auth-layout[data-presentation='glass'] .bs-auth-form:has(.bs-signup-wizard) .bs-auth-form__header {
  margin-bottom: 30px;
}
/* Nested signup fields use normal labels, and compact charcoal inputs. */
.bs-auth-layout[data-presentation='glass'] .bs-signup-wizard .ls-field {
  gap: 7px;
}
.bs-auth-layout[data-presentation='glass'] .bs-signup-wizard .ls-field__label,
.bs-auth-layout[data-presentation='glass'] .bs-password-recovery__content .ls-field__label {
  font-size: 13px;
  color: var(--bs-text-muted);
  font-weight: 600;
}
.bs-auth-layout[data-presentation='glass'] .bs-signup-wizard .ls-input,
.bs-auth-layout[data-presentation='glass'] .bs-signup-wizard .ls-select,
.bs-auth-layout[data-presentation='glass'] .bs-password-recovery__content .ls-input {
  min-height: 52px;
  border-radius: 14px;
  border-color: color-mix(in srgb, var(--bs-border-strong) 60%, transparent);
  background: color-mix(in srgb, var(--bs-surface-raised) 72%, var(--bs-surface));
}
.bs-auth-layout[data-presentation='glass'] .bs-signup-wizard .ls-input:focus-visible,
.bs-auth-layout[data-presentation='glass'] .bs-password-recovery__content .ls-input:focus-visible {
  border-color: var(--bs-focus-ring);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--bs-focus-ring) 17%, transparent);
}
.bs-auth-layout[data-presentation='glass'] .bs-signup-wizard .bs-grid,
.bs-auth-layout[data-presentation='glass'] .bs-signup-wizard .bs-field-group { min-width: 0; }
.bs-auth-wizard-stage-enter-active,
.bs-auth-wizard-stage-leave-active,
.bs-auth-inner-enter-active,
.bs-auth-inner-leave-active {
  transition: opacity .24s ease, transform .28s cubic-bezier(.2,.75,.25,1);
}
.bs-auth-wizard-stage-enter-from,
.bs-auth-inner-enter-from { opacity: 0; transform: translateY(16px); }
.bs-auth-wizard-stage-leave-to,
.bs-auth-inner-leave-to { opacity: 0; transform: translateY(-10px); }
/* Email verification has its own organism, so give it the same genuine glass
   outer card instead of layering a second rectangle inside BsAuthLayout. */
.bs-auth-layout[data-presentation='glass'] .bs-verification-form {
  position: relative;
  isolation: isolate;
  width: 100%;
  min-height: 620px;
  padding: 122px 38px 43px;
  border: 1px solid color-mix(in srgb, var(--bs-border-strong) 88%, var(--bs-premium-gold) 12%);
  border-radius: 54px;
  background:
    radial-gradient(ellipse 18rem 14rem at 68% 0%, color-mix(in srgb, var(--bs-highlight-gold) 8%, transparent), transparent 85%),
    linear-gradient(168deg, color-mix(in srgb, var(--bs-surface-raised) 91%, transparent), color-mix(in srgb, var(--bs-surface) 95%, transparent));
  box-shadow: 0 29px 68px rgb(0 0 0 / .24), inset 0 1px 0 rgb(255 255 255 / .07);
  backdrop-filter: blur(22px);
}
.bs-auth-layout[data-presentation='glass'] .bs-verification-form::before {
  position: absolute;
  inset-inline: 0;
  top: -1px;
  content: '';
  height: 2px;
  pointer-events: none;
  background: linear-gradient(90deg, transparent, color-mix(in srgb, var(--bs-premium-gold) 30%, transparent), transparent);
  box-shadow: 0 0 14px color-mix(in srgb, var(--bs-premium-gold) 18%, transparent);
}
.bs-auth-layout[data-presentation='glass'] .bs-verification-form__icon {
  width: 53px;
  height: 53px;
  border: 1px solid var(--bs-border-strong);
  border-radius: 16px;
  background: var(--bs-surface-muted);
  color: var(--bs-premium-gold);
}
.bs-auth-layout[data-presentation='glass'] .bs-verification-form__title {
  margin-top: 7px;
  font-size: clamp(27px, 3.4vw, 36px);
  font-weight: 500;
  line-height: 1.18;
}
.bs-auth-layout[data-presentation='glass'] .bs-verification-form__description {
  color: var(--bs-text-muted);
  font-size: 15px;
}
.bs-auth-layout[data-presentation='glass'] .bs-verification-form__body {
  margin-top: 30px;
  gap: 19px;
}
.bs-auth-layout[data-presentation='glass'] .bs-verification-form__email { color: var(--bs-premium-gold); }
.bs-auth-layout[data-presentation='glass'] .bs-verification-form .ls-input { background: var(--bs-surface-raised); }
.bs-auth-layout[data-presentation='glass'] .bs-verification-form__security { border-radius: 15px; }
/* Recovery/reset includes loading, complete and invalid states with the same
   card, while its native submit actions and error semantics remain intact. */
.bs-auth-layout[data-presentation='glass'] .bs-password-recovery__content {
  display: grid;
  gap: 18px;
  min-width: 0;
}
.bs-auth-layout[data-presentation='glass'] .bs-password-recovery__content > .ls-state-surface { margin-block: 8px 14px; }
.bs-auth-layout[data-presentation='glass'] .bs-auth-form:has(.bs-password-recovery__content) {
  min-height: 570px;
}
/* Invitation/owner credential forms also inherit the same charcoal controls.
   Exclude the screenshot-matched email-first identity field. */
.bs-auth-layout[data-presentation='glass'] .bs-auth-form:not(:has(.bs-sign-in__identity)) .ls-field .ls-input {
  min-height: 52px;
  border-radius: 14px;
  border-color: color-mix(in srgb, var(--bs-border-strong) 60%, transparent);
  background: color-mix(in srgb, var(--bs-surface-raised) 72%, var(--bs-surface));
}
.bs-auth-layout[data-presentation='glass'] .bs-auth-form:not(:has(.bs-sign-in__identity)) .ls-field .ls-input:focus-visible {
  border-color: var(--bs-focus-ring);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--bs-focus-ring) 17%, transparent);
}
/* Route changes are NuxtPage transitions, not replacement of existing auth
   controls; the scene also enters when a route switches NuxtLayout. */
.bs-auth-route-enter-active,
.bs-auth-route-leave-active { transition: opacity .23s ease, transform .25s cubic-bezier(.2,.75,.25,1); }
.bs-auth-route-enter-from { opacity: 0; transform: translateY(15px) scale(.993); }
.bs-auth-route-leave-to { opacity: 0; transform: translateY(-10px) scale(.993); }
@media (max-width: 639px) {
  .bs-auth-layout[data-presentation='glass'] .bs-verification-form {
    min-height: 0;
    padding: 112px 22px 35px;
    border-radius: 33px;
  }
  .bs-auth-layout[data-presentation='glass'] .bs-signup-wizard__steps {
    /* Mobile card padding-top is 112px. */
    top: -191px;
    min-height: 62px;
    gap: 5px;
    padding: 8px 7px;
    border-radius: 18px;
  }
  .bs-auth-layout[data-presentation='glass'] .bs-signup-wizard__step { display: flex; gap: 5px; padding: 5px; }
  .bs-auth-layout[data-presentation='glass'] .bs-signup-wizard__number {
    width: 32px; height: 32px; flex-basis: 32px; border-radius: 10px;
  }
  .bs-auth-layout[data-presentation='glass'] .bs-signup-wizard__step-copy { margin: 0; }
  .bs-auth-layout[data-presentation='glass'] .bs-signup-wizard__step-copy p { font-size: 11px; }
  .bs-auth-layout[data-presentation='glass'] .bs-signup-wizard__step-copy small { display: none; }
  .bs-auth-layout[data-presentation='glass']:has(.bs-signup-wizard__steps) .bs-auth-layout__panel {
    padding-block-start: 123px;
  }
  .bs-auth-layout[data-presentation='glass'] .bs-signup-wizard__actions { align-items: stretch; }
}
@media (max-width: 380px) {
  .bs-auth-layout[data-presentation='glass'] .bs-signup-wizard__step-copy p { display: none; }
  .bs-auth-layout[data-presentation='glass'] .bs-signup-wizard__steps { justify-content: space-evenly; }
}
@media (prefers-reduced-motion: reduce) {
  .bs-auth-layout[data-presentation='glass'] .bs-auth-layout__form-shell,
  .bs-auth-wizard-stage-enter-active, .bs-auth-wizard-stage-leave-active,
  .bs-auth-inner-enter-active, .bs-auth-inner-leave-active,
  .bs-auth-route-enter-active, .bs-auth-route-leave-active { animation: none; transition: none; }
}

</style>
