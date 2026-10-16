<script setup lang="ts">
import type { BsWebsiteCatalogForm, BsWebsiteCatalogView } from '../types/websiteCatalogPresentation'
import type { BsWebsiteProfileForm, BsWebsiteProfileView } from '../types/websiteProfilePresentation'
import type { BsWebsiteAddressView } from '../types/websiteAddressPresentation'
import type { BsBusinessProfileForm, BsBusinessLocationForm, BsBusinessReceiptForm, BsBusinessSettingsEditor, BsBusinessLocationsView, BsBusinessCashPolicyView, BsBusinessReceiptSummary, BsBusinessSettingsCopy, BsBusinessCurrencyView } from '../types/businessSettingsPresentation'
defineProps<{
  websiteCatalogView?: BsWebsiteCatalogView
  websiteProfileView?: BsWebsiteProfileView
  websiteAddressView?: BsWebsiteAddressView
  currencyView?: BsBusinessCurrencyView
  context: { name: string } | null; loading: boolean; shopError: boolean; canManage: boolean; copy: BsBusinessSettingsCopy
  cash: BsBusinessCashPolicyView; profileEditor: BsBusinessSettingsEditor; modeEditor: BsBusinessSettingsEditor
  receiptEditor: BsBusinessSettingsEditor & { loading: boolean; loadError: boolean }; receiptSummary: BsBusinessReceiptSummary | null
  locationsView: BsBusinessLocationsView; modeOptions: { value: string; label: string; body: string }[]; modeLabel: string
}>()
const websiteCatalogForm = defineModel<BsWebsiteCatalogForm>('websiteCatalogForm', { default: () => ({ publicName: '', description: '', image: null, displayOrder: 0, showPrice: false }) })
const websiteCatalogOpen = defineModel<boolean>('websiteCatalogOpen', { default: false })
const websiteCatalogSearch = defineModel<string>('websiteCatalogSearch', { default: '' })
const websiteProfileForm = defineModel<BsWebsiteProfileForm>('websiteProfileForm', { default: () => ({ publicName: '', description: '', phone: '', whatsapp: '', email: '', openingHours: '', seoTitle: '', seoDescription: '', locations: [] }) })
const websiteProfileOpen = defineModel<boolean>('websiteProfileOpen', { default: false })
const websiteOwnerOptIn = defineModel<boolean>('websiteOwnerOptIn', { default: false })
const websiteSlug = defineModel<string>('websiteSlug', { default: '' })
const websiteOpen = defineModel<boolean>('websiteOpen', { default: false })
const profileForm = defineModel<BsBusinessProfileForm>('profileForm', { required: true })
const locationForm = defineModel<BsBusinessLocationForm>('locationForm', { required: true })
const receiptForm = defineModel<BsBusinessReceiptForm>('receiptForm', { required: true })
const selectedMode = defineModel<string>('mode', { required: true })
const businessCurrency = defineModel<string>('businessCurrency', { default: 'EGP' })
const cashRequired = defineModel<boolean>('cashRequired', { required: true })
const profileActionOpen = defineModel<boolean>('profileOpen', { required: true })
const modeActionOpen = defineModel<boolean>('modeOpen', { required: true })
const receiptActionOpen = defineModel<boolean>('receiptOpen', { required: true })
const locationDialogOpen = defineModel<boolean>('locationOpen', { required: true })
const emit = defineEmits<{
  editWebsiteCatalog: [id: string]; saveWebsiteCatalog: []; retryWebsiteCatalog: []; publishWebsiteCatalog: [id: string]; unpublishWebsiteCatalog: [id: string]; websiteCatalogPage: [page: number]; selectWebsiteCatalogImage: [file: File | File[] | null];
  editWebsiteProfile: []; saveWebsiteProfile: []; retryWebsiteProfile: []; publishWebsiteProfile: []; unpublishWebsiteProfile: []; selectWebsiteLogo: [file: File | File[] | null]; removeWebsiteLogo: [];
  editWebsiteAddress: []; saveWebsiteAddress: []; retryWebsiteAddress: [];
  saveCurrency: []; retryCurrency: [];
  editProfile: []; editMode: []; editReceipt: []; retry: []; retryCash: []; retryReceipt: []
  saveCash: []; saveProfile: []; saveMode: []; saveLocation: []; saveReceipt: []; createLocation: []
  editLocation: [id: string]; archiveLocation: [id: string]; restoreLocation: [id: string]; selectLogo: [file: File | File[] | null]
}>()
function updateProfile(key: keyof BsBusinessProfileForm, value: string | number) { profileForm.value = { ...profileForm.value, [key]: String(value) } }
function updateLocation(key: keyof BsBusinessLocationForm, value: string | number) { locationForm.value = { ...locationForm.value, [key]: String(value) } }
function updateReceipt(key: keyof BsBusinessReceiptForm, value: string | number | boolean | (string | number)[] | null) { receiptForm.value = { ...receiptForm.value, [key]: key === 'showDescriptions' ? value === true : String(value ?? '') } }
</script>
<template>
  <BsStack gap="lg" class="bs-business-settings-page">
    <BsPageHeader :title="copy.title" :subtitle="copy.subtitle"><template #actions><BsText v-if="context && !loading && !shopError" size="xs" emphasis="semibold">{{ context.name }}</BsText></template></BsPageHeader>
    <BsText v-if="loading" role="status" as="p">{{ copy.loading }}</BsText>
    <BsBox v-else-if="shopError" role="alert">{{ copy.failed }} <BsButton @click="emit('retry')">{{ copy.retry }}</BsButton>
    </BsBox>
    <BsText v-else-if="!context" role="status" as="p">{{ copy.empty }}</BsText>
    <BsSectionNavigation v-if="context && !loading && !shopError" :label="copy.title" :sections="[{ id: 'shop-profile', label: copy.profileTitle }, { id: 'business-mode', label: copy.modeTitle }, { id: 'locations', label: copy.locationsTitle }, { id: 'receipt-settings', label: copy.receiptTitle }, { id: 'cash-policy', label: copy.cashTitle }, ...(websiteCatalogView ? [{ id: 'website-catalog', label: websiteCatalogView.title }] : []), ...(websiteProfileView ? [{ id: 'website-profile', label: websiteProfileView.title }] : []), ...(websiteAddressView ? [{ id: 'website-address', label: websiteAddressView.title }] : []), ...(currencyView ? [{ id: 'currency-settings', label: currencyView.title }] : [])]" />
    <BsGrid v-if="context && !loading && !shopError" :columns="2" gap="lg">
    <BsWebsiteCatalogSettings v-if="websiteCatalogView" v-model:form="websiteCatalogForm" v-model:open="websiteCatalogOpen" v-model:search="websiteCatalogSearch" :view="websiteCatalogView" @edit="emit('editWebsiteCatalog',$event)" @save="emit('saveWebsiteCatalog')" @retry="emit('retryWebsiteCatalog')" @publish="emit('publishWebsiteCatalog',$event)" @unpublish="emit('unpublishWebsiteCatalog',$event)" @page="emit('websiteCatalogPage',$event)" @select-image="emit('selectWebsiteCatalogImage',$event)" />
    <BsWebsiteProfileSettings v-if="websiteProfileView" v-model:form="websiteProfileForm" v-model:open="websiteProfileOpen" v-model:opt-in="websiteOwnerOptIn" :view="websiteProfileView" @edit="emit('editWebsiteProfile')" @save="emit('saveWebsiteProfile')" @retry="emit('retryWebsiteProfile')" @publish="emit('publishWebsiteProfile')" @unpublish="emit('unpublishWebsiteProfile')" @select-logo="emit('selectWebsiteLogo', $event)" @remove-logo="emit('removeWebsiteLogo')" />
    <BsWebsiteAddressSettings v-if="websiteAddressView" v-model="websiteSlug" v-model:open="websiteOpen" :view="websiteAddressView" @edit="emit('editWebsiteAddress')" @save="emit('saveWebsiteAddress')" @retry="emit('retryWebsiteAddress')" />
    <BsPanel v-if="currencyView" id="currency-settings" aria-labelledby="business-currency-title" padding="md">
      <BsHeading id="business-currency-title" :level="2">{{ currencyView.title }}</BsHeading>
      <BsText as="p" size="sm" tone="muted">{{ currencyView.help }}</BsText>
      <BsText v-if="currencyView.loading" role="status">{{ copy.loading }}</BsText>
      <BsAlert v-else-if="currencyView.loadError" tone="error">{{ currencyView.failed }} <BsButton @click="emit('retryCurrency')">{{ currencyView.retry }}</BsButton></BsAlert>
      <BsForm v-else :pending="currencyView.pending" :error="currencyView.error" @submit="emit('saveCurrency')">
        <BsText v-if="currencyView.locked" role="status">{{ currencyView.lockedHelp }}</BsText>
        <BsText v-if="!canManage" role="status">{{ copy.ownerOnly }}</BsText>
        <BsField v-slot="field" :label="currencyView.title"><BsSelect v-model="businessCurrency" :input-id="field.id" :label="currencyView.title" :aria-describedby="field.describedby" :options="currencyView.options" option-label="label" option-value="value" :disabled="currencyView.locked || !canManage || currencyView.pending" /></BsField>
        <BsText v-if="currencyView.success" role="status">{{ currencyView.success }}</BsText>
        <BsButton variant="primary" type="submit" :pending="currencyView.pending" :disabled="currencyView.locked || !canManage || businessCurrency === currencyView.code">{{ currencyView.save }}</BsButton>
      </BsForm>
    </BsPanel>
    <BsPanel v-if="context && !loading && !shopError" id="shop-profile" aria-labelledby="shop-profile-title" padding="md">
      <BsHeading id="shop-profile-title" :level="2">{{ copy.profileTitle }}</BsHeading>
      <BsText as="p" size="sm" tone="muted">{{ copy.profileHelp }}</BsText>
      <BsText v-if="!canManage" role="status" as="p" size="sm" tone="warning">{{ copy.profileOwnerOnly }}</BsText>
      <BsText v-if="profileEditor.success" role="status" as="p" size="sm">{{ profileEditor.success }}</BsText>
      <BsStack>
        <BsText emphasis="semibold">{{ context?.name }}</BsText>
        <BsButton variant="secondary" :disabled="!canManage || profileEditor.pending" @click="emit('editProfile')">{{ copy.editProfile || copy.saveProfile }}</BsButton>
        <BsRecordActionDialog v-model:visible="profileActionOpen" :title="copy.profileTitle" :dirty="profileEditor.dirty" :pending="profileEditor.pending" :error="profileEditor.error" :submit-label="copy.saveProfile" :cancel-label="copy.cancelEdit" :submit-disabled="profileEditor.submitDisabled" @submit="emit('saveProfile')">
          <BsField v-slot="field" :label="(copy.shopDisplayName) + ' '">
            <BsInput :id="field.id" :model-value="profileForm.displayName" :aria-describedby="field.describedby" autocomplete="organization" required :minlength="2" :maxlength="120" :disabled="!canManage" @update:model-value="updateProfile('displayName', $event)"/>
          </BsField>
          <BsBox padding="md">
            <BsText as="p">{{ copy.profileLocationHelp }}</BsText>
            <BsLink to="#locations" external>{{ copy.manageLocations }}</BsLink>
          </BsBox>
        </BsRecordActionDialog>
      </BsStack>
    </BsPanel>
    <BsPanel v-if="context && !loading && !shopError" id="business-mode" padding="md">
      <BsHeading :level="2">{{ copy.modeTitle }}</BsHeading>
      <BsText as="p" size="sm" tone="muted">{{ copy.modeHelp }}</BsText>
      <BsText v-if="!canManage" role="status" as="p" size="sm" tone="warning">{{ copy.ownerOnly }}</BsText>
      <BsText as="p" size="sm">{{ copy.preserve }}</BsText>
      <BsText v-if="modeEditor.success" role="status" as="p" size="sm">{{ modeEditor.success }}</BsText>
      <BsStack>
        <BsText>{{ modeLabel }}</BsText>
        <BsButton variant="secondary" :disabled="!canManage || modeEditor.pending" @click="emit('editMode')">{{ copy.editMode || copy.save }}</BsButton>
        <BsRecordActionDialog v-model:visible="modeActionOpen" :title="copy.modeTitle" :dirty="modeEditor.dirty" :pending="modeEditor.pending" :error="modeEditor.error" :submit-label="copy.save" :cancel-label="copy.cancelEdit" :submit-disabled="modeEditor.submitDisabled" @submit="emit('saveMode')">
          <BsChoiceGroup v-model="selectedMode" type="radio" :legend="copy.modeTitle" :options="modeOptions.map(mode => ({ value: mode.value, label: mode.label, description: mode.body }))" :disabled="!canManage || modeEditor.pending" />
        </BsRecordActionDialog>
      </BsStack>
    </BsPanel>
    </BsGrid>
    <BsPanel v-if="context && !loading && !shopError" id="locations" padding="md">
      <BsHeading :level="2">{{ copy.locationsTitle }}</BsHeading>
      <BsText as="p" size="sm" tone="muted">{{ copy.locationsHelp }}</BsText>
      <BsText v-if="locationsView.usageLabel" as="p" size="sm" tone="muted" emphasis="semibold">{{ locationsView.usageLabel }}</BsText>
      <BsBox v-if="locationsView.capacityNotice" role="status" padding="md">
        <BsText as="p">{{ copy.locationLimit }}</BsText>
        <BsLink to="/billing">{{ copy.upgradePlan }}</BsLink>
      </BsBox>
      <BsDataTable :value="locationsView.rows" data-key="id" :label="copy.locationsTitle" :capabilities="{ insert: locationsView.canCreate, edit: canManage, archive: canManage }" :action-labels="{ insert: copy.addLocation, edit: copy.editLocation, archive: copy.archiveLocation }" :can-row-action="(action, location) => action !== 'archive' || location.canArchive" :row-action-pending="locationsView.pending" :columns="[{ key: 'name', header: copy.locationName, field: 'name' }, { key: 'column1', header: copy.locationCode }, { key: 'column2', header: copy.defaultLocation }]" @create="emit('createLocation')" @edit="emit('editLocation', $event.id)" @archive="emit('archiveLocation', $event.id)">
        <template #cell-column1="{ row: location }">{{ location.summary }}</template>
        <template #cell-column2="{ row: location }">
          <BsStatusBadge v-if="location.badge === 'default'" status="default" :label="copy.defaultLocation" tone="neutral"/>
          <BsStatusBadge v-else-if="location.badge === 'archived'" status="archived" :label="copy.archivedLocation" tone="neutral"/>
        </template>
        <template #row-actions="{ row: location }">
          <BsButton v-if="location.canRestore" variant="link" :disabled="locationsView.restoreDisabled" @click="emit('restoreLocation', location.id)">{{ copy.restoreLocation }}</BsButton>
        </template>
      </BsDataTable>
      <BsRecordActionDialog v-model:visible="locationDialogOpen" :title="locationsView.editing ? copy.editLocation : copy.addLocation" :dirty="locationsView.dirty" :pending="locationsView.pending" :error="locationsView.error" :submit-label="locationsView.editing ? copy.saveLocation : copy.addLocation" :cancel-label="copy.cancelEdit" @submit="emit('saveLocation')">
        <BsField v-slot="field" :label="copy.locationName">
          <BsInput :id="field.id" :model-value="locationForm.name" :aria-describedby="field.describedby" required :minlength="2" :maxlength="120" @update:model-value="updateLocation('name', $event)"/>
        </BsField>
        <BsField v-slot="field" :label="copy.locationCode">
          <BsInput :id="field.id" :model-value="locationForm.code" :aria-describedby="field.describedby" :maxlength="32" @update:model-value="updateLocation('code', $event)"/>
        </BsField>
        <BsField v-slot="field" :label="copy.locationAddress">
          <BsInput :id="field.id" :model-value="locationForm.address" :aria-describedby="field.describedby" @update:model-value="updateLocation('address', $event)"/>
        </BsField>
        <BsField v-slot="field" :label="copy.locationPhone">
          <BsInput :id="field.id" :model-value="locationForm.phone" :aria-describedby="field.describedby" @update:model-value="updateLocation('phone', $event)"/>
        </BsField>
      </BsRecordActionDialog>
    </BsPanel>
    <BsGrid v-if="context && !loading && !shopError" :columns="2" gap="lg">
    <BsPanel v-if="context && !loading && !shopError" id="receipt-settings" aria-labelledby="receipt-settings-title" padding="md">
      <BsHeading id="receipt-settings-title" :level="2">{{ copy.receiptTitle }}</BsHeading>
      <BsText as="p" size="sm" tone="muted">{{ copy.receiptHelp }}</BsText>
      <BsText v-if="receiptEditor.loading" role="status" as="p">{{ copy.loading }}</BsText>
      <BsText v-else-if="receiptEditor.loadError" role="alert" as="p" size="sm" tone="danger">{{ copy.receiptFailed }} <BsButton variant="link" type="button" @click="emit('retryReceipt')">{{ copy.retry }}</BsButton>
      </BsText>
      <template v-else-if="receiptSummary">
        <BsText v-if="!canManage" role="status" as="p" size="sm" tone="warning">{{ copy.receiptOwnerOnly }}</BsText>
        <BsText v-if="receiptEditor.success" role="status" as="p" size="sm">{{ receiptEditor.success }}</BsText>
        <BsStack>
          <BsDescriptionList density="compact">
            <BsDescriptionItem :term="copy.receiptDisplayName">{{ receiptSummary.displayName }}</BsDescriptionItem>
            <BsDescriptionItem :term="copy.receiptAddress">{{ receiptSummary.address || '—' }}</BsDescriptionItem>
            <BsDescriptionItem :term="copy.receiptPhone">{{ receiptSummary.phone || '—' }}</BsDescriptionItem>
            <BsDescriptionItem :term="copy.receiptFooter">{{ receiptSummary.footer || '—' }}</BsDescriptionItem>
            <BsDescriptionItem :term="copy.receiptPaper">{{ receiptSummary.paperLabel }}</BsDescriptionItem>
          </BsDescriptionList>
          <BsButton variant="secondary" :disabled="!canManage || receiptEditor.pending" @click="emit('editReceipt')">{{ copy.editReceipt || copy.saveReceipt }}</BsButton>
          <BsRecordActionDialog v-model:visible="receiptActionOpen" :title="copy.receiptTitle" :dirty="receiptEditor.dirty" :pending="receiptEditor.pending" :error="receiptEditor.error" :submit-label="copy.saveReceipt" :cancel-label="copy.cancelEdit" :submit-disabled="receiptEditor.submitDisabled" @submit="emit('saveReceipt')">
            <BsField v-slot="field" :label="copy.receiptDisplayName">
              <BsInput :id="field.id" :model-value="receiptForm.displayName" :aria-describedby="field.describedby" required :minlength="2" :maxlength="160" :disabled="!canManage" @update:model-value="updateReceipt('displayName', $event)"/>
            </BsField>
            <BsField v-slot="field" :label="copy.receiptAddress">
              <BsInput :id="field.id" :model-value="receiptForm.address" :aria-describedby="field.describedby" :maxlength="500" :disabled="!canManage" @update:model-value="updateReceipt('address', $event)"/>
            </BsField>
            <BsField v-slot="field" :label="copy.receiptPhone">
              <BsInput :id="field.id" :model-value="receiptForm.phone" :aria-describedby="field.describedby" :maxlength="80" dir="auto" :disabled="!canManage" @update:model-value="updateReceipt('phone', $event)"/>
            </BsField>
            <BsField v-slot="field" :label="copy.receiptFooter">
              <BsTextarea :id="field.id" :model-value="receiptForm.footer" :aria-describedby="field.describedby" :rows="3" :maxlength="500" :disabled="!canManage" @update:model-value="updateReceipt('footer', $event)"/>
            </BsField>
            <BsField v-if="copy.documentLabel" v-slot="field" :label="copy.documentLabel"><BsInput :id="field.id" :model-value="receiptForm.documentLabel || ''" :maxlength="80" :disabled="!canManage" @update:model-value="updateReceipt('documentLabel', $event)" /></BsField>
            <BsField v-if="copy.referenceLabel" v-slot="field" :label="copy.referenceLabel"><BsInput :id="field.id" :model-value="receiptForm.referenceLabel || ''" :maxlength="80" :disabled="!canManage" @update:model-value="updateReceipt('referenceLabel', $event)" /></BsField>
            <BsField v-if="copy.documentLanguage" v-slot="field" :label="copy.documentLanguage"><BsSelect :input-id="field.id" :model-value="receiptForm.documentLanguage" :label="copy.documentLanguage" :aria-describedby="field.describedby" :options="[{ value: 'ar', label: 'العربية' }, { value: 'en', label: 'English' }]" option-value="value" option-label="label" :disabled="!canManage" @update:model-value="updateReceipt('documentLanguage', $event)" /></BsField>
            <BsField v-if="copy.documentDirection" v-slot="field" :label="copy.documentDirection"><BsSelect :input-id="field.id" :model-value="receiptForm.documentDirection" :label="copy.documentDirection" :aria-describedby="field.describedby" :options="[{ value: 'auto', label: copy.autoDirection || 'Auto' }, { value: 'rtl', label: 'RTL' }, { value: 'ltr', label: 'LTR' }]" option-value="value" option-label="label" :disabled="!canManage" @update:model-value="updateReceipt('documentDirection', $event)" /></BsField>
            <BsCheckbox v-if="copy.showDescriptions" :model-value="receiptForm.showDescriptions ?? true" :label="copy.showDescriptions" :disabled="!canManage" @update:model-value="updateReceipt('showDescriptions', $event)" />
            <BsField v-if="copy.documentNotes" v-slot="field" :label="copy.documentNotes"><BsTextarea :id="field.id" :model-value="receiptForm.notes || ''" :maxlength="1000" :disabled="!canManage" @update:model-value="updateReceipt('notes', $event)" /></BsField>
            <BsField v-if="copy.documentLogo" v-slot="field" :label="copy.documentLogo" :hint="copy.logoHelp">
              <BsImage v-if="receiptForm.logoDataUrl" :src="receiptForm.logoDataUrl" :alt="receiptForm.displayName" :width="96" :height="96" fit="contain" />
              <BsFileInput :input-id="field.id" accept="image/png,image/jpeg" :describedby="field.describedby" :disabled="!canManage || receiptEditor.pending" :reset-after-select="true" :label="copy.documentLogo" @select="emit('selectLogo', $event)" />
              <BsButton v-if="receiptForm.logoDataUrl" variant="secondary" :disabled="!canManage || receiptEditor.pending" @click="updateReceipt('logoDataUrl', '')">{{ copy.removeLogo }}</BsButton>
            </BsField>
            <BsFieldGroup :disabled="!canManage || receiptEditor.pending" :legend="(copy.receiptPaper)">
              <BsGrid :columns="2">
                <BsRadio v-for="size in ['thermal_80', 'a4'] as const" :key="size" :model-value="receiptForm.paperSize" name="receipt-paper" :value="size" :label="(size === 'thermal_80' ? copy.thermal80 : copy.a4)" @update:model-value="updateReceipt('paperSize', $event)" />
              </BsGrid>
            </BsFieldGroup>
          </BsRecordActionDialog>
        </BsStack>
      </template>
    </BsPanel>
    <BsContentSection v-if="context && !loading && !shopError" id="cash-policy" :title="copy.cashTitle" :aria-label="copy.cashTitle">
      <BsText id="cash-policy-help">{{ copy.cashHelp }}</BsText>
      <BsText v-if="cash.loading" role="status">{{ copy.loading }}</BsText>
      <BsText v-else-if="cash.loadError" role="alert">{{ copy.failed }} <BsButton @click="emit('retryCash')">{{ copy.retry }}</BsButton></BsText>
      <BsForm v-else :pending="cash.pending" :error="cash.error" @submit="emit('saveCash')">
        <BsCheckbox v-model="cashRequired" :label="copy.cashRequired" aria-describedby="cash-policy-help" :disabled="cash.disabled" />
        <BsText v-if="!canManage" role="status">{{ copy.ownerOnly }}</BsText>
        <BsText v-if="cash.success" role="status">{{ cash.success }}</BsText>
        <BsButton v-if="canManage" variant="primary" type="submit" :pending="cash.pending" :disabled="cash.submitDisabled">{{ copy.cashSave }}</BsButton>
      </BsForm>
    </BsContentSection>
    </BsGrid>
  </BsStack>
</template>

<style scoped>
.bs-business-settings-page :deep(section[id]) { scroll-margin-block-start: 6rem; }
.bs-business-settings-page :deep(.bs-panel), .bs-business-settings-page :deep(.ls-content-section) { min-inline-size: 0; box-shadow: none; }
.bs-business-settings-page :deep(.bs-panel > .bs-stack) { margin-block-start: 1rem; }
</style>
