<script setup lang="ts">
import { useViewportSpace, focusAfterRecordRemoval, usePointOfSaleCheckout } from '@building-suit/ux'
import type { BsPointOfSaleCopy, BsPointOfSaleView, BsPointOfSaleChoice, BsPointOfSaleCartLine, BsPointOfSaleCustomer, BsPointOfSalePaymentForm } from '../types/pointOfSalePresentation'
const props = defineProps<{ copy: BsPointOfSaleCopy; view: BsPointOfSaleView; cartLines: BsPointOfSaleCartLine[]; appointmentOptions: BsPointOfSaleChoice[]; staffOptions: BsPointOfSaleChoice[]; customerOptions: BsPointOfSaleCustomer[]; paymentOptions: BsPointOfSaleChoice[]; appointmentId: string; staffId: string; customerId: string }>()
const paymentForm = defineModel<BsPointOfSalePaymentForm>('paymentForm', { required: true })
const emit = defineEmits<{ priceOverride: [id: string, value: string]; priceReason: [id: string, value: string]; checkout: []; retryContext: []; remove: [id: string]; physicalSplit: [id: string, value: boolean]; physicalLoss: [id: string, value: string]; physicalSource: [id: string, value: string]; physicalSearch: [id: string, query: string]; physicalMore: [id: string]; physicalRetry: [id: string]; quantity: [id: string, value: number]; unit: [id: string, value: string]; appointment: [id: string]; staff: [id: string]; customerSearch: [value: string]; resetCustomerSearch: []; customer: [value: string | number | null | undefined]; clearCustomer: [] }>()
const root = ref<HTMLElement | null>(null)
const heading = ref<{ $el: HTMLElement } | null>(null)
const customer = ref<{ focus: () => void } | null>(null)
const { available, update } = useViewportSpace(() => root.value, 24, () => document.querySelector<HTMLElement>('[data-viewport-bottom]'))
const locked = computed(() => props.view.checkingOut || props.view.confirming || props.view.locationChanged)
function remove(id: string) { if (locked.value) return; const ids = props.cartLines.map(line => line.id); emit('remove', id); void focusAfterRecordRemoval(() => root.value, ids, id, () => heading.value?.$el.focus()) }
function quantity(id: string, value: number) { if (locked.value) return; if (value <= 0) remove(id); else emit('quantity', id, value) }
const optionalDetailsOpen = ref(false)
watch(() => !props.cartLines.length, empty => { if (empty) optionalDetailsOpen.value = false })
const wizard = usePointOfSaleCheckout(() => !props.cartLines.length, () => locked.value, () => heading.value?.$el.focus())
async function focusCustomer() { optionalDetailsOpen.value = true; await wizard.select(2); await nextTick(); update(); customer.value?.focus() }
function checkout() { if (locked.value) return; if (wizard.step.value === 1) void wizard.select(2); else if (!props.view.checkoutDisabled) emit('checkout') }
defineExpose({ checkout, focus: () => { update(); heading.value?.$el.focus() }, focusCustomer })
</script>
<template>
  <section ref="root" class="bs-pos-cart" :style="available ? { '--bs-viewport-space': `${available}px` } : undefined" aria-labelledby="pos-cart-title">
    <BsInline justify="between"><BsHeading id="pos-cart-title" ref="heading" tabindex="-1" :level="2">{{ copy.cart }}</BsHeading><BsText v-if="view.cartCount" size="sm">{{ view.cartCount }}</BsText></BsInline>
    <BsText v-if="view.contextLoading" role="status" size="sm">{{ copy.loading }}</BsText>
    <BsText v-else-if="view.contextError" role="alert" size="sm">{{ view.contextError }} <BsButton variant="link" @click="emit('retryContext')">{{ copy.retry }}</BsButton></BsText>
    <ol class="bs-pos-cart__steps" :aria-label="copy.cart">
      <li :aria-current="wizard.step.value === 1 ? 'step' : undefined"><BsButton variant="text" :disabled="locked" @click="wizard.select(1)"><span>1</span>{{ copy.reviewStep || copy.cart }}</BsButton></li>
      <li :aria-current="wizard.step.value === 2 ? 'step' : undefined"><BsButton variant="text" :disabled="locked || !cartLines.length" @click="wizard.select(2)"><span>2</span>{{ copy.paymentStep || copy.paymentMethod }}</BsButton></li>
    </ol>
    <div v-if="wizard.step.value === 1" class="bs-pos-cart__lines" :aria-label="copy.cart" tabindex="0">
      <BsText v-if="!cartLines.length" size="sm" tone="muted">{{ copy.emptyCart }}</BsText>
      <ul v-else>
        <li v-for="line in cartLines" :key="line.id" :data-record-key="line.id">
          <div class="bs-pos-cart__line-heading"><BsCatalogImage :src="line.imageUrl" :name="line.name" :placeholder="copy.imagePlaceholder || ''" /><BsText as="strong" emphasis="semibold">{{ line.name }}</BsText></div>
          <BsField v-if="line.unitChoices" v-slot="field" :label="copy.unit || copy.quantity"><BsSelect :input-id="field.id" :aria-describedby="field.describedby" :label="copy.unit || copy.quantity" :model-value="line.unitValue" :options="line.unitChoices" option-label="label" option-value="value" :disabled="locked" @update:model-value="emit('unit', line.id, String($event))" /></BsField>
          <BsStack v-if="line.physical" gap="sm">
            <BsEntityPicker :model-value="line.physical.source" :label="copy.physicalSource || copy.quantity" :options="line.physical.choices" option-label="label" option-value="value" :loading="line.physical.loading" :error="line.physical.error" :has-more="line.physical.hasMore" :load-more-label="copy.physicalMore || copy.retry" :retry-label="copy.retry" :disabled="locked" @update:model-value="emit('physicalSource', line.id, String($event ?? ''))" @search="emit('physicalSearch', line.id, $event)" @load-more="emit('physicalMore', line.id)" @retry="emit('physicalRetry', line.id)" />
            <BsCheckbox :model-value="line.physical.split" :label="copy.physicalSplit || copy.quantity" :disabled="locked || !line.physical.canSplit" @update:model-value="emit('physicalSplit', line.id, Boolean($event))" />
            <BsField v-slot="field" :label="`${copy.physicalLoss || copy.quantity} (${line.physical.unit})`" :hint="copy.physicalLossHelp"><BsInput :id="field.id" :model-value="line.physical.loss" :aria-describedby="field.describedby" inputmode="decimal" :disabled="locked" @update:model-value="emit('physicalLoss', line.id, String($event))" /></BsField>
          </BsStack>
          <BsPriceApprovalFields v-if="line.pricing" :approval="line.pricing" :record-id="line.id" :disabled="locked" @price="emit('priceOverride', line.id, $event)" @reason="emit('priceReason', line.id, $event)" />
          <BsText v-if="line.baseEquivalent" as="p" size="sm" tone="muted">{{ line.baseEquivalent }}</BsText>
          <div class="bs-pos-cart__line-controls">
            <BsQuantityStepper :model-value="line.quantity" :label="`${copy.quantity}: ${line.name}`" :decrease-label="`${copy.decrease || copy.quantity}: ${line.name}`" :increase-label="`${copy.increase || copy.quantity}: ${line.name}`" :step="line.quantityStep ?? 1" :max="line.maximumQuantity ?? 1000000" :disabled="locked" @update:model-value="quantity(line.id, $event)" />
            <BsText class="bs-pos-cart__line-total" emphasis="semibold">{{ line.total }}</BsText>
            <BsButton variant="icon" :disabled="locked" :aria-label="`${copy.remove}: ${line.name}`" @click="remove(line.id)"><BsIcon name="close" :size="16" /></BsButton>
          </div>
        </li>
      </ul>
    </div>
    <div v-else class="bs-pos-cart__controls">
      <BsPaymentMethodChoices :model-value="paymentForm.method" :label="copy.paymentMethod" :options="paymentOptions" :disabled="locked" @update:model-value="paymentForm = { ...paymentForm, method: $event }" />
      <BsDisclosure :summary="copy.optionalDetails || copy.notes" :open="optionalDetailsOpen || !staffId">
      <BsGrid :columns="2" class="bs-pos-cart__paired">
        <BsField v-slot="field" :label="copy.appointment"><BsSelect :input-id="field.id" :aria-describedby="field.describedby" :model-value="appointmentId" :disabled="locked" :label="copy.appointment" :options="appointmentOptions" option-label="label" option-value="value" option-disabled="disabled" @update:model-value="emit('appointment', String($event ?? ''))" /></BsField>
        <BsField v-slot="field" :label="copy.staff"><BsSelect :input-id="field.id" :aria-describedby="field.describedby" :model-value="staffId" :label="copy.staff" :options="staffOptions" option-label="label" option-value="value" filter virtual :disabled="view.appointmentLocked || locked" @update:model-value="emit('staff', String($event ?? ''))" /></BsField>
      </BsGrid>
      <BsField v-slot="field" :label="copy.customer"><BsSelect ref="customer" :input-id="field.id" :aria-describedby="field.describedby" :model-value="customerId || null" :label="copy.customer" :options="customerOptions" option-label="identity" option-value="id" filter :auto-filter-focus="true" :auto-option-focus="true" :filter-fields="['name', 'phone']" :filter-placeholder="copy.customerSearch" :reset-filter-on-hide="true" :loading="view.customerBusy" :disabled="view.customerDisabled" :placeholder="copy.noCustomer" @filter="emit('customerSearch', $event.value)" @hide="emit('resetCustomerSearch')" @update:model-value="emit('customer', $event)"><template #value><BsText as="span">{{ view.customerDisplay }}</BsText></template><template #empty>{{ view.customerEmpty }}</template><template #emptyfilter>{{ view.customerEmptyFilter }}</template></BsSelect><BsButton variant="link" :disabled="view.customerDisabled" @click="emit('clearCustomer')">{{ view.hasCustomer ? copy.clearCustomer : copy.noCustomer }}</BsButton></BsField>
      <BsField v-slot="field" :label="copy.reference"><BsInput :id="field.id" :aria-describedby="field.describedby" :model-value="paymentForm.reference" :disabled="locked" :maxlength="200" @update:model-value="paymentForm = { ...paymentForm, reference: String($event ?? '') }" /></BsField>
      <BsField v-slot="field" :label="copy.notes"><BsInput :id="field.id" :aria-describedby="field.describedby" :model-value="paymentForm.notes" :disabled="locked" :maxlength="2000" @update:model-value="paymentForm = { ...paymentForm, notes: String($event ?? '') }" /></BsField>
      </BsDisclosure>
    </div>
    <footer class="bs-pos-cart__footer">
      <BsText v-if="view.offerSummary" role="status" size="sm">{{view.offerSummary}}</BsText>
      <BsInline justify="between"><BsText emphasis="semibold">{{ copy.total }}</BsText><BsText as="strong" size="lg">{{ view.total }}</BsText></BsInline>
      <BsText size="xs">{{ copy.serverTotal }}</BsText>
      <BsButton v-if="wizard.step.value === 1" variant="primary" :disabled="locked || !cartLines.length" @click="wizard.select(2)">{{ copy.continueToPayment || copy.paymentMethod }}<BsIcon name="arrowRight" directional :size="18" /></BsButton>
      <template v-else><BsButton variant="primary" :pending="view.checkingOut" :disabled="view.checkoutDisabled || locked" @click="checkout">{{ view.checkingOut ? copy.paying : view.payLabel }}</BsButton><BsButton variant="text" :disabled="locked" @click="wizard.select(1)">{{ copy.backToCart || copy.cart }}</BsButton></template>
    </footer>
  </section>
