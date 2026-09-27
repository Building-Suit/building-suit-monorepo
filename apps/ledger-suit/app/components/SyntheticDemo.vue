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
      <button type="button" class="ls-btn ls-btn-sm" @click="emit('close')">{{ t('common.close') }}</button>
    </div>

    <div class="rounded-control bg-surface-muted p-4 text-sm" role="status">
      <strong>{{ t('demo.syntheticBadge') }}</strong>
      <p class="mt-1">{{ t('demo.noRealOrganization') }}</p>
    </div>

    <BsDataTable :value="state.accounts" data-key="code" :label="t('demo.title')" :table-style="{ minWidth: '520px' }">
      <Column field="code" :header="t('accounts.code')"><template #body="{ data: account }"><span class="font-mono text-xs" dir="ltr">{{ account.code }}</span></template></Column>
      <Column :header="t('accounts.account')"><template #body="{ data: account }">{{ t(`chartTemplates.accounts.${account.nameKey}`) }}</template></Column>
      <Column :header="t('opening.debit')" header-class="text-end" body-class="ls-num"><template #body="{ data: account }">{{ amount(account.debitMinor) }}</template></Column>
      <Column :header="t('opening.credit')" header-class="text-end" body-class="ls-num"><template #body="{ data: account }">{{ amount(account.creditMinor) }}</template></Column>
    </BsDataTable>

    <div class="flex flex-wrap gap-2">
      <button type="button" class="ls-btn ls-btn-primary" @click="addReceipt">{{ t('demo.addReceipt') }}</button>
      <button type="button" class="ls-btn" @click="reset">{{ t('demo.reset') }}</button>
    </div>
    <p class="text-xs text-fg-muted">{{ t('demo.revision', { revision: state.revision }) }}</p>
  </section>
</template>
