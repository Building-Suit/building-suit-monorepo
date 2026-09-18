<script setup lang="ts">
const { data: plans, isLoading, error, refresh } = usePlans();
</script>

<template>
  <div class="grid w-full gap-8 md:w-3/4 lg:grid-cols-2">
    <!-- Loading: skeletons, no blank screen -->
    <template v-if="isLoading">
      <div
        v-for="n in 2"
        :key="`skeleton-${n}`"
        class="h-[28rem] animate-pulse rounded-xl bg-muted"
        aria-hidden="true"
      />
    </template>

    <!-- Error: explain + retry -->
    <div
      v-else-if="error"
      class="status-error col-span-full rounded-lg p-4 text-center text-body-md"
      role="alert"
    >
      <p>{{ $t('pricing.loadError') }}</p>
      <Button variant="outline" size="sm" class="mt-3" @click="() => refresh()">
        {{ $t('common.retry') }}
      </Button>
    </div>

    <!-- Empty: explain -->
    <div
      v-else-if="!plans || plans.length === 0"
      class="col-span-full rounded-xl border border-border bg-card p-10 text-center text-body-md text-muted-foreground"
    >
      {{ $t('pricing.empty') }}
    </div>

    <template v-else>
      <div
        v-for="plan in plans"
        :key="plan.id"
        :class="[
          'relative',
          plan.slug === 'pro' && 'bg-primary text-primary-foreground',
          ' flex flex-col justify-between gap-12 rounded-xl border border-border bg-card p-8 shadow-sm',
        ]"
      >
        <div
          v-if="plan.slug === 'pro'"
          class="absolute left-1/2 top-0.5 -translate-x-1/2 -translate-y-1/2"
        >
          <Badge class="px-3 py-1 text-sm" variant="secondary">
            <Icon name="lucide:stars" />
            {{ $t('pricing.mostPopular') }}
          </Badge>
        </div>

        <div class="flex flex-col gap-6">
          <h3 class="text-title-lg">{{ plan.name }}</h3>

          <div class="flex items-baseline gap-1">
            <span class="text-5xl font-bold">
              {{ useNumberFormat(plan.price_amount) }}
            </span>
            <span :class="[plan.slug === 'pro' && 'text-primary-foreground/80']">
              {{ $t(`pricing.${plan.currency}`) }}
            </span>
            <span :class="[plan.slug === 'pro' && 'text-primary-foreground/60']">
              /{{ $t(`pricing.${plan.billing_interval}`) }}
            </span>
          </div>

          <Badge :variant="plan.slug === 'pro' ? 'secondary' : 'default'">
            {{ $t('pricing.trial', { trialDays: plan.trial_days }) }}
          </Badge>

          <ul class="flex flex-col gap-2">
            <li
              v-for="feature in $tm('pricing.features')"
              :key="feature"
              class="flex items-center gap-3"
            >
              <Icon name="lucide:check" class="text-secondary" />
              {{ feature }}
            </li>
            <li
              v-for="feature in $tm('pricing.inventoryFeatures')"
              :key="feature"
              class="flex items-center gap-3"
            >
              <Icon
                v-if="plan.features?.inventory"
                name="lucide:check"
                class="text-secondary"
              />
              <Icon v-else name="lucide:x" class="text-muted-foreground" />
              {{ feature }}
            </li>
          </ul>
        </div>

        <Button
          size="lg"
          :variant="plan.slug === 'pro' ? 'secondary' : 'outline'"
          class="w-full"
        >
          {{ $t('pricing.cta') }}
        </Button>
      </div>
    </template>
  </div>
</template>
