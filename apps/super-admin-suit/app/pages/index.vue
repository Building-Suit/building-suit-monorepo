<script setup lang="ts">
import type { ActivityRow, ActivityQuery } from '../utils/activity'
definePageMeta({ layout: false })
const { t, locale } = useI18n()
const { ready, state, pending, actionError, recheck, signIn, signOut } = useAdminSession()
await ready
const { registry, selection, state: registryState, label } = useAdminRegistry()
if (state.value === 'success') await registry.refresh()
watch(state, (value) => {
  registry.clear()
  if (value === 'success') void registry.refresh()
})
onMounted(() => {
  // Periodically re-resolve configuration and manifest expiry without a rebuild.
  const timer = setInterval(() => {
    if (state.value === 'success' && !transferVisible.value && document.visibilityState === 'visible') void registry.refresh()
  }, 30_000)
  onScopeDispose(() => { clearInterval(timer); registry.clear() })
})
const transfer = useManualTransfer(() => selection.value.item?.bindingId, () => state.value === 'success' && registryState.value === 'success' && selection.value.item?.module === 'manual-transfer')
const { configuration, draft, reason, status: transferStatus, command, action: transferAction } = transfer
const { visible: transferVisible, pending: transferPending, dirty: transferDirty, error: transferError } = transferAction
const activity = useActivity(() => `${ready.data.value?.userId}:${ready.data.value?.authorityEnvironmentId}:${state.value}:${selection.value.suit?.key}:${selection.value.item?.key}`, () => state.value === 'success' && registryState.value === 'success' && selection.value.item?.module === 'activity')
const { query: activityQuery, rows: activityRows, sources: activitySources, total: activityTotal, status: activityStatus, retrieving, remoteFailed } = activity
const filterKeys = ['suit', 'environment', 'action', 'actor', 'target', 'from', 'to', 'requestId', 'correlationId'] as const satisfies readonly (keyof ActivityQuery)[]
const activityColumns = computed(() => (['source', 'suit', 'environment', 'actor', 'action', 'target', 'status', 'reason', 'requestId', 'correlationId', 'occurredAt'] as const satisfies readonly (keyof ActivityRow)[]).map(field => ({ field, header: t(`activity.${field}`) })))
const email = ref('')
const password = ref('')
useHead({ title: () => t('product.name') })
async function submit() {
  const credential = password.value
  password.value = ''
  await signIn(email.value.trim(), credential)
}
</script>

