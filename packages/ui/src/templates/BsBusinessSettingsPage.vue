<script setup lang="ts">
import type {BsBookingPolicyForm,BsBookingPolicyView} from '../types/appointmentBookingPresentation'
import type { BsWebsiteInquiryInboxView } from '../types/websiteInquiriesPresentation'
import type { BsWebsiteCatalogForm, BsWebsiteCatalogView } from '../types/websiteCatalogPresentation'
import type { BsWebsiteProfileForm, BsWebsiteProfileView } from '../types/websiteProfilePresentation'
import type { BsWebsiteAddressView } from '../types/websiteAddressPresentation'
import type { BsBusinessProfileForm, BsBusinessLocationForm, BsBusinessReceiptForm, BsBusinessSettingsEditor, BsBusinessLocationsView, BsBusinessCashPolicyView, BsBusinessReceiptSummary, BsBusinessSettingsCopy, BsBusinessCurrencyView, BsBusinessSettingsSection } from '../types/businessSettingsPresentation'
const props = defineProps<{
  section?: BsBusinessSettingsSection
  bookingPolicyView?:BsBookingPolicyView
  websiteInquiryView?: BsWebsiteInquiryInboxView
  websiteCatalogView?: BsWebsiteCatalogView
  websiteProfileView?: BsWebsiteProfileView
  websiteAddressView?: BsWebsiteAddressView
  currencyView?: BsBusinessCurrencyView
  context: { name: string } | null; loading: boolean; shopError: boolean; canManage: boolean; copy: BsBusinessSettingsCopy
  cash: BsBusinessCashPolicyView; profileEditor: BsBusinessSettingsEditor; modeEditor: BsBusinessSettingsEditor
  receiptEditor: BsBusinessSettingsEditor & { loading: boolean; loadError: boolean }; receiptSummary: BsBusinessReceiptSummary | null
  locationsView: BsBusinessLocationsView; modeOptions: { value: string; label: string; body: string }[]
}>()
const bookingPolicyForm=defineModel<BsBookingPolicyForm>('bookingPolicyForm',{default:()=>({enabled:false,lead_minutes:60,horizon_days:30,change_notice_minutes:120,allow_reschedule:true,allow_cancel:true,reminder_lead_minutes:1440,staff:[]})})
const bookingPolicyOpen=defineModel<boolean>('bookingPolicyOpen',{default:false})
const websiteInquiryOpen = defineModel<boolean>('websiteInquiryOpen', { default: false })
const websiteInquiryStatus = defineModel<string>('websiteInquiryStatus', { default: 'new' })
const websiteInquiryFilter = defineModel<string>('websiteInquiryFilter', { default: 'all' })
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
const emit = defineEmits<{
  editBookingPolicy:[];saveBookingPolicy:[];retryBookingPolicy:[];
  editWebsiteInquiry: [id: string]; saveWebsiteInquiry: []; retryWebsiteInquiries: []; websiteInquiryPage: [page: number];
  editWebsiteCatalog: [id: string]; saveWebsiteCatalog: []; retryWebsiteCatalog: []; publishWebsiteCatalog: [id: string]; unpublishWebsiteCatalog: [id: string]; websiteCatalogPage: [page: number]; selectWebsiteCatalogImage: [file: File | File[] | null];
  editWebsiteProfile: []; saveWebsiteProfile: []; retryWebsiteProfile: []; publishWebsiteProfile: []; unpublishWebsiteProfile: []; selectWebsiteLogo: [file: File | File[] | null]; removeWebsiteLogo: [];
  editWebsiteAddress: []; saveWebsiteAddress: []; retryWebsiteAddress: [];
  saveCurrency: []; retryCurrency: [];
  retry: []; retryCash: []; retryReceipt: []
  cancelProfile: []; cancelMode: []; cancelReceipt: []; cancelLocation: []; cancelCash: []; cancelCurrency: []
  saveCash: []; saveProfile: []; saveMode: []; saveLocation: []; saveReceipt: []
  editLocation: [id: string]; archiveLocation: [id: string]; restoreLocation: [id: string]; selectLogo: [file: File | File[] | null]
}>()
const sectionHeading = computed(() => {
  switch (props.section) {
    case 'shop-profile': return { title: props.copy.profileTitle, subtitle: props.copy.profileHelp }
    case 'business-mode': return { title: props.copy.modeTitle, subtitle: props.copy.modeHelp }
    case 'locations': return { title: props.copy.locationsTitle, subtitle: props.copy.locationsHelp }
    case 'receipt-settings': return { title: props.copy.receiptTitle, subtitle: props.copy.receiptHelp }
    case 'cash-policy': return { title: props.copy.cashTitle, subtitle: props.copy.cashHelp }
    case 'public-booking-settings': return { title: props.bookingPolicyView?.title, subtitle: props.bookingPolicyView?.help }
    case 'website-inquiries': return { title: props.websiteInquiryView?.title, subtitle: props.websiteInquiryView?.help }
    case 'website-catalog': return { title: props.websiteCatalogView?.title, subtitle: props.websiteCatalogView?.help }
    case 'website-profile': return { title: props.websiteProfileView?.title, subtitle: props.websiteProfileView?.help }
    case 'website-address': return { title: props.websiteAddressView?.title, subtitle: props.websiteAddressView?.help }
    case 'currency-settings': return { title: props.currencyView?.title, subtitle: props.currencyView?.help }
    default: return { title: props.copy.title, subtitle: props.copy.subtitle }
  }
})
function shows(section: BsBusinessSettingsSection) { return !props.section || props.section === section }
function updateProfile(key: keyof BsBusinessProfileForm, value: string | number) { profileForm.value = { ...profileForm.value, [key]: String(value) } }
function updateLocation(key: keyof BsBusinessLocationForm, value: string | number) { locationForm.value = { ...locationForm.value, [key]: String(value) } }
function updateReceipt(key: keyof BsBusinessReceiptForm, value: string | number | boolean | (string | number)[] | null) { receiptForm.value = { ...receiptForm.value, [key]: key === 'showDescriptions' ? value === true : String(value ?? '') } }
const locationNameControl = ref<unknown>(null)
const locationFocus = useControlFocus(ref<HTMLElement | null>(null), locationNameControl)
watch(() => props.locationsView.editingId, async () => {
  if (!shows('locations')) return
  await nextTick()
  locationFocus.focus()
})
</script>
<template>
  <BsStack gap="lg" class="bs-business-settings-page">
    <BsPageHeader :title="sectionHeading.title || copy.title" :subtitle="sectionHeading.subtitle"><template #actions><BsText v-if="context && !loading && !shopError" size="xs" emphasis="semibold">{{ context.name }}</BsText></template></BsPageHeader>
    <BsText v-if="loading" role="status" as="p">{{ copy.loading }}</BsText>
    <BsBox v-else-if="shopError" role="alert">{{ copy.failed }} <BsButton @click="emit('retry')">{{ copy.retry }}</BsButton>
    </BsBox>
    <BsText v-else-if="!context" role="status" as="p">{{ copy.empty }}</BsText>
    <BsGrid v-if="context && !loading && !shopError && (!section || !['locations', 'receipt-settings', 'cash-policy'].includes(section))" :columns="section ? 1 : 2" gap="lg">
    <BsBookingPolicySettings v-if="bookingPolicyView && shows('public-booking-settings')" v-model:form="bookingPolicyForm" v-model:open="bookingPolicyOpen" :view="bookingPolicyView" @edit="emit('editBookingPolicy')" @save="emit('saveBookingPolicy')" @retry="emit('retryBookingPolicy')" />
    <BsWebsiteInquiryInbox v-if="websiteInquiryView && shows('website-inquiries')" v-model:open="websiteInquiryOpen" v-model:status="websiteInquiryStatus" v-model:filter="websiteInquiryFilter" :view="websiteInquiryView" @edit="emit('editWebsiteInquiry',$event)" @save="emit('saveWebsiteInquiry')" @retry="emit('retryWebsiteInquiries')" @page="emit('websiteInquiryPage',$event)" />
    <BsWebsiteCatalogSettings v-if="websiteCatalogView && shows('website-catalog')" v-model:form="websiteCatalogForm" v-model:open="websiteCatalogOpen" v-model:search="websiteCatalogSearch" :view="websiteCatalogView" @edit="emit('editWebsiteCatalog',$event)" @save="emit('saveWebsiteCatalog')" @retry="emit('retryWebsiteCatalog')" @publish="emit('publishWebsiteCatalog',$event)" @unpublish="emit('unpublishWebsiteCatalog',$event)" @page="emit('websiteCatalogPage',$event)" @select-image="emit('selectWebsiteCatalogImage',$event)" />
    <BsWebsiteProfileSettings v-if="websiteProfileView && shows('website-profile')" v-model:form="websiteProfileForm" v-model:open="websiteProfileOpen" v-model:opt-in="websiteOwnerOptIn" :view="websiteProfileView" @edit="emit('editWebsiteProfile')" @save="emit('saveWebsiteProfile')" @retry="emit('retryWebsiteProfile')" @publish="emit('publishWebsiteProfile')" @unpublish="emit('unpublishWebsiteProfile')" @select-logo="emit('selectWebsiteLogo', $event)" @remove-logo="emit('removeWebsiteLogo')" />
    <BsWebsiteAddressSettings v-if="websiteAddressView && shows('website-address')" v-model="websiteSlug" v-model:open="websiteOpen" :view="websiteAddressView" @edit="emit('editWebsiteAddress')" @save="emit('saveWebsiteAddress')" @retry="emit('retryWebsiteAddress')" />
    <BsBox v-if="currencyView && shows('currency-settings')" id="currency-settings" as="section" :aria-label="currencyView.title">
      <BsHeading v-if="!section" id="business-currency-title" :level="2">{{ currencyView.title }}</BsHeading>
      <BsText v-if="!section" as="p" size="sm" tone="muted">{{ currencyView.help }}</BsText>
      <BsText v-if="currencyView.loading" role="status">{{ copy.loading }}</BsText>
      <BsAlert v-else-if="currencyView.loadError" tone="error">{{ currencyView.failed }} <BsButton @click="emit('retryCurrency')">{{ currencyView.retry }}</BsButton></BsAlert>
      <BsSettingsForm v-else :pending="currencyView.pending" :error="currencyView.error" :success="currencyView.success" :dirty="currencyView.dirty" :disabled="currencyView.locked || !canManage" :submit-label="currencyView.save" :cancel-label="copy.cancelEdit" :submit-disabled="businessCurrency === currencyView.code" @submit="emit('saveCurrency')" @cancel="emit('cancelCurrency')">
        <BsText v-if="currencyView.locked" role="status">{{ currencyView.lockedHelp }}</BsText>
        <BsText v-if="!canManage" role="status">{{ copy.ownerOnly }}</BsText>
        <BsField v-slot="field" :label="currencyView.title"><BsSelect v-model="businessCurrency" :input-id="field.id" :label="currencyView.title" :aria-describedby="field.describedby" :options="currencyView.options" option-label="label" option-value="value" :disabled="currencyView.locked || !canManage || currencyView.pending" /></BsField>
      </BsSettingsForm>
    </BsBox>
    <BsBox v-if="context && !loading && !shopError && shows('shop-profile')" id="shop-profile" as="section">
      <BsHeading v-if="!section" :level="2">{{ copy.profileTitle }}</BsHeading>
      <BsText v-if="!section" as="p" size="sm" tone="muted">{{ copy.profileHelp }}</BsText>
      <BsText v-if="!canManage" role="status" as="p" size="sm" tone="warning">{{ copy.profileOwnerOnly }}</BsText>
      <BsSettingsForm :pending="profileEditor.pending" :disabled="!canManage" :error="profileEditor.error" :success="profileEditor.success" :dirty="profileEditor.dirty" :submit-label="copy.saveProfile" :cancel-label="copy.cancelEdit" :submit-disabled="profileEditor.submitDisabled" @submit="emit('saveProfile')" @cancel="emit('cancelProfile')">
        <BsField v-slot="field" :label="copy.shopDisplayName" required>
          <BsInput :id="field.id" :model-value="profileForm.displayName" :aria-describedby="field.describedby" autocomplete="organization" required :minlength="2" :maxlength="120" @update:model-value="updateProfile('displayName', $event)" />
        </BsField>
        <BsStack gap="sm">
          <BsText as="p" size="sm" tone="muted">{{ copy.profileLocationHelp }}</BsText>
          <BsLink to="/settings/locations">{{ copy.manageLocations }}</BsLink>
        </BsStack>
      </BsSettingsForm>
    </BsBox>
    <BsBox v-if="context && !loading && !shopError && shows('business-mode')" id="business-mode" as="section">
      <BsHeading v-if="!section" :level="2">{{ copy.modeTitle }}</BsHeading>
      <BsText v-if="!section" as="p" size="sm" tone="muted">{{ copy.modeHelp }}</BsText>
      <BsText v-if="!canManage" role="status" as="p" size="sm" tone="warning">{{ copy.ownerOnly }}</BsText>
      <BsSettingsForm :pending="modeEditor.pending" :disabled="!canManage" :error="modeEditor.error" :success="modeEditor.success" :dirty="modeEditor.dirty" :submit-label="copy.save" :cancel-label="copy.cancelEdit" :submit-disabled="modeEditor.submitDisabled" @submit="emit('saveMode')" @cancel="emit('cancelMode')">
        <BsChoiceGroup v-model="selectedMode" type="radio" :legend="copy.modeTitle" :options="modeOptions.map(mode => ({ value: mode.value, label: mode.label, description: mode.body }))" :disabled="!canManage || modeEditor.pending" />
        <BsText as="p" size="sm" tone="muted">{{ copy.preserve }}</BsText>
      </BsSettingsForm>
    </BsBox>
    </BsGrid>
    <BsBox v-if="context && !loading && !shopError && shows('locations')" id="locations" as="section">
      <BsHeading v-if="!section" :level="2">{{ copy.locationsTitle }}</BsHeading>
      <BsText v-if="!section" as="p" size="sm" tone="muted">{{ copy.locationsHelp }}</BsText>
      <BsText v-if="locationsView.usageLabel" as="p" size="sm" tone="muted" emphasis="semibold">{{ locationsView.usageLabel }}</BsText>
      <BsBox v-if="locationsView.capacityNotice" role="status" padding="md">
        <BsText as="p">{{ copy.locationLimit }}</BsText>
        <BsLink to="/billing">{{ copy.upgradePlan }}</BsLink>
      </BsBox>
      <BsDataTable :value="locationsView.rows" data-key="id" :label="copy.locationsTitle" :capabilities="{ edit: canManage, archive: canManage }" :action-labels="{ insert: copy.addLocation, edit: copy.editLocation, archive: copy.archiveLocation }" :can-row-action="(action, location) => action !== 'archive' || location.canArchive" :row-action-pending="locationsView.pending" :columns="[{ key: 'name', header: copy.locationName, field: 'name' }, { key: 'column1', header: copy.locationCode }, { key: 'column2', header: copy.defaultLocation }]" @edit="emit('editLocation', $event.id)" @archive="emit('archiveLocation', $event.id)">
        <template #cell-column1="{ row: location }">{{ location.summary }}</template>
        <template #cell-column2="{ row: location }">
          <BsStatusBadge v-if="location.badge === 'default'" status="default" :label="copy.defaultLocation" tone="neutral"/>
          <BsStatusBadge v-else-if="location.badge === 'archived'" status="archived" :label="copy.archivedLocation" tone="neutral"/>
        </template>
        <template #row-actions="{ row: location }">
          <BsButton v-if="location.canRestore" variant="link" :disabled="locationsView.restoreDisabled" @click="emit('restoreLocation', location.id)">{{ copy.restoreLocation }}</BsButton>
        </template>
      </BsDataTable>
      <BsStack gap="md" class="bs-business-settings-location-editor">
        <BsHeading :level="2">{{ locationsView.editing ? copy.editLocation : copy.addLocation }}</BsHeading>
        <BsText v-if="!canManage" role="status" size="sm" tone="warning">{{ copy.ownerOnly }}</BsText>
        <BsSettingsForm :pending="locationsView.pending" :disabled="!canManage || (!locationsView.editing && !locationsView.canCreate)" :error="locationsView.error" :dirty="locationsView.dirty" :allow-pristine-cancel="locationsView.editing" :submit-label="locationsView.editing ? copy.saveLocation : copy.addLocation" :cancel-label="copy.cancelEdit" :submit-disabled="locationForm.name.trim().length < 2" @submit="emit('saveLocation')" @cancel="emit('cancelLocation')">
          <BsGrid :columns="2">
            <BsField v-slot="field" :label="copy.locationName" required>
              <BsInput :id="field.id" ref="locationNameControl" :model-value="locationForm.name" :aria-describedby="field.describedby" required :minlength="2" :maxlength="120" @update:model-value="updateLocation('name', $event)"/>
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
          </BsGrid>
        </BsSettingsForm>
      </BsStack>
    </BsBox>
    <BsGrid v-if="context && !loading && !shopError && (!section || section === 'receipt-settings' || section === 'cash-policy')" :columns="section ? 1 : 2" gap="lg">
    <BsBox v-if="context && !loading && !shopError && shows('receipt-settings')" id="receipt-settings" as="section">
      <BsHeading v-if="!section" id="receipt-settings-title" :level="2">{{ copy.receiptTitle }}</BsHeading>
      <BsText v-if="!section" as="p" size="sm" tone="muted">{{ copy.receiptHelp }}</BsText>
      <BsText v-if="receiptEditor.loading" role="status" as="p">{{ copy.loading }}</BsText>
      <BsText v-else-if="receiptEditor.loadError" role="alert" as="p" size="sm" tone="danger">{{ copy.receiptFailed }} <BsButton variant="link" type="button" @click="emit('retryReceipt')">{{ copy.retry }}</BsButton>
      </BsText>
      <template v-else-if="receiptSummary">
        <BsText v-if="!canManage" role="status" as="p" size="sm" tone="warning">{{ copy.receiptOwnerOnly }}</BsText>
        <BsSettingsForm :pending="receiptEditor.pending" :disabled="!canManage" :error="receiptEditor.error" :success="receiptEditor.success" :dirty="receiptEditor.dirty" :submit-label="copy.saveReceipt" :cancel-label="copy.cancelEdit" :submit-disabled="receiptEditor.submitDisabled" @submit="emit('saveReceipt')" @cancel="emit('cancelReceipt')">
          <BsField v-slot="field" :label="copy.receiptDisplayName" required>
            <BsInput :id="field.id" :model-value="receiptForm.displayName" :aria-describedby="field.describedby" required :minlength="2" :maxlength="160" :disabled="!canManage" @update:model-value="updateReceipt('displayName', $event)"/>
          </BsField>
          <BsGrid :columns="2" align="start">
            <BsField v-slot="field" :label="copy.receiptAddress">
              <BsInput :id="field.id" :model-value="receiptForm.address" :aria-describedby="field.describedby" :maxlength="500" :disabled="!canManage" @update:model-value="updateReceipt('address', $event)"/>
            </BsField>
            <BsField v-slot="field" :label="copy.receiptPhone">
              <BsInput :id="field.id" :model-value="receiptForm.phone" :aria-describedby="field.describedby" :maxlength="80" dir="auto" :disabled="!canManage" @update:model-value="updateReceipt('phone', $event)"/>
            </BsField>
          </BsGrid>
          <BsField v-slot="field" :label="copy.receiptFooter">
            <BsTextarea :id="field.id" :model-value="receiptForm.footer" :aria-describedby="field.describedby" :rows="3" :maxlength="500" :disabled="!canManage" @update:model-value="updateReceipt('footer', $event)"/>
          </BsField>
          <BsGrid :columns="2" align="start">
            <BsField v-if="copy.documentLabel" v-slot="field" :label="copy.documentLabel"><BsInput :id="field.id" :model-value="receiptForm.documentLabel || ''" :aria-describedby="field.describedby" :maxlength="80" :disabled="!canManage" @update:model-value="updateReceipt('documentLabel', $event)" /></BsField>
            <BsField v-if="copy.referenceLabel" v-slot="field" :label="copy.referenceLabel"><BsInput :id="field.id" :model-value="receiptForm.referenceLabel || ''" :aria-describedby="field.describedby" :maxlength="80" :disabled="!canManage" @update:model-value="updateReceipt('referenceLabel', $event)" /></BsField>
            <BsField v-if="copy.documentLanguage" v-slot="field" :label="copy.documentLanguage"><BsSelect :input-id="field.id" :model-value="receiptForm.documentLanguage" :label="copy.documentLanguage" :aria-describedby="field.describedby" :options="[{ value: 'ar', label: 'العربية' }, { value: 'en', label: 'English' }]" option-value="value" option-label="label" :disabled="!canManage" @update:model-value="updateReceipt('documentLanguage', $event)" /></BsField>
            <BsField v-if="copy.documentDirection" v-slot="field" :label="copy.documentDirection"><BsSelect :input-id="field.id" :model-value="receiptForm.documentDirection" :label="copy.documentDirection" :aria-describedby="field.describedby" :options="[{ value: 'auto', label: copy.autoDirection || 'Auto' }, { value: 'rtl', label: 'RTL' }, { value: 'ltr', label: 'LTR' }]" option-value="value" option-label="label" :disabled="!canManage" @update:model-value="updateReceipt('documentDirection', $event)" /></BsField>
          </BsGrid>
          <BsCheckbox v-if="copy.showDescriptions" :model-value="receiptForm.showDescriptions ?? true" :label="copy.showDescriptions" :disabled="!canManage" @update:model-value="updateReceipt('showDescriptions', $event)" />
          <BsField v-if="copy.documentNotes" v-slot="field" :label="copy.documentNotes"><BsTextarea :id="field.id" :model-value="receiptForm.notes || ''" :aria-describedby="field.describedby" :maxlength="1000" :disabled="!canManage" @update:model-value="updateReceipt('notes', $event)" /></BsField>
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
        </BsSettingsForm>
      </template>
    </BsBox>
    <BsBox v-if="context && !loading && !shopError && shows('cash-policy')" id="cash-policy" as="section">
      <BsHeading v-if="!section" :level="2">{{ copy.cashTitle }}</BsHeading>
      <BsText v-if="!section" id="cash-policy-help">{{ copy.cashHelp }}</BsText>
      <BsText v-if="cash.loading" role="status">{{ copy.loading }}</BsText>
      <BsText v-else-if="cash.loadError" role="alert">{{ copy.failed }} <BsButton @click="emit('retryCash')">{{ copy.retry }}</BsButton></BsText>
      <BsSettingsForm v-else :pending="cash.pending" :disabled="cash.disabled" :error="cash.error" :success="cash.success" :dirty="cash.dirty" :submit-label="copy.cashSave" :cancel-label="copy.cancelEdit" :submit-disabled="cash.submitDisabled" @submit="emit('saveCash')" @cancel="emit('cancelCash')">
        <BsCheckbox v-model="cashRequired" :label="copy.cashRequired" :aria-describedby="!section ? 'cash-policy-help' : undefined" :disabled="cash.disabled" />
        <BsText v-if="!canManage" role="status">{{ copy.ownerOnly }}</BsText>
      </BsSettingsForm>
    </BsBox>
    </BsGrid>
  </BsStack>
</template>

<style scoped>
.bs-business-settings-page :deep(section[id]) { scroll-margin-block-start: 6rem; }
.bs-business-settings-page :deep(.bs-panel), .bs-business-settings-page :deep(.ls-content-section) { min-inline-size: 0; box-shadow: none; }
.bs-business-settings-page :deep(.bs-panel > .bs-stack) { margin-block-start: 1rem; }
.bs-business-settings-location-editor { margin-block-start: var(--bs-space-6); }
</style>
