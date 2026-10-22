<script setup lang="ts">
import { useFloatingMenu } from '@building-suit/ux'
withDefaults(defineProps<{
  alwaysShowLabel?: boolean
  embedded?: boolean
  cycle?: 'theme' | 'language'
}>(), {
  alwaysShowLabel: false,
  embedded: false,
  cycle: undefined,
})

const { locale, locales, setLocale } = useI18n()
const ui = useUiCopy()
const { preference, set: setTheme, cycle: cycleTheme } = useTheme()

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

const themeLabel = computed(() => ui(preference.value === 'light' ? 'themeLight' : preference.value === 'dark' ? 'themeDark' : 'themeSystem'))
const languageLabel = computed(() => available.value.find(option => option.code === locale.value)?.name ?? locale.value)
const languagePending = ref(false)
async function cycleLanguage() {
  if (languagePending.value) return
  const index = available.value.findIndex(option => option.code === locale.value)
  const next = available.value[(index + 1) % available.value.length]
  if (!next) return
  languagePending.value = true
  try { await setLocale(next.code as typeof locale.value) }
  finally { languagePending.value = false }
}
</script>

<template>
  <button v-if="cycle" type="button" class="bs-settings-menu__icon-trigger" :disabled="!hydrated || (cycle === 'language' && (available.length < 2 || languagePending))"
    :aria-label="cycle === 'theme' ? `${ui('theme')}: ${themeLabel}` : `${ui('language')}: ${languageLabel}`"
    :title="cycle === 'theme' ? `${ui('theme')}: ${themeLabel}` : `${ui('language')}: ${languageLabel}`"
    @click="cycle === 'theme' ? cycleTheme() : cycleLanguage()">
    <BsIcon v-if="cycle === 'theme'" :name="preference === 'light' ? 'sun' : preference === 'dark' ? 'moon' : 'monitor'" />
    <span v-else class="bs-settings-menu__language" :lang="locale">{{ languageLabel }}</span>
  </button>
  <div v-else-if="embedded" class="space-y-3">
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

<style scoped>
.bs-settings-menu__icon-trigger {
  display: inline-flex; align-items: center; justify-content: center;
  inline-size: 44px; block-size: 44px; border-radius: var(--bs-radius-button);
  color: var(--bs-text-muted); background: transparent; border: 0; cursor: pointer;
}
.bs-settings-menu__language { font-size: .875rem; font-weight: var(--bs-weight-semibold); }
.bs-settings-menu__icon-trigger:hover { background: var(--bs-surface-muted); color: var(--bs-text); }
.bs-settings-menu__icon-trigger:focus-visible { outline: 2px solid var(--bs-focus-ring); outline-offset: 2px; }
</style>
