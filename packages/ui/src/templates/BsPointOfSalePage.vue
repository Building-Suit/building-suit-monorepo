<script setup lang="ts">
import type { BsReceiptPreview } from '../types/receiptPresentation'
import type { BsOfflineCounterView } from '../types/offlineCounterPresentation'
import { usePointOfSaleSections } from '@building-suit/ux'
import type { BsPointOfSaleCopy, BsPointOfSaleView, BsPointOfSaleChoice, BsPointOfSaleCatalogItem, BsPointOfSaleCartLine, BsPointOfSaleCustomer, BsPointOfSalePaymentForm } from '../types/pointOfSalePresentation'
const props = withDefaults(defineProps<{ receiptPreview?: BsReceiptPreview; offline?: BsOfflineCounterView; variant?: 'default' | 'shop'; copy: BsPointOfSaleCopy; view: BsPointOfSaleView; itemTypeOptions: BsPointOfSaleChoice[]; categoryOptions: BsPointOfSaleChoice[]; appointmentOptions: BsPointOfSaleChoice[]; staffOptions: BsPointOfSaleChoice[]; paymentOptions: BsPointOfSaleChoice[]; catalogItems: BsPointOfSaleCatalogItem[]; cartLines: BsPointOfSaleCartLine[]; customerOptions: BsPointOfSaleCustomer[]; staffId: string; appointmentId: string; customerId: string }>(), { variant: 'default', offline: undefined })
const receiptVisible = defineModel<boolean>('receiptVisible', { default: false })
const catalogSearch = defineModel<string>('catalogSearch', { required: true })
const categoryFilter = defineModel<string>('categoryFilter', { required: true })
const itemType = defineModel<string>('itemType', { required: true })
const catalogPage = defineModel<number>('catalogPage', { required: true })
const paymentForm = defineModel<BsPointOfSalePaymentForm>('paymentForm', { required: true })
const emit = defineEmits<{ openReceipt: []; receiptLanguage: [value: string | number | (string | number)[]]; selectReceipt: [id: string]; receiptPaper: [value: string]; retryReceipt: []; shareReceipt: []; downloadReceipt: []; printedReceipt: []; reconcileOffline: [id: string]; retryOffline: [id: string]; reset: []; checkout: []; retryCatalog: []; retryContext: []; add: [key: string]; remove: [id: string]; quantity: [id: string, value: number]; appointment: [id: string]; staff: [id: string]; customerSearch: [value: string]; resetCustomerSearch: []; customer: [value: string | number | null | undefined]; clearCustomer: []; dismissFeedback: []; barcode: [code: string] }>()
const panels = usePointOfSaleSections()
const shopCart = ref<{ focus: () => void; focusCustomer: () => void; checkout: () => void } | null>(null)
const catalogHeading = ref<{ $el: HTMLElement } | null>(null)
const catalogInput = ref<{ focus: () => void } | null>(null)
const customerControl = ref<{ focus: () => void } | null>(null)
const navigation = usePointOfSaleKeyboard({ blocked: () => props.view.shortcutBlocked, focusCatalog: () => panels.select('catalog', () => catalogInput.value?.focus()), focusCustomer: () => props.variant === 'shop' ? panels.select('cart', () => shopCart.value?.focusCustomer()) : customerControl.value?.focus(), checkout: () => props.variant === 'shop' ? void panels.select('cart', () => shopCart.value?.checkout()) : emit('checkout'), dismissFeedback: () => emit('dismissFeedback'), barcode: code => emit('barcode', code) })
watch(receiptVisible, (visible, previous) => { if (!visible && previous) void navigation.focusCatalog() })
defineExpose({ focusCatalog: navigation.focusCatalog })
</script>
<template>
  <BsStack :class="{ 'bs-pos-shop': variant === 'shop' }" :data-active-panel="panels.selected.value">
    <BsPageHeader class="bs-pos-header" :title="copy.title" :subtitle="variant === 'shop' ? undefined : copy.subtitle" :context="variant === 'shop' && view.available ? [{ label: copy.location, value: view.location }, { label: copy.staff, value: view.staff }] : []">
      <template #actions>
        <BsButton v-if="receiptPreview && view.available" variant="secondary" :disabled="view.checkingOut" @click="emit('openReceipt')"><BsIcon name="invoice" :size="18" />{{ receiptPreview.lastLabel }}</BsButton>
        <BsLink v-if="variant === 'shop' && view.available" class="bs-pos-shift-action" to="/cash-shifts"><BsIcon name="wallet" :size="18" />{{ copy.closeShift }}</BsLink>
        <BsButton variant="secondary" :disabled="view.checkingOut || view.confirming" @click="emit('reset')"><BsIcon name="repeat" :size="18" />{{ copy.reset }}</BsButton>
      </template>
    </BsPageHeader>
    <BsOfflineCounterStatus v-if="offline && variant !== 'shop'" :view="offline" @retry="emit('retryOffline', $event)" @reconcile="emit('reconcileOffline', $event)" />
    <BsText v-if="!view.available && !view.loadingContext" as="p" size="sm">{{ copy.noShop }}</BsText>
    <template v-else-if="view.available">
      <BsPanel v-if="variant !== 'shop'" :aria-label="copy.cart" padding="md">
        <BsText as="p" size="md"><BsText as="strong">{{ copy.location }}:</BsText> {{ view.location }} · <BsText as="strong">{{ copy.staff }}:</BsText> {{ view.staff }}</BsText>
        <BsInline><BsLink to="#pos-catalog-title" external>{{ copy.catalog }}</BsLink><BsLink to="#pos-cart-title" external>{{ view.reviewLabel }} · {{ view.total }}</BsLink><BsLink to="/cash-shifts">{{ copy.closeShift }}</BsLink></BsInline>
      </BsPanel>
      <BsInline v-if="variant === 'shop'" class="bs-pos-mobile-panels">
        <BsButton variant="secondary" :aria-pressed="panels.selected.value === 'catalog'" @click="panels.select('catalog', () => catalogInput?.focus())">{{ copy.catalog }}</BsButton>
        <BsButton variant="secondary" :aria-pressed="panels.selected.value === 'cart'" @click="panels.select('cart', () => shopCart?.focus())">{{ view.reviewLabel }} · {{ view.total }}</BsButton>
      </BsInline>
      <BsText v-if="view.locationChanged" role="alert" as="p" size="sm" tone="danger">{{ copy.locationChanged }}</BsText>
      <BsText v-if="view.error" role="alert" as="p" size="sm" tone="danger">{{ view.error }}</BsText>
      <BsVisuallyHidden aria-live="polite">{{ view.scanMessage }}</BsVisuallyHidden>
      <BsText v-if="view.checkingOut" role="status" as="p" size="sm" emphasis="semibold">{{ copy.paying }}</BsText>
      <BsFieldGroup :disabled="view.checkingOut" :inert="view.checkingOut" :aria-busy="view.checkingOut" :legend="''">
        <BsGrid :columns="2" :class="{ 'bs-pos-workspace': variant === 'shop' }" :data-active-panel="panels.selected.value">
          <BsPanel aria-labelledby="pos-catalog-title" padding="md" :class="{ 'bs-pos-catalog-panel': variant === 'shop' }">
            <BsHeading id="pos-catalog-title" ref="catalogHeading" tabindex="-1" :level="2">{{ copy.catalog }}</BsHeading>
            <BsOfflineCounterStatus v-if="offline && variant === 'shop'" compact :view="offline" @retry="emit('retryOffline', $event)" @reconcile="emit('reconcileOffline', $event)" />
            <BsFilterBar :label="copy.catalog" :variant="variant === 'shop' ? 'plain' : 'surface'" :class="{ 'bs-pos-catalog-filters': variant === 'shop' }">
              <BsInput id="pos-catalog-search" ref="catalogInput" v-model="catalogSearch" type="search" :placeholder="copy.search" :aria-label="copy.search"/>
              <BsSelect v-model="categoryFilter" :label="copy.category" :options="categoryOptions" option-label="label" option-value="value" option-disabled="disabled"/>
              <BsTabs v-if="variant === 'shop'" :model-value="itemType" class="bs-pos-catalog-tabs" :tabs="itemTypeOptions" :label="copy.catalog" id-prefix="pos-catalog-kind" @update:model-value="itemType = $event" />
              <BsInline v-else class="bs-pos-kind-filter" :aria-label="copy.catalog" role="group">
                <BsButton v-for="kind in itemTypeOptions" :key="kind.value" variant="chip" type="button" :aria-pressed="itemType === kind.value" @click="itemType = kind.value">{{ kind.label }}</BsButton>
              </BsInline>
            </BsFilterBar>
            <div :id="variant === 'shop' ? 'pos-catalog-kind-panel' : undefined" :role="variant === 'shop' ? 'tabpanel' : undefined" :aria-labelledby="variant === 'shop' ? `pos-catalog-kind-${itemType}` : undefined" :aria-busy="view.catalogLoading">
            <BsText v-if="view.scanMessage" as="p" size="sm">{{ view.scanMessage }}</BsText>
            <BsText v-if="view.catalogLoading" role="status" as="p" size="sm" tone="muted">{{ copy.loading }}</BsText>
            <BsBox v-else-if="view.catalogError" role="alert" padding="md">
              <BsText as="p">{{ view.catalogError }}</BsText>
              <BsButton severity="secondary" @click="emit('retryCatalog')">{{ copy.retry }}</BsButton>
            </BsBox>
            <BsText v-else-if="!catalogItems.length" as="p" size="sm" tone="muted">{{ copy.noResults }}</BsText>
            <BsList v-else marker="none" :class="{ 'bs-pos-catalog-grid': variant === 'shop' }" :aria-label="copy.catalog">
              <BsListItem v-for="item in catalogItems" :key="item.key">
                <BsCatalogTile v-if="variant === 'shop'" :name="item.name" large :quantity="item.quantity" :maximum-quantity="item.maximumQuantity" :add-label="copy.add || copy.catalog" :quantity-label="copy.quantity" :decrease-label="copy.decrease || copy.quantity" :increase-label="copy.increase || copy.quantity" :price="item.price" :detail="item.description" :stock="item.stock" :image-url="item.imageUrl" :image-label="copy.imagePlaceholder || ''" :disabled="item.disabled || view.locationChanged || view.checkingOut || view.confirming" @select="emit('add', item.key)" @quantity="value => value <= 0 ? emit('remove', item.key) : emit('quantity', item.key, value)" />
                <BsActionTile v-else type="button" :disabled="view.locationChanged || view.checkingOut" @click="emit('add', item.key)">
                  <BsText as="strong">{{ item.name }}</BsText>
                  <BsText as="span" size="xs" tone="muted">
                    <BsText as="span">{{ item.description }}</BsText>
                    <BsText as="span">{{ item.price }}</BsText>
                  </BsText>
                  <BsText v-if="!!item.stock" as="span" size="xs">{{ item.stock }}</BsText>
                </BsActionTile>
              </BsListItem>
            </BsList>
            <BsInline v-if="view.catalogTotal > view.catalogPageSize">
              <BsButton severity="secondary" :disabled="catalogPage <= 1" :aria-label="copy.previous" @click="catalogPage--">
                <BsText aria-hidden="true" as="span">{{ copy.previousGlyph }}</BsText>
              </BsButton>
              <BsText as="span" size="sm">{{ catalogPage }}</BsText>
              <BsButton severity="secondary" :disabled="catalogPage * view.catalogPageSize >= view.catalogTotal" :aria-label="copy.next" @click="catalogPage++">
                <BsText aria-hidden="true" as="span">{{ copy.nextGlyph }}</BsText>
              </BsButton>
            </BsInline>
            </div>
          </BsPanel>
          <BsPointOfSaleCart v-if="variant === 'shop'" ref="shopCart" v-model:payment-form="paymentForm" :copy="copy" :view="view" :cart-lines="cartLines" :appointment-options="appointmentOptions" :staff-options="staffOptions" :customer-options="customerOptions" :payment-options="paymentOptions" :appointment-id="appointmentId" :staff-id="staffId" :customer-id="customerId" @checkout="emit('checkout')" @retry-context="emit('retryContext')" @remove="emit('remove', $event)" @quantity="(id, value) => emit('quantity', id, value)" @appointment="emit('appointment', $event)" @staff="emit('staff', $event)" @customer-search="emit('customerSearch', $event)" @reset-customer-search="emit('resetCustomerSearch')" @customer="emit('customer', $event)" @clear-customer="emit('clearCustomer')" />
          <BsPanel v-else aria-labelledby="pos-cart-title" padding="md">
            <BsHeading id="pos-cart-title" tabindex="-1" :level="2">{{ copy.cart }}</BsHeading>
            <BsText v-if="view.contextLoading" role="status" as="p" size="sm">{{ copy.loading }}</BsText>
            <BsText v-else-if="view.contextError" role="alert" as="p" size="sm" tone="danger">{{ view.contextError }} <BsButton variant="link" type="button" @click="emit('retryContext')">{{ copy.retry }}</BsButton>
            </BsText>
            <BsGrid :columns="2">
              <BsText as="span" emphasis="semibold">{{ copy.location }}</BsText>
              <BsText as="span">{{ view.location }}</BsText>
              <BsText as="span" emphasis="semibold">{{ copy.staff }}</BsText>
              <BsText as="span">{{ view.staff }}</BsText>
            </BsGrid>
            <BsText v-if="!cartLines.length" as="p" size="sm" tone="muted">{{ copy.emptyCart }}</BsText>
            <BsLineItemsEditor v-else :items="cartLines" :label="copy.cart" :add-label="copy.catalog" :remove-label="copy.remove" :row-label="item => item.name" :show-add="false" :pending="view.checkingOut" @remove="emit('remove', $event.id)">
              <template #default="{ item: line }">
                <BsInline justify="between">
                  <BsText as="strong">{{ line.name }}</BsText>
                </BsInline>
                <BsInline justify="between">
                  <BsField v-slot="field" :label="(copy.quantity)">
                    <BsQuantityInput :id="field.id" :aria-describedby="field.describedby" :model-value="line.quantity" :label="copy.quantity"  :min="0.001" :max="1000000" :step="1" @update:model-value="value => emit('quantity', line.id, Number(value))"/>
                  </BsField>
                  <BsText as="span" emphasis="semibold">{{ line.total }}</BsText>
                </BsInline>
              </template>
            </BsLineItemsEditor>
            <BsStack>
              <BsField v-slot="field" :label="(copy.appointment)">
                <BsSelect :input-id="field.id" :aria-describedby="field.describedby" :model-value="appointmentId" :disabled="view.checkingOut" :label="(copy.appointment)" :options="appointmentOptions" option-label="label" option-value="value" option-disabled="disabled" @update:model-value="emit('appointment', String($event ?? ''))"/>
              </BsField>
              <BsField v-slot="field" :label="(copy.staff)">
                <BsSelect :model-value="staffId" :input-id="field.id" :aria-describedby="field.describedby" :label="copy.staff" :options="staffOptions" option-label="label" option-value="value" filter virtual :disabled="view.appointmentLocked || view.checkingOut" @update:model-value="emit('staff', String($event ?? ''))" />
              </BsField>
              <BsSelect
                ref="customerControl" input-id="pos-customer" :model-value="customerId || null" :label="copy.customer" :options="customerOptions" option-label="identity" option-value="id"
                filter :auto-filter-focus="true" :auto-option-focus="true" :filter-fields="['name', 'phone']" :filter-placeholder="copy.customerSearch" :reset-filter-on-hide="true" :loading="view.customerBusy"
                :disabled="view.customerDisabled" :placeholder="copy.noCustomer"
                @filter="emit('customerSearch', $event.value)" @hide="emit('resetCustomerSearch')" @update:model-value="emit('customer', $event)">
                <template #value><BsText as="span">{{ view.customerDisplay }}</BsText></template>
                <template #empty>{{ view.customerEmpty }}</template>
                <template #emptyfilter>{{ view.customerEmptyFilter }}</template>
              </BsSelect>
              <BsButton variant="link" :disabled="view.customerDisabled" @click="emit('clearCustomer')">{{ view.hasCustomer ? copy.clearCustomer : copy.noCustomer }}</BsButton>
              <BsText size="xs" tone="muted">{{ copy.customerSearchHint }}</BsText>
              <BsText v-if="!view.hasCustomer" size="xs" tone="muted">{{ copy.noCustomer }}</BsText>
              <BsGrid :columns="2">
                <BsField v-slot="field" :label="(copy.paymentMethod)">
                  <BsSelect :model-value="paymentForm.method" :input-id="field.id" :aria-describedby="field.describedby" :label="(copy.paymentMethod)" :options="paymentOptions" option-label="label" option-value="value" option-disabled="disabled" @update:model-value="paymentForm = { ...paymentForm, method: String($event ?? '') }"/>
                </BsField>
                <BsField v-slot="field" :label="(copy.reference)">
                  <BsInput :id="field.id" :model-value="paymentForm.reference" :aria-describedby="field.describedby" :maxlength="200" @update:model-value="paymentForm = { ...paymentForm, reference: String($event ?? '') }"/>
                </BsField>
              </BsGrid>
              <BsField v-slot="field" :label="(copy.notes)">
                <BsInput :id="field.id" :model-value="paymentForm.notes" :aria-describedby="field.describedby" :maxlength="2000" @update:model-value="paymentForm = { ...paymentForm, notes: String($event ?? '') }"/>
              </BsField>
              <BsInline justify="between">
                <BsText as="span" size="sm" emphasis="semibold">{{ copy.total }}</BsText>
                <BsText as="strong" size="lg">{{ view.total }}</BsText>
              </BsInline>
              <BsText as="p" size="xs" tone="muted">{{ copy.serverTotal }}</BsText>
              <BsButton variant="primary" :pending="view.checkingOut" :disabled="view.checkoutDisabled" @click="emit('checkout')">{{ view.checkingOut ? copy.paying : view.payLabel }}</BsButton>
              <BsText as="p" size="xs" tone="muted">{{ copy.shortcuts }}</BsText>
            </BsStack>
          </BsPanel>
        </BsGrid>
      </BsFieldGroup>
    </template>
    <BsReceiptPreviewDialog v-if="receiptPreview" v-model:visible="receiptVisible" :view="receiptPreview" @select="emit('selectReceipt', $event)" @recent="emit('openReceipt')" @language="emit('receiptLanguage', $event)" @paper="emit('receiptPaper', $event)" @retry="emit('retryReceipt')" @share="emit('shareReceipt')" @download="emit('downloadReceipt')" @printed="emit('printedReceipt')" />
  </BsStack>
