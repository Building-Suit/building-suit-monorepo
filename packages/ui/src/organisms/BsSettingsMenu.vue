<script setup lang="ts">
import { useFloatingMenu } from '@building-suit/ux'
withDefaults(defineProps<{
  alwaysShowLabel?: boolean
  embedded?: boolean
}>(), {
  alwaysShowLabel: false,
  embedded: false,
})

const { locale, locales, setLocale } = useI18n()
const ui = useUiCopy()
const { preference, set: setTheme } = useTheme()

const { open, root, panel, hydrated, position, openMenu, closeMenu, onKeydown } = useFloatingMenu('.ls-card')

const available = computed(() =>
  (locales.value as Array<{ code: string, name?: string }>).map(l => ({
    code: l.code,
    name: l.name ?? l.code,
  })),
)

const THEMES: Array<{ value: 'light' | 'dark' | 'system', labelKey: 'themeLight' | 'themeDark' | 'themeSystem' }> = [
  { value: 'light', labelKey: 'themeLight' },
  { value: 'dark', labelKey: 'themeDark' },
  { value: 'system', labelKey: 'themeSystem' },
]

</script>

<template>
  <div v-if="embedded" class="space-y-3">
    <section>
      <p class="px-2 pb-1 text-xs font-semibold text-fg-muted">
        {{ ui('language') }}
      </p>

      <div class="grid grid-cols-2 gap-1">
        <button
          v-for="option in available"
          :key="option.code"
          type="button"
          role="menuitemradio"
          :aria-checked="hydrated && locale === option.code"
          :aria-pressed="hydrated && locale === option.code"
          class="flex items-center justify-between rounded-chip px-2 py-2 text-start text-sm hover:bg-surface-muted"
          :class="{ 'bg-surface-muted font-semibold': hydrated && locale === option.code }"
          @click="setLocale(option.code as typeof locale)"
        >
          <span>{{ option.name }}</span>
          <BsIcon
            v-if="hydrated && locale === option.code"
            name="check"
            class="text-[var(--bs-status-success)]"
          />
        </button>
      </div>
    </section>

    <section>
      <p class="px-2 pb-1 text-xs font-semibold text-fg-muted">
        {{ ui('theme') }}
      </p>

      <div class="space-y-1">
        <button
          v-for="option in THEMES"
          :key="option.value"
          type="button"
          role="menuitemradio"
          :aria-checked="hydrated && preference === option.value"
          :aria-pressed="hydrated && preference === option.value"
          class="flex w-full items-center justify-between rounded-chip px-2 py-2 text-start text-sm hover:bg-surface-muted"
          :class="{ 'bg-surface-muted font-semibold': hydrated && preference === option.value }"
          @click="setTheme(option.value)"
        >
          <span>{{ ui(option.labelKey) }}</span>
          <BsIcon
            v-if="hydrated && preference === option.value"
            name="check"
            class="text-[var(--bs-status-success)]"
          />
        </button>
      </div>
    </section>
  </div>

  <div
    v-else
    ref="root"
    class="relative"
    @keydown="onKeydown"
  >
    <button
      type="button"
      class="ls-btn ls-btn-sm w-full"
      :disabled="!hydrated"
      :aria-expanded="open"
      :aria-label="`${ui('language')} · ${ui('theme')}`"
      aria-haspopup="menu"
      @click="openMenu"
    >
      <BsIcon name="settings" />

      <span :class="{ 'hidden sm:inline': !alwaysShowLabel }">
        {{ ui('language') }} · {{ ui('theme') }}
      </span>
    </button>

    <div
      v-show="open"
      ref="panel"
      :class="[
        'ls-card absolute start-0 z-30 my-1 w-56 p-2 shadow-overlay',
        position === 'bottom'
          ? 'top-full'
          : 'bottom-full',
      ]"
      role="menu"
    >
      <p class="px-2 pb-1 text-xs font-semibold text-fg-muted">
        {{ ui('language') }}
      </p>

      <button
        v-for="option in available"
        :key="option.code"
        type="button"
        role="menuitemradio"
        :aria-checked="hydrated && locale === option.code"
        class="flex w-full items-center justify-between rounded-chip px-2 py-2 text-start text-sm hover:bg-surface-muted"
        @click="setLocale(option.code as typeof locale); closeMenu(true)"
      >
        <span>{{ option.name }}</span>
        <BsIcon
          v-if="hydrated && locale === option.code"
          name="check"
          class="text-[var(--bs-status-success)]"
        />
      </button>

      <hr class="my-2 border-[var(--bs-border)]">

      <p class="px-2 pb-1 text-xs font-semibold text-fg-muted">
        {{ ui('theme') }}
      </p>

      <button
        v-for="option in THEMES"
        :key="option.value"
        type="button"
        role="menuitemradio"
        :aria-checked="hydrated && preference === option.value"
        class="flex w-full items-center justify-between rounded-chip px-2 py-2 text-start text-sm hover:bg-surface-muted"
        @click="setTheme(option.value)"
      >
        <span>{{ ui(option.labelKey) }}</span>

        <BsIcon
          v-if="hydrated && preference === option.value"
          name="check"
          class="text-[var(--bs-status-success)]"
        />
      </button>
    </div>
  </div>
</template>