<template>
  <BsRouteLayout v-if="state === 'success'" name="default">
    <BsContentSection :title="t('welcome')" :description="t('description')" padding="lg">
      <BsStateSurface state="success" :title="t('auth.authorized')" />
      <BsStateSurface v-if="registryState !== 'success'" :state="registryState" :title="t(`registry.${registryState}`)" :action-label="registryState === 'loading' ? undefined : t('registry.retry')" @action="registry.refresh()" />
      <BsContentSection v-else :title="selection.item ? label(selection.item.label) : label(selection.suit!.label)" :description="label(selection.item?.description || selection.suit!.description)">
        <div v-if="selection.item?.module === 'activity'" class="min-w-0 space-y-4" data-activity>
          <p class="text-sm text-fg-muted">{{ t('activity.partial') }}</p>
          <BsForm class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3" @submit="activity.apply()">
            <BsField v-for="key in filterKeys" :key="key" :for="`activity-${key}`" :label="t(`activity.${key}`)">
              <BsInput :id="`activity-${key}`" v-model="activityQuery[key]" :maxlength="200" :placeholder="key === 'from' || key === 'to' ? '2026-01-01T00:00:00Z' : undefined" />
            </BsField>
            <BsButton type="submit" :disabled="activityStatus === 'loading'">{{ t('activity.filter') }}</BsButton>
          </BsForm>
          <BsStateSurface v-if="activityStatus !== 'success'" :state="activityStatus" :title="t(`activity.${activityStatus}`)" :action-label="activityStatus === 'error' ? t('activity.retry') : undefined" @action="activity.load()" />
          <BsDataTable v-if="activityStatus === 'success'" :value="activityRows" :label="t('activity.title')" lazy paginator :rows="activityQuery.pageSize" :first="(activityQuery.page - 1) * activityQuery.pageSize" :total-records="activityTotal" :query-adapter="activity.queryAdapter" :sort-order="activityQuery.order === 'asc' ? 1 : -1" sort-field="occurredAt" :capabilities="{}" density="compact" :scroll-label="t('activity.title')">
            <Column v-for="column in activityColumns" :key="column.field" :field="column.field" :header="column.header" :sortable="column.field === 'occurredAt'">
              <template #body="{ data }"><span class="block max-w-64 break-words" :dir="column.field === 'requestId' || column.field === 'correlationId' ? 'ltr' : undefined">{{ data[column.field] || '—' }}</span></template>
            </Column>
          </BsDataTable>
          <BsStateSurface v-if="remoteFailed" state="error" :title="t('activity.remoteError')" />
          <div v-for="source in activitySources" :key="`${source.bindingId}:${source.stream}`" class="flex flex-wrap items-center gap-3 border-t border-line pt-3 text-sm" data-activity-source>
            <span>{{ source.suit }} · {{ source.environment }} · {{ source.stream }}</span>
            <span>{{ t('activity.observed') }}: {{ source.lastObservedAt || t('activity.never') }}</span>
            <span v-if="source.lastFailedAt">{{ t('activity.failed') }}: {{ source.lastFailedAt }}</span>
            <BsButton :pending="retrieving" :disabled="retrieving" @click="activity.retrieve(source)">{{ t('activity.retrieve') }} {{ source.nextPage }}</BsButton>
          </div>
        </div>
        <div v-if="selection.item?.module === 'manual-transfer'" class="max-w-3xl space-y-5" data-transfer>
          <p class="text-sm text-fg-muted">{{ t('transfer.manual') }}</p>
          <BsStateSurface :state="transferStatus === 'configured' ? 'success' : transferStatus === 'loading' ? 'loading' : transferStatus === 'error' ? 'error' : transferStatus === 'denied' ? 'denied' : 'empty'" :title="t(`transfer.${transferStatus}`)" :action-label="transferStatus === 'error' || transferStatus === 'denied' ? t('registry.retry') : undefined" @action="transfer.load()" />
          <div v-if="transferStatus === 'configured' && configuration" data-transfer-preview class="space-y-3 break-words">
            <p class="font-semibold">{{ configuration.recipientAlias }}</p>
            <p class="whitespace-pre-wrap">{{ configuration.recipientDetails }}</p>
            <p class="whitespace-pre-wrap">{{ configuration.instructions[locale === 'ar' ? 'ar' : 'en'] }}</p>
            <a v-if="configuration.paymentLink" :href="configuration.paymentLink" target="_blank" rel="noopener noreferrer" class="underline">{{ t('transfer.link') }}</a>
            <img v-if="configuration.qr.assetUrl" :src="configuration.qr.assetUrl" :alt="configuration.qr.alt[locale === 'ar' ? 'ar' : 'en']" class="max-w-48 h-auto" loading="lazy" referrerpolicy="no-referrer">
            <p v-if="configuration.qr.assetUrl" class="text-sm break-all">{{ t('transfer.qrAsset') }}: {{ configuration.qr.assetUrl }} — {{ configuration.qr.alt[locale === 'ar' ? 'ar' : 'en'] }}</p>
          </div>
          <BsButton v-if="['configured', 'empty', 'disabled', 'incomplete'].includes(transferStatus)" @click="transfer.edit()">{{ t('transfer.edit') }}</BsButton>
          <BsRecordActionDialog v-model:visible="transferVisible" :title="t('transfer.edit')" :pending="transferPending" :dirty="transferDirty" :error="transferError" :submit-label="command ? t('transfer.retrySave') : t('transfer.save')" @submit="transfer.save()">
            <fieldset :disabled="!!command" class="space-y-4 min-w-0 border-0 p-0 m-0">
              <BsField for="transfer-enabled" :label="t('transfer.enabled')" required>
                <BsSelect id="transfer-enabled" :label="t('transfer.enabled')" :model-value="draft.enabled === null ? null : draft.enabled ? 1 : 0" :options="[{ label: t('transfer.on'), value: 1 }, { label: t('transfer.off'), value: 0 }]" option-label="label" option-value="value" @update:model-value="draft.enabled = $event === null ? null : $event === 1" />
              </BsField>
              <BsField for="transfer-alias" :label="t('transfer.alias')"><BsInput id="transfer-alias" v-model="draft.recipientAlias" :maxlength="4000" /></BsField>
              <BsField for="transfer-details" :label="t('transfer.details')"><BsTextarea id="transfer-details" v-model="draft.recipientDetails" :maxlength="4000" /></BsField>
              <BsField v-for="lang in (['en', 'ar'] as const)" :key="lang" :for="`transfer-instructions-${lang}`" :label="t(`transfer.instructions${lang}`)">
                <BsTextarea :id="`transfer-instructions-${lang}`" v-model="draft.instructions[lang]" :dir="lang === 'ar' ? 'rtl' : 'ltr'" :maxlength="4000" />
              </BsField>
              <BsField for="transfer-link" :label="t('transfer.link')"><BsInput id="transfer-link" v-model="draft.paymentLink" dir="ltr" :maxlength="4000" /></BsField>
              <BsField for="transfer-qr" :label="t('transfer.qrAsset')"><BsInput id="transfer-qr" v-model="draft.qr.assetUrl" dir="ltr" :maxlength="4000" /></BsField>
              <BsField v-for="lang in (['en', 'ar'] as const)" :key="`alt-${lang}`" :for="`transfer-alt-${lang}`" :label="t(`transfer.alt${lang}`)"><BsInput :id="`transfer-alt-${lang}`" v-model="draft.qr.alt[lang]" :dir="lang === 'ar' ? 'rtl' : 'ltr'" :maxlength="4000" /></BsField>
              <BsField for="transfer-reason" :label="t('transfer.reason')" required><BsTextarea id="transfer-reason" v-model="reason" required :minlength="8" :maxlength="1000" /></BsField>
            </fieldset>
          </BsRecordActionDialog>
        </div>
        <BsStateSurface v-if="selection.item?.module === 'capabilities'" state="empty" data-registry-pending :title="t('registry.pending')" />
      </BsContentSection>
      <BsButton :pending="pending" @click="signOut">{{ t('auth.signOut') }}</BsButton>
      <BsStateSurface v-if="actionError" state="error" :title="t('auth.actionError')" />
    </BsContentSection>
  </BsRouteLayout>
  <BsAuthLayout v-else :product-name="t('product.name')" :home-label="t('product.name')" :title="t('product.name')" :description="t('auth.description')">
    <template #logo="{ tone }"><BsProductLogo :name="t('product.name')" :tone="tone" /></template>
    <BsAuthForm v-if="state === 'signed-out'" :title="t('auth.signIn')" :description="t('auth.description')" :pending="pending" :error="actionError ? t('auth.signInError') : null" :submit-label="t('auth.signIn')" :pending-label="t('auth.pending')" @submit="submit">
      <BsField for="admin-email" :label="t('auth.email')" required>
        <BsInput id="admin-email" v-model="email" type="email" autocomplete="username" required />
      </BsField>
      <BsField for="admin-password" :label="t('auth.password')" required>
        <BsInput id="admin-password" v-model="password" type="password" autocomplete="current-password" required />
      </BsField>
    </BsAuthForm>
    <BsStack v-else gap="lg">
      <BsStateSurface :state="state" :title="t(`auth.${state}`)" :description="state === 'denied' ? t('auth.deniedDescription') : undefined" :action-label="state === 'loading' ? undefined : t('auth.retry')" @action="recheck" />
      <BsButton v-if="state !== 'loading'" :pending="pending" @click="signOut">{{ t('auth.signOut') }}</BsButton>
      <BsStateSurface v-if="actionError" state="error" :title="t('auth.actionError')" />
    </BsStack>
  </BsAuthLayout>
</template>
