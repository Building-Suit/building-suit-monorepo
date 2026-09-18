<script setup lang="ts">
import { NuxtLink } from '#components';
</script>

<template>
  <LandingHeroBackground :with-svg="false">
    <div class="flex flex-col gap-8 items-center justify-center">
      <div class="flex flex-col gap-4 items-center justify-center text-center">
        <h2
          class="text-3xl font-bold text-primary-foreground sm:text-4xl lg:text-5xl leading-snug"
        >
          {{ $t('closingCTA.title') }} <br />
          <span class="text-secondary">{{ $t('closingCTA.subtitle') }}</span>
        </h2>

        <p
          class="text-lg text-primary-foreground/80 sm:text-xl max-w-2xl mx-auto"
        >
          {{ $t('closingCTA.description') }}
        </p>
      </div>

      <div class="flex items-center gap-4">
        <div class="flex flex-col gap-2">
          <Button
            :as="NuxtLink"
            to="#pricing"
            :class="[
              'hover:scale-105 transition-transform duration-300',
              'h-12 px-8 font-bold',
            ]"
            color="primary"
            variant="secondary"
          >
            <Icon name="lucide:arrow-right" class="size-5 hidden rtl:block" />
            {{ $t('hero.cta') }}
            <Icon name="lucide:arrow-right" class="size-5 rtl:hidden" />
          </Button>

          <div
            class="text-xs text-primary-foreground/80 flex items-center justify-center gap-2"
          >
            <Icon name="lucide:check-circle" class="size-4 text-secondary" />
            {{ $t('hero.noCreditCard') }}
          </div>
        </div>
      </div>
    </div>
  </LandingHeroBackground>
</template>
