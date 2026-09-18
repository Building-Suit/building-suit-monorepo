<script setup lang="ts">
const industries = [
  {
    name: 'stores',
    icon: 'lucide:store',
  },
  {
    name: 'electricians',
    icon: 'lucide:lightbulb',
  },
  {
    name: 'coffee',
    icon: 'lucide:coffee',
  },
  {
    name: 'retail',
    icon: 'lucide:shopping-bag',
  },
  {
    name: 'barbers',
    icon: 'lucide:scissors',
  },
  {
    name: 'pharmacy',
    icon: 'lucide:pill',
  },
  {
    name: 'repairs',
    icon: 'lucide:smartphone',
  },
  {
    name: 'clothing',
    icon: 'lucide:shirt',
  },
];
</script>

<template>
  <div
    class="w-full bg-primary-foreground/10 rounded-lg flex flex-col items-center justify-center gap-10 mt-12 mb-28"
  >
    <p class="text-lg font-bold text-primary">
      {{ $t('socialProofBar.trustedBy') }}
    </p>

    <div class="flex relative overflow-hidden w-5/6 md:w-2/3 xl:w-1/3 mx-auto">
      <!-- Gradient fade edges (semantic surface color; physical edges so the fade direction stays correct in RTL) -->
      <div
        class="pointer-events-none absolute inset-y-0 left-0 w-16 bg-linear-to-r from-background to-transparent z-10"
      />
      <div
        class="pointer-events-none absolute inset-y-0 right-0 w-16 bg-linear-to-l from-background to-transparent z-10"
      />

      <ul class="flex items-center gap-8 animate-infinite-scroll">
        <TooltipProvider
          v-for="industry in [...industries, ...industries]"
          :key="industry.name"
        >
          <Tooltip>
            <TooltipTrigger as-child>
              <li
                class="rounded-lg p-3 flex items-center justify-center bg-primary/10 hover:bg-primary/20 transition-colors"
              >
                <Icon
                  :name="industry.icon"
                  class="lg:size-8 size-6 text-primary/80"
                />
              </li>
            </TooltipTrigger>
            <TooltipContent>
              <p>{{ $t(`socialProofBar.industries.${industry.name}`) }}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </ul>
    </div>
  </div>
</template>

<style scoped>
@keyframes infinite-scroll {
  0% {
    transform: translateX(0);
  }
  100% {
    transform: translateX(calc(-50% - 16px));
  }
}

/* when RTL do something else */
@keyframes infinite-scroll-rtl {
  0% {
    transform: translateX(0);
  }
  100% {
    transform: translateX(calc(50% + 16px));
  }
}

:not([dir='rtl']) .animate-infinite-scroll {
  animation: infinite-scroll 25s linear infinite;
}

[dir='rtl'] .animate-infinite-scroll {
  animation: infinite-scroll-rtl 25s linear infinite;
}

.animate-infinite-scroll:hover {
  animation-play-state: paused;
}

@media (prefers-reduced-motion: reduce) {
  .animate-infinite-scroll {
    animation: none;
  }
}
</style>
