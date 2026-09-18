<script setup lang="ts">
defineProps<{ step: number; steps: Array<{ title: string; body?: string }>; pending?: boolean }>()
const emit = defineEmits<{ back: [] }>()
const ui = useUiCopy()
</script>
<template>
  <div class="space-y-6">
    <ol class="flex gap-3" :aria-label="ui('step')">
      <li v-for="(item, index) in steps" :key="item.title" class="flex flex-1 gap-2" :aria-current="index + 1 === step ? 'step' : undefined" :class="index + 1 > step ? 'opacity-50' : ''"><span class="grid size-8 shrink-0 place-items-center rounded-full border border-line text-xs font-bold" :class="index + 1 === step ? 'bg-primary text-[var(--bs-text-on-primary)]' : ''">{{ index + 1 }}</span><div><p class="text-sm font-bold">{{ item.title }}</p><p v-if="item.body" class="text-xs text-fg-muted">{{ item.body }}</p></div></li>
    </ol>
    <div class="flex items-center justify-between gap-3"><h2 class="text-xl font-black">{{ steps[step - 1]?.title }}</h2><button v-if="step > 1" type="button" class="ls-btn ls-btn-sm" :disabled="pending" @click="emit('back')">{{ ui('previous') }}</button></div>
    <slot :step="step" />
  </div>
</template>