</template>

<style scoped>
.bs-pos-workspace { gap: var(--bs-space-5); align-items: start; grid-template-columns: minmax(0, 1fr) minmax(20rem, 24rem); }
.bs-pos-catalog-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 13rem), 1fr)); gap: .75rem; list-style: none; padding: 0; }
.bs-pos-catalog-grid :deep(.bs-list-item) { display: flex; align-items: stretch; min-inline-size: 0; padding: 0; margin-block: 0; }
.bs-pos-order-panel { position: sticky; inset-block-start: 5rem; min-inline-size: 0; max-block-size: calc(100dvh - 6rem); overflow-y: auto; }
@media (min-width: 1600px) { .bs-pos-workspace { grid-template-columns: minmax(0, 1fr) 26rem; } }
@media (max-width: 1023px) { .bs-pos-workspace { grid-template-columns: minmax(0, 1fr); } .bs-pos-order-panel { position: static; max-block-size: none; overflow-y: visible; } }
@media (max-width: 639px) { .bs-pos-catalog-grid { grid-template-columns: repeat(auto-fit, minmax(min(100%, 12rem), 1fr)); gap: var(--bs-space-3); } }
.bs-pos-shop :deep(.bs-field-group__content) { margin-block-start: 0; }
@media (max-width: 1023px) {
  .bs-pos-workspace[data-active-panel='catalog'] > :deep(.bs-pos-cart), .bs-pos-workspace[data-active-panel='cart'] > .bs-pos-catalog-panel { display: none; }
}
.bs-pos-catalog-panel { padding: var(--bs-component-point-of-sale-panel-padding); }
.bs-pos-catalog-filters :deep(.ls-toolbar__main) { display: grid; grid-template-columns: minmax(0, 1fr) minmax(10rem, 16rem); gap: var(--bs-space-4); }
.bs-pos-catalog-tabs { grid-column: 1 / -1; }
.bs-pos-kind-filter { justify-content: space-between; }
.bs-pos-shop { gap: var(--bs-space-4); }
.bs-pos-mobile-panels { display: none; }
.bs-pos-shift-action { display: inline-flex; align-items: center; justify-content: center; gap: var(--bs-space-2); min-block-size: var(--bs-tap-target-min); padding-inline: var(--bs-space-4); border: 1px solid var(--bs-border); border-radius: var(--bs-radius-button); color: var(--bs-text); font-size: var(--bs-type-body-m-size); }
.bs-pos-shift-action:hover { background: var(--bs-surface-muted); }
@media (max-width: 1023px) { .bs-pos-mobile-panels { display: flex; } }
@media (max-width: 639px) { .bs-pos-catalog-filters :deep(.ls-toolbar__main) { grid-template-columns: minmax(0, 1fr); } }
</style>
