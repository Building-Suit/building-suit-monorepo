<script setup lang="ts">
import type { BsShopTaxForm, BsShopTaxCopy, BsShopTaxRuleForm } from '@building-suit/ui/types/shopTaxPresentation'
import { localDateTimeInput } from '@building-suit/ux'
import type { TaxPolicy, TaxRule, TaxSettings } from '~/types/tax'
import type { ShopRpcDatabase } from '~/types/shopCrmRpc'
definePageMeta({ layout: 'default', middleware: ['auth'] })
const { currentId } = useShop()
const { locale } = useI18n()
const rpc = useSupabaseClient<ShopRpcDatabase>().schema('public')
const form = ref<BsShopTaxForm>({ enabled: false, effectiveAt: '', reason: '', default: { treatment: 'non_taxable', rate: '0', priceMode: 'exclusive', subtype: 'V004' }, items: [] })
const action = useRecordAction(() => form.value)
const { visible: editor, dirty } = action
const pending = ref(false)
const actionError = ref(false)
const saved = ref(false)
const copy = computed<BsShopTaxCopy>(() => locale.value === 'ar' ? {
 title: 'إعداد حساب الضريبة', help: 'الحساب اختياري. إيقافه مش إعفاء قانوني. اختار التصنيف والنسبة الصحيحة لكل منتج أو خدمة. النسخ الجديدة تطبق على المبيعات القادمة فقط. ده مش ربط بالضرائب أو تأكيد امتثال.', edit: 'نسخة إعداد جديدة', enabled: 'تفعيل حساب الضريبة', effectiveAt: 'يبدأ من', reason: 'سبب التغيير', save: 'حفظ نسخة', cancel: 'إلغاء', treatment: 'التصنيف', rate: 'النسبة ٪', priceMode: 'السعر', subtype: 'رمز التصنيف V001–V010', vat: 'قيمة مضافة', zero_rated: 'نسبة صفر', exempt: 'معفى', non_taxable: 'غير خاضع', inclusive: 'شامل الضريبة', exclusive: 'قبل الضريبة', defaults: 'إعداد النشاط', overrides: 'تصنيف المنتجات والخدمات', override: 'إعداد خاص للبند', loading: 'بنحمّل…', error: 'تعذر التنفيذ. راجع تصنيف الضريبة والنسبة وصلاحيات المدير وحاول تاني.', retry: 'حاول تاني', saved: 'اتحفظت النسخة.', noContext: 'اختار نشاطًا.', history: 'آخر ١٠٠ نسخة', empty: 'الحساب مقفول. مفيش إعداد محفوظ.'
} : {
 title: 'Tax calculation settings', help: 'Optional calculation. Disabled is not a legal exemption. Choose the appropriate classification and rate for each product or service. New versions apply to future issuance only. This is separate from ETA connectivity and is not a compliance claim.', edit: 'New settings version', enabled: 'Enable tax calculation', effectiveAt: 'Effective from', reason: 'Reason for change', save: 'Save version', cancel: 'Cancel', treatment: 'Treatment', rate: 'Rate %', priceMode: 'Price mode', subtype: 'Classification code V001–V010', vat: 'VAT', zero_rated: 'Zero rated', exempt: 'Exempt', non_taxable: 'Non-taxable', inclusive: 'Tax inclusive', exclusive: 'Tax exclusive', defaults: 'Business default', overrides: 'Product and service classifications', override: 'Override business default', loading: 'Loading…', error: 'Unable to save. Check the tax classification, rate and manager permissions, then retry.', retry: 'Retry', saved: 'Settings version saved.', noContext: 'Select a shop.', history: 'Latest 100 versions', empty: 'Calculation is disabled; no saved configuration.'
})
const { data, pending: loading, error, refresh } = useAsyncData(() => `shop-data:tax:${currentId.value ?? 'none'}`, async () => {
 if (!currentId.value) return null
 const result = await rpc.rpc('tax_settings', { p_shop_id: currentId.value })
 if (result.error) throw result.error
 return result.data as TaxSettings
}, { watch: [currentId], default: () => null })
function edit() {
 const latest = data.value?.versions[0]?.policy
 const ruleForm = (rule?: TaxRule): BsShopTaxRuleForm => rule ? { ...rule, rate: String(rule.rate) } : { treatment: 'non_taxable', rate: '0', priceMode: 'exclusive', subtype: 'V004' }
 form.value = { enabled: latest?.enabled ?? false, effectiveAt: localDateTimeInput(new Date()), reason: '', default: ruleForm(latest?.default), items: (data.value?.items ?? []).map(item => {
 const override = latest?.items.find(rule => rule.itemType === item.itemType && rule.sourceId === item.id)
 return { ...item, ...ruleForm(override ?? latest?.default), override: Boolean(override) }
 }) }
 actionError.value = false; saved.value = false; action.edit()
}
async function save() {
 if (!currentId.value || pending.value) return
 pending.value = true; actionError.value = false
 try {
 const rule = (value: BsShopTaxRuleForm): TaxRule => ({ treatment: value.treatment as TaxRule['treatment'], rate: Number(value.rate), priceMode: value.priceMode as TaxRule['priceMode'], subtype: value.subtype })
 const policy: TaxPolicy = { enabled: form.value.enabled, default: rule(form.value.default), items: form.value.items.filter(item => item.override).map(item => ({ ...rule(item), itemType: item.itemType, sourceId: item.id })) }
 const result = await rpc.rpc('save_tax_policy', { p_request_id: crypto.randomUUID(), p_shop_id: currentId.value, p_effective_at: new Date(form.value.effectiveAt).toISOString(), p_policy: policy, p_reason: form.value.reason })
 if (result.error) throw result.error
 await refresh(); action.complete(); saved.value = true
 } catch { actionError.value = true } finally { pending.value = false }
}
watch(currentId, () => { action.complete(); saved.value = false; actionError.value = false })
const records = computed(() => (data.value?.versions ?? []).map(item => ({ id: item.id, effectiveAt: new Date(item.effective_at).toLocaleString(locale.value), reason: item.reason, enabled: item.policy.enabled ? '✓' : '—' })))
</script>
<template>
 <BsShopTaxSettingsPage v-model:form="form" v-model:editor="editor" :copy="copy" :available="Boolean(currentId)" :loading="loading" :error="Boolean(error)" :pending="pending" :dirty="dirty" :action-error="actionError" :saved="saved" :records="records" @edit="edit" @save="save" @retry="refresh()" />
</template>
