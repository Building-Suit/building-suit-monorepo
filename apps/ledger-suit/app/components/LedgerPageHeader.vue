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

const context = computed(() => [
  { label: t('pageContext.organization'), value: current.value?.name ?? t('org.none') },
  ...(period.value ? [{ label: t('pageContext.reportingPeriod'), value: period.value }] : []),
])
</script>

<template>
  <BsPageHeader :title="title" :subtitle="subtitle" :context="context" :context-label="t('pageContext.label')">
    <template v-if="$slots.actions" #actions><slot name="actions" /></template>
  </BsPageHeader>
</template>
