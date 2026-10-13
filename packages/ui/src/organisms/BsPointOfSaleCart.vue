<script setup lang="ts">
import { useViewportSpace, focusAfterRecordRemoval } from '@building-suit/ux'
import type { BsPointOfSaleCopy, BsPointOfSaleView, BsPointOfSaleChoice, BsPointOfSaleCartLine, BsPointOfSaleCustomer, BsPointOfSalePaymentForm } from '../types/pointOfSalePresentation'
const props = defineProps<{ copy: BsPointOfSaleCopy; view: BsPointOfSaleView; cartLines: BsPointOfSaleCartLine[]; appointmentOptions: BsPointOfSaleChoice[]; staffOptions: BsPointOfSaleChoice[]; customerOptions: BsPointOfSaleCustomer[]; paymentOptions: BsPointOfSaleChoice[]; appointmentId: string; staffId: string; customerId: string }>()
const paymentForm = defineModel<BsPointOfSalePaymentForm>('paymentForm', { required: true })
const emit = defineEmits<{ checkout: []; retryContext: []; remove: [id: string]; quantity: [id: string, value: number]; appointment: [id: string]; staff: [id: string]; customerSearch: [value: string]; resetCustomerSearch: []; customer: [value: string | number | null | undefined]; clearCustomer: [] }>()
const root = ref<HTMLElement | null>(null)
const heading = ref<{ $el: HTMLElement } | null>(null)
const customer = ref<{ focus: () => void } | null>(null)
const { available, update } = useViewportSpace(() => root.value, 24, () => document.querySelector<HTMLElement>('[data-viewport-bottom]'))
const locked = computed(() => props.view.checkingOut || props.view.confirming || props.view.locationChanged)
function remove(id: string) { if (locked.value) return; const ids = props.cartLines.map(line => line.id); emit('remove', id); void focusAfterRecordRemoval(() => root.value, ids, id, () => heading.value?.$el.focus()) }
function quantity(id: string, value: number) { if (locked.value) return; if (value <= 0) remove(id); else emit('quantity', id, value) }
defineExpose({ focus: () => { update(); heading.value?.$el.focus() }, focusCustomer: () => { update(); customer.value?.focus() } })
</script>
<template>
  <section ref="root" class="bs-pos-cart" :style="available ? { '--bs-viewport-space': `${available}px` } : undefined" aria-labelledby="pos-cart-title">
    <BsInline justify="between"><BsHeading id="pos-cart-title" ref="heading" tabindex="-1" :level="2">{{ copy.cart }}</BsHeading><BsText v-if="view.cartCount" size="sm">{{ view.cartCount }}</BsText></BsInline>
    <BsText v-if="view.contextLoading" role="status" size="sm">{{ copy.loading }}</BsText>
    <BsText v-else-if="view.contextError" role="alert" size="sm">{{ view.contextError }} <BsButton variant="link" @click="emit('retryContext')">{{ copy.retry }}</BsButton></BsText>
    <div class="bs-pos-cart__lines" :aria-label="copy.cart" tabindex="0">
      <BsText v-if="!cartLines.length" size="sm" tone="muted">{{ copy.emptyCart }}</BsText>
      <ul v-else>
        <li v-for="line in cartLines" :key="line.id" :data-record-key="line.id">
          <BsText as="strong" emphasis="semibold">{{ line.name }}</BsText>
          <div class="bs-pos-cart__line-controls">
            <BsQuantityStepper :model-value="line.quantity" :label="`${copy.quantity}: ${line.name}`" :decrease-label="`${copy.decrease || copy.quantity}: ${line.name}`" :increase-label="`${copy.increase || copy.quantity}: ${line.name}`" :max="line.maximumQuantity ?? 1000000" :disabled="locked" @update:model-value="quantity(line.id, $event)" />
            <BsText class="bs-pos-cart__line-total" emphasis="semibold">{{ line.total }}</BsText>
            <BsButton variant="icon" :disabled="locked" :aria-label="`${copy.remove}: ${line.name}`" @click="remove(line.id)"><BsIcon name="close" :size="16" /></BsButton>
          </div>
        </li>
      </ul>
    </div>
    <div class="bs-pos-cart__controls">
      <BsGrid :columns="2" class="bs-pos-cart__paired">
        <BsField v-slot="field" :label="copy.appointment"><BsSelect :input-id="field.id" :aria-describedby="field.describedby" :model-value="appointmentId" :disabled="locked" :label="copy.appointment" :options="appointmentOptions" option-label="label" option-value="value" option-disabled="disabled" @update:model-value="emit('appointment', String($event ?? ''))" /></BsField>
        <BsField v-slot="field" :label="copy.staff"><BsSelect :input-id="field.id" :aria-describedby="field.describedby" :model-value="staffId" :label="copy.staff" :options="staffOptions" option-label="label" option-value="value" filter virtual :disabled="view.appointmentLocked || locked" @update:model-value="emit('staff', String($event ?? ''))" /></BsField>
      </BsGrid>
      <BsField v-slot="field" :label="copy.customer"><BsSelect ref="customer" :input-id="field.id" :aria-describedby="field.describedby" :model-value="customerId || null" :label="copy.customer" :options="customerOptions" option-label="identity" option-value="id" filter :auto-filter-focus="true" :auto-option-focus="true" :filter-fields="['name', 'phone']" :filter-placeholder="copy.customerSearch" :reset-filter-on-hide="true" :loading="view.customerBusy" :disabled="view.customerDisabled" :placeholder="copy.noCustomer" @filter="emit('customerSearch', $event.value)" @hide="emit('resetCustomerSearch')" @update:model-value="emit('customer', $event)"><template #value><BsText as="span">{{ view.customerDisplay }}</BsText></template><template #empty>{{ view.customerEmpty }}</template><template #emptyfilter>{{ view.customerEmptyFilter }}</template></BsSelect><BsButton variant="link" :disabled="view.customerDisabled" @click="emit('clearCustomer')">{{ view.hasCustomer ? copy.clearCustomer : copy.noCustomer }}</BsButton></BsField>
      <BsGrid :columns="2" class="bs-pos-cart__paired">
        <BsField v-slot="field" :label="copy.paymentMethod"><BsSelect :input-id="field.id" :aria-describedby="field.describedby" :model-value="paymentForm.method" :disabled="locked" :label="copy.paymentMethod" :options="paymentOptions" option-label="label" option-value="value" option-disabled="disabled" @update:model-value="paymentForm = { ...paymentForm, method: String($event ?? '') }" /></BsField>
        <BsField v-slot="field" :label="copy.reference"><BsInput :id="field.id" :aria-describedby="field.describedby" :model-value="paymentForm.reference" :disabled="locked" :maxlength="200" @update:model-value="paymentForm = { ...paymentForm, reference: String($event ?? '') }" /></BsField>
      </BsGrid>
      <BsField v-slot="field" :label="copy.notes"><BsInput :id="field.id" :aria-describedby="field.describedby" :model-value="paymentForm.notes" :disabled="locked" :maxlength="2000" @update:model-value="paymentForm = { ...paymentForm, notes: String($event ?? '') }" /></BsField>
    </div>
    <footer class="bs-pos-cart__footer">
      <BsInline justify="between"><BsText emphasis="semibold">{{ copy.total }}</BsText><BsText as="strong" size="lg">{{ view.total }}</BsText></BsInline>
      <BsText size="xs">{{ copy.serverTotal }}</BsText>
      <BsButton variant="primary" :pending="view.checkingOut" :disabled="view.checkoutDisabled" @click="emit('checkout')">{{ view.checkingOut ? copy.paying : view.payLabel }}</BsButton>
    </footer>
  </section>
</template>
<style scoped>
.bs-pos-cart { display: flex; flex-direction: column; gap: var(--bs-space-3); position: sticky; inset-block-start: 5rem; block-size: var(--bs-viewport-space, calc(100dvh - 15rem)); min-inline-size: 0; padding: var(--bs-component-point-of-sale-panel-padding); border: 1px solid var(--bs-border); border-radius: var(--bs-radius-card); background: var(--bs-surface); }
.bs-pos-cart > :not(.bs-pos-cart__lines) { flex-shrink: 0; }
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
</style>
