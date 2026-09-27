<script setup lang="ts">
const props = defineProps<{
  title: string
  subtitle?: string
  from?: string
  to?: string
  asOf?: string
}>()

const { current } = useTenant()
const { t, locale } = useI18n()

function formatDate(value?: string) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return ''
  const date = new Date(`${value}T00:00:00.000Z`)
  if (Number.isNaN(date.valueOf())) return value
  return new Intl.DateTimeFormat(locale.value, { dateStyle: 'medium', timeZone: 'UTC' }).format(date)
}

const period = computed(() => {
  if (props.asOf) return t('pageContext.asOfValue', { date: formatDate(props.asOf) })
  if (props.from && props.to) return t('pageContext.periodValue', { from: formatDate(props.from), to: formatDate(props.to) })
  return ''
})
</script>

<template>
  <header class="flex min-w-0 flex-wrap items-start justify-between gap-4">
    <div class="min-w-0">
      <h1 class="text-h1 font-bold">{{ title }}</h1>
      <p v-if="subtitle" class="mt-1 text-sm text-fg-muted">{{ subtitle }}</p>
      <dl class="mt-3 flex min-w-0 flex-wrap gap-x-4 gap-y-1 text-xs text-fg-muted" :aria-label="t('pageContext.label')">
        <div class="flex min-w-0 items-center gap-1.5">
          <dt class="font-semibold">{{ t('pageContext.organization') }}</dt>
          <dd class="max-w-64 truncate text-fg">{{ current?.name ?? t('org.none') }}</dd>
        </div>
        <div v-if="period" class="flex min-w-0 items-center gap-1.5">
          <dt class="font-semibold">{{ t('pageContext.reportingPeriod') }}</dt>
          <dd class="text-fg">{{ period }}</dd>
        </div>
      </dl>
    </div>
    <div v-if="$slots.actions" class="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:justify-end">
      <slot name="actions" />
    </div>
  </header>
</template>
