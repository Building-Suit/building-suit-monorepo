<script setup lang="ts">
const proFeatures = [
  'inventory.feature01',
  'inventory.feature02',
  'inventory.feature03',
  'inventory.feature04',
];
</script>

<template>
  <div
    class="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-20 items-center px-4 max-w-6xl w-full mx-auto py-36"
  >
    <div class="flex flex-col gap-6">
      <Badge class="text-md bg-secondary/20 text-secondary">
        <Icon name="lucide:package" />
        {{ $t('inventory.proPlanOnly') }}
      </Badge>

      <h2 class="text-3xl font-bold text-primary sm:text-4xl lg:text-5xl">
        {{ $t('inventory.neverLoseTrackOfYour') }}
        <span class="text-secondary"> {{ $t('inventory.stock') }} </span>
        {{ $t('inventory.again') }}
      </h2>

      <p class="text-lg text-muted-foreground">
        {{ $t('inventory.description') }}
      </p>

      <ul class="flex flex-col font-semibold gap-4">
        <li
          v-for="feature in proFeatures"
          :key="feature"
          class="flex items-center gap-2"
        >
          <Icon name="lucide:check-circle" class="text-secondary" />
          {{ $t(feature) }}
        </li>
      </ul>

      <p class="text-muted-foreground">
        {{ $t('inventory.perfectForShops') }}
      </p>
    </div>

    <div>
      <LandingHeroBackground
        class="w-full h-96 bg-primary/30 rounded-lg"
        :with-svg="false"
      >
        <div class="absolute inset-8 bg-primary-foreground/60 rounded-xl"></div>
      </LandingHeroBackground>
    </div>
  </div>
</template>
