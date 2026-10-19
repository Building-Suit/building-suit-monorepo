<script setup lang="ts">
interface LegalSection {
  title: string
  paragraphs?: string[]
  bullets?: string[]
}

interface LegalDocument {
  title: string
  intro: string
  updated: string
  sections: LegalSection[]
}

defineProps<{
  privacySettingsLabel?: string
  presentation?: 'default' | 'flat'
  document: LegalDocument
  eyebrow: string
  lastUpdatedLabel: string
}>()
defineEmits<{ privacySettings: [] }>()
</script>

<template>
  <main :class="{ 'bs-public-legal-page--flat': presentation === 'flat' }" class="mx-auto max-w-5xl px-4 py-10 lg:px-8 lg:py-14">
    <article class="ls-card overflow-hidden">
      <div class="border-b border-[var(--bs-border)] bg-surface-muted px-6 py-8 sm:px-10">
        <p class="bs-public-legal-page__identity text-xs font-bold text-brand-gold-highlight">{{ eyebrow }}</p>
        <h1 class="mt-3 text-3xl font-black tracking-[-.04em] sm:text-4xl">{{ document.title }}</h1>
        <p class="mt-4 max-w-3xl text-sm leading-7 text-fg-muted sm:text-base">{{ document.intro }}</p>
        <BsButton v-if="privacySettingsLabel" class="mt-4" variant="secondary" @click="$emit('privacySettings')">{{ privacySettingsLabel }}</BsButton>
        <p class="mt-4 text-xs text-fg-muted">{{ lastUpdatedLabel }} {{ document.updated }}</p>
      </div>
      <div class="bs-public-legal-page__body space-y-9 px-6 py-8 sm:px-10 sm:py-10">
        <section v-for="section in document.sections" :key="section.title">
          <h2 class="text-xl font-black tracking-[-.02em]">{{ section.title }}</h2>
          <div v-if="section.paragraphs?.length" class="mt-3 space-y-3">
            <p v-for="paragraph in section.paragraphs" :key="paragraph" class="text-sm leading-7 text-fg-muted sm:text-base">{{ paragraph }}</p>
          </div>
          <ul v-if="section.bullets?.length" class="mt-3 space-y-2 ps-5 text-sm leading-7 text-fg-muted sm:text-base">
            <li v-for="bullet in section.bullets" :key="bullet" class="list-disc">{{ bullet }}</li>
          </ul>
        </section>
      </div>
    </article>
  </main>
</template>

<style>
.bs-public-legal-page__body section { max-inline-size: 65ch; }
.bs-public-legal-page__body { overflow-wrap: anywhere; }
.bs-public-legal-page--flat article { box-shadow: none; }
.bs-public-legal-page--flat h1 { font-size: var(--bs-type-display-size); line-height: var(--bs-type-display-lh); font-weight: var(--bs-weight-extrabold); letter-spacing: normal; }
.bs-public-legal-page--flat h2 { font-size: var(--bs-type-h2-size); line-height: var(--bs-type-h2-lh); font-weight: var(--bs-weight-bold); letter-spacing: normal; }
</style>