</template>
<style scoped>
.bs-pos-cart { display: flex; flex-direction: column; gap: var(--bs-space-3); position: sticky; inset-block-start: var(--bs-space-4); block-size: var(--bs-viewport-space, calc(100dvh - 15rem)); min-inline-size: 0; padding: var(--bs-component-point-of-sale-panel-padding); border: 1px solid var(--bs-border); border-radius: var(--bs-radius-card); background: var(--bs-surface); }
.bs-pos-cart > :not(.bs-pos-cart__lines):not(.bs-pos-cart__controls) { flex-shrink: 0; }
.bs-pos-cart__lines { min-block-size: 3rem; flex: 1; overflow-y: auto; overscroll-behavior: contain; }
.bs-pos-cart__lines ul { list-style: none; padding: 0; margin: 0; }
.bs-pos-cart__lines li { display: grid; gap: var(--bs-space-2); padding-block: var(--bs-space-2); border-block-end: 1px solid var(--bs-border); }
.bs-pos-cart__line-controls { display: grid; grid-template-columns: auto minmax(0, 1fr) 2.75rem; gap: var(--bs-space-2); align-items: center; }
.bs-pos-cart__line-total { min-inline-size: 0; overflow-wrap: anywhere; text-align: center; }
.bs-pos-cart__controls, .bs-pos-cart__footer { display: grid; gap: var(--bs-space-2); }
.bs-pos-cart__paired { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: var(--bs-space-4); }
.bs-pos-cart :deep(.ls-input) { min-height: var(--bs-tap-target-min); }
.bs-pos-cart :deep(.ls-field) { gap: var(--bs-space-1); }
.bs-pos-cart :deep(.ls-field__label) { font-size: var(--bs-type-caption-size); line-height: var(--bs-type-caption-lh); font-weight: var(--bs-weight-regular); }
.bs-pos-cart__footer { padding-block-start: var(--bs-space-2); border-block-start: 1px solid var(--bs-border); }
.bs-pos-cart__footer :deep(strong) { font-size: var(--bs-type-h2-size); line-height: var(--bs-type-h2-lh); }
@media (max-width: 1023px) { .bs-pos-cart { position: static; } }
@media (max-height: 700px) { .bs-pos-cart { block-size: auto; } .bs-pos-cart__lines { max-block-size: 12rem; } }
.bs-pos-cart__controls { flex: 1; min-block-size: 0; overflow-y: auto; align-content: start; }
.bs-pos-cart__controls :deep(.bs-disclosure__content) { display: grid; gap: var(--bs-space-3); }
.bs-pos-cart__line-heading { display: flex; gap: var(--bs-space-3); align-items: center; }
.bs-pos-cart__line-heading :deep(.bs-catalog-image) { inline-size: 3.5rem; flex-shrink: 0; border-radius: var(--bs-radius-button); }
.bs-pos-cart__steps { display: grid; grid-template-columns: 1fr 1fr; list-style: none; padding: 0; margin: 0; border-block-end: 1px solid var(--bs-border); }
.bs-pos-cart__steps li { border-block-end: 2px solid transparent; }
.bs-pos-cart__steps li[aria-current='step'] { border-color: var(--bs-primary); color: var(--bs-primary); }
.bs-pos-cart__steps :deep(button) { inline-size: 100%; justify-content: start; padding: var(--bs-space-3) var(--bs-space-1); font-size: var(--bs-type-caption-size); }
.bs-pos-cart__steps span { display: grid; place-items: center; inline-size: 1.5rem; block-size: 1.5rem; border: 1px solid currentColor; border-radius: 50%; }
@media (max-height: 700px) { .bs-pos-cart__controls { overflow-y: visible; } }
</style>
