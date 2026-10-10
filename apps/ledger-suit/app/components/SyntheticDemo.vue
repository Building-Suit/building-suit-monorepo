<script setup lang="ts">
import { addSyntheticReceipt, createSyntheticDemo, resetSyntheticDemo } from '~/utils/setupExperience'

const emit = defineEmits<{ close: [] }>()
const { t, locale } = useI18n()
const state = ref(createSyntheticDemo())
const amount = (value: string) => formatMoney(value, 'EGP', locale.value)

function addReceipt() { state.value = addSyntheticReceipt(state.value) }
function reset() { state.value = resetSyntheticDemo(state.value) }
</script>

<template>
  <section class="ls-card space-y-5 p-6 md:col-span-2" aria-labelledby="synthetic-demo-title" data-synthetic-demo data-demo-scope="isolated_synthetic_demo">
    <div class="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h2 id="synthetic-demo-title" class="text-lg font-bold">{{ t('demo.title') }}</h2>
        <p class="mt-1 text-sm text-fg-muted">{{ t('demo.isolation') }}</p>
      </div>
      <BsButton type="button" class="ls-btn ls-btn-sm" @click="emit('close')">{{ t('common.close') }}</BsButton>
    </div>

    <div class="rounded-control bg-surface-muted p-4 text-sm" role="status">
      <strong>{{ t('demo.syntheticBadge') }}</strong>
      <p class="mt-1">{{ t('demo.noRealOrganization') }}</p>
    </div>

    <BsDataTable :value="state.accounts" row-key="code" :label="t('demo.title')" :table-style="{ minWidth: '520px' }" :columns="[{ key: 'code', field: 'code', header: t('accounts.code') }, { key: 'column2', header: t('accounts.account') }, { key: 'column3', header: t('opening.debit'), align: 'end' as const }, { key: 'column4', header: t('opening.credit'), align: 'end' as const }]">
      <template #cell-code="{ row: account }"><span class="font-mono text-xs" dir="ltr">{{ account.code }}</span></template>
      <template #cell-column2="{ row: account }">{{ t(`chartTemplates.accounts.${account.nameKey}`) }}</template>
      <template #cell-column3="{ row: account }">{{ amount(account.debitMinor) }}</template>
      <template #cell-column4="{ row: account }">{{ amount(account.creditMinor) }}</template>

    </BsDataTable>

    <div class="flex flex-wrap gap-2">
      <BsButton type="button" class="ls-btn ls-btn-primary" @click="addReceipt">{{ t('demo.addReceipt') }}</BsButton>
      <BsButton type="button" class="ls-btn" @click="reset">{{ t('demo.reset') }}</BsButton>
    </div>
    <p class="text-xs text-fg-muted">{{ t('demo.revision', { revision: state.revision }) }}</p>
  </section>
</template>
