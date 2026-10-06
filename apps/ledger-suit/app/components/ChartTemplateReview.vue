<script setup lang="ts">
import { reviewedChartTemplates, type ChartTemplateKey } from '~/utils/setupExperience'

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const selected = ref<ChartTemplateKey>('services')
const visible = computed(() => route.query.setup === 'templates')
const template = computed(() => reviewedChartTemplates.find(item => item.key === selected.value)!)

function close() {
  const query = { ...route.query }
  delete query.setup
  void router.replace({ query })
}
</script>

<template>
  <section v-if="visible" class="ls-card space-y-4 p-5" aria-labelledby="chart-template-heading" data-chart-template-review>
    <div class="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h2 id="chart-template-heading" class="text-h2 font-bold">{{ t('chartTemplates.title') }}</h2>
        <p class="mt-1 text-sm text-fg-muted">{{ t('chartTemplates.hint') }}</p>
      </div>
      <BsButton type="button" class="ls-btn ls-btn-sm" @click="close">{{ t('common.close') }}</BsButton>
    </div>

    <div class="rounded-control border border-warning bg-[var(--bs-status-warning-bg)] p-4 text-sm" role="note">
      <p class="font-semibold">{{ t('chartTemplates.reviewRequired') }}</p>
      <p class="mt-1">{{ t('chartTemplates.noApply') }}</p>
    </div>

    <div class="flex flex-wrap gap-2" role="group" :aria-label="t('chartTemplates.choose')">
      <BsButton v-for="item in reviewedChartTemplates" :key="item.key" variant="chip" type="button" :aria-pressed="selected === item.key" @click="selected = item.key">
        {{ t(`chartTemplates.templates.${item.key}.title`) }}
      </BsButton>
    </div>
    <p class="text-sm text-fg-muted">{{ t(`chartTemplates.templates.${selected}.description`) }}</p>

    <BsDataTable :value="template.accounts" row-key="code" :label="t('chartTemplates.preview')" :table-style="{ minWidth: '720px' }" :columns="[{ key: 'code', field: 'code', header: t('accounts.code') }, { key: 'column2', header: t('accounts.account') }, { key: 'column3', header: t('chartTemplates.parent') }, { key: 'column4', header: t('accounts.role') }, { key: 'column5', header: t('chartTemplates.presentation') }]">
      <template #cell-code="{ row: account }"><span class="font-mono text-xs" dir="ltr">{{ account.code }}</span></template>
      <template #cell-column2="{ row: account }">{{ t(`chartTemplates.accounts.${account.nameKey}`) }}</template>
      <template #cell-column3="{ row: account }"><span class="font-mono text-xs" dir="ltr">{{ account.parentCode ?? t('common.dash') }}</span></template>
      <template #cell-column4="{ row: account }">{{ t(`accounts.roles.${account.role}`) }}</template>
      <template #cell-column5="{ row: account }">{{ account.statementLine ? t(`chartTemplates.lines.${account.statementLine}`) : t('common.dash') }}</template>

    </BsDataTable>
  </section>
</template>
