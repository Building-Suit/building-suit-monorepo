<script setup lang="ts">
import { NuxtLink } from '#components';

const trustSignals = ['trustSignal1', 'trustSignal2', 'trustSignal3'];
</script>

<template>
  <LandingHeroBackground
    class="min-h-screen w-full flex flex-col items-center text-center"
  >
    <div class="flex flex-col items-center justify-center gap-10 px-2">
      <h1
        class="text-4xl font-extrabold tracking-tight text-primary-foreground sm:text-5xl lg:text-6xl xl:text-7xl"
      >
        {{ $t('hero.title') }} <br />
        <span class="text-secondary">{{ $t('hero.subtitle') }}</span>
      </h1>

      <p
        class="text-lg text-primary-foreground/80 sm:text-xl max-w-2xl mx-auto"
      >
        {{ $t('hero.description') }}
      </p>

      <!-- Visual -->
      <div class="w-full h-96 bg-primary-foreground/60 rounded-lg"></div>

      <div class="flex flex-col sm:flex-row gap-4">
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

        <Button
          as="a"
          href="https://www.youtube.com/watch?v=dQw4w9WgXcQ"
          target="_blank"
          class="h-12 px-8 font-bold"
          color="primary"
          variant="outline"
        >
          {{ $t('hero.seeHowItWorks') }}
          <Icon name="lucide:play" class="size-5" />
        </Button>
      </div>

      <div class="md:flex grid gap-2">
        <div
          v-for="signal in trustSignals"
          :key="signal"
          :class="[
            'px-3 py-1 border border-primary-foreground/20 rounded-full text-primary-foreground/80 text-sm',
            'flex items-center gap-2',
          ]"
        >
          <Icon name="lucide:circle-check" class="size-4 text-secondary" />
          {{ $t(`hero.${signal}`) }}
        </div>
      </div>
    </div>
  </LandingHeroBackground>
</template>
