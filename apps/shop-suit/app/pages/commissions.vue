<script setup lang="ts">
import type { BsCommissionForm, BsCommissionCopy, BsCommissionRow, BsCommissionAssignment } from '@building-suit/ui/types/commissionPresentation'
import type { CommissionHistory, CommissionPolicy, CommissionRate } from '~/types/commission'
import type { ShopRpcDatabase } from '~/types/shopCrmRpc'
definePageMeta({ layout: 'default', middleware: ['auth'] })
const { currentId, businessCurrency } = useShop()
const { locale } = useI18n()
const route = useRoute()
const rpc = useSupabaseClient<ShopRpcDatabase>().schema('public')
const pending = ref(false)
const actionError = ref(false)
const saved = ref(false)
const form = ref<BsCommissionForm>({ enabled: false, currency: 'EGP', service: { type: 'percentage', rate: '0' }, product: { type: 'percentage', rate: '0' }, employees: [], reason: '' })
const policyAction = useRecordAction(() => form.value)
const { visible: editor, dirty } = policyAction
const offset = ref(0)
const invoiceId = computed(() => typeof route.query.sale === 'string' ? route.query.sale : null)
const copy = computed<BsCommissionCopy>(() => locale.value === 'ar' ? {
 noContext: 'اختار نشاطًا.', edit: 'تعديل السياسة', title: 'عمولات الفريق', help: 'اختيارية ومقفولة افتراضيًا. العمولة على صافي البيع بعد الخصومات وقبل الضريبة، بعد السداد الكامل وتنفيذ الخدمة. لا مدفوعات تلقائية. ١٠٠ بند لكل صفحة.', loading: 'بنحمّل…', error: 'تعذر التنفيذ. راجع صلاحيات المدير وحاول تاني.', empty: 'مفيش عمولات متسجلة.', retry: 'حاول تاني', save: 'حفظ نسخة جديدة', saved: 'اتحفظت.', enabled: 'تفعيل العمولة للنشاط', currency: 'العملة', service: 'الخدمات', product: 'المنتجات', rate: 'النسبة أو المبلغ للوحدة', percentage: 'نسبة مئوية', fixed: 'مبلغ ثابت للوحدة', inherit: 'استخدام إعداد النشاط', none: 'بدون عمولة', employees: 'تفعيل كل موظف وإعداداته', reason: 'سبب التغيير', history: 'سجل العمولة', employee: 'الموظف', sale: 'البيع', estimate: 'تقدير', earned: 'مكتسبة', adjustments: 'تعديلات', postExport: 'تعديلات بعد التصدير/السداد', assignments: 'إسناد بنود المسودة', appointment: 'موعد مرتبط بالبيع', assign: 'حفظ الإسناد',
} : {
 noContext: 'Select a shop.', edit: 'Edit policy', title: 'Staff commissions', help: 'Optional and off by default. Net sales after discounts, before tax; earned only after full payment and fulfillment. No automatic payouts. 100 lines per page.', loading: 'Loading…', error: 'Unable to complete this action. Check manager access and retry.', empty: 'No commission history.', retry: 'Retry', save: 'Save new policy version', saved: 'Saved.', enabled: 'Enable shop commission', currency: 'Currency', service: 'Services', product: 'Products', rate: 'Percentage or amount per unit', percentage: 'Percentage', fixed: 'Fixed amount per unit', inherit: 'Use shop default', none: 'No commission', employees: 'Employee opt-in and overrides', reason: 'Reason for change', history: 'Commission history', employee: 'Employee', sale: 'Sale', estimate: 'Estimate', earned: 'Earned', adjustments: 'Adjustments', postExport: 'Adjustments after export/payment acknowledgment', assignments: 'Draft line attribution', appointment: 'Appointment linked to this sale', assign: 'Save attribution',
})
const { data, pending: loading, error, refresh } = useAsyncData(
 () => `shop-data:commission:${currentId.value ?? 'none'}:${invoiceId.value ?? 'all'}:${offset.value}`,
 async () => {
  if (!currentId.value) return null
  const result = await rpc.rpc('commission_history', { p_shop_id: currentId.value, p_invoice_id: invoiceId.value, p_offset: offset.value })
  if (result.error) throw result.error
  let assignments: BsCommissionAssignment[] = []
  if (invoiceId.value) {
   const context = await rpc.rpc('commission_assignment_context', { p_shop_id: currentId.value, p_invoice_id: invoiceId.value, p_offset: offset.value })
   if (!context.error) assignments = (context.data as { lines: BsCommissionAssignment[] }).lines
  }
  return { history: result.data as CommissionHistory, assignments }
 }, { watch: [currentId, invoiceId, offset], default: () => null },
)
const assignments = computed(() => data.value?.assignments ?? [])
watch(data, value => {
 const policy = value?.history.policy.policy
 const rateForm = (rate: CommissionRate | null | undefined, fallback: string) => ({ type: rate?.type ?? fallback, rate: String(rate?.rate ?? 0) })
 form.value = { enabled: policy?.enabled ?? false, currency: policy?.currency ?? businessCurrency.value ?? 'EGP', service: rateForm(policy?.service, 'percentage'), product: rateForm(policy?.product, 'percentage'), reason: '', employees: (value?.history.members ?? []).map(member => {
  const employee = policy?.employees.find(item => item.membershipId === member.id)
  return { id: member.id, name: member.name, enabled: employee?.enabled ?? false, service: rateForm(employee?.service, ''), product: rateForm(employee?.product, '') }
 }) }
}, { immediate: true })
const records = computed<BsCommissionRow[]>(() => (data.value?.history.lines ?? []).map(line => {
 const amount = (value: number) => new Intl.NumberFormat(locale.value, { style: 'currency', currency: line.currency }).format(value)
 return { id: line.id, employee: line.employeeName, sale: line.invoiceId, estimate: amount(line.estimate), earned: amount(line.earned), adjustments: amount(line.adjustments), postExport: amount(line.postExportAdjustments) }
}))
async function save() {
 if (!currentId.value || pending.value) return
 pending.value = true; actionError.value = false; saved.value = false
 try {
  const rate = (value: { type: string; rate: string }): CommissionRate | null => value.type ? { type: value.type as CommissionRate['type'], rate: Number(value.rate) } : null
  const policy: CommissionPolicy = { enabled: form.value.enabled, currency: form.value.currency, service: rate(form.value.service), product: rate(form.value.product), employees: form.value.employees.map(item => ({ membershipId: item.id, enabled: item.enabled, service: rate(item.service), product: rate(item.product) })) }
  const result = await rpc.rpc('save_commission_policy', { p_request_id: crypto.randomUUID(), p_shop_id: currentId.value, p_policy: policy, p_reason: form.value.reason })
  if (result.error) throw result.error
  await refresh(); policyAction.complete(); saved.value = true
 } catch { actionError.value = true } finally { pending.value = false }
}
async function assign(lineId: string, membershipId: string | null, appointmentId: string | null) {
 if (!currentId.value || pending.value) return
 pending.value = true; actionError.value = false
 try {
  const line = assignments.value.find(item => item.id === lineId)
  const employee = line?.itemType === 'service' ? line.appointments.find(item => item.id === appointmentId)?.membershipId ?? null : membershipId
  const fulfillment = line?.itemType === 'service' ? appointmentId : null
  const result = await rpc.rpc('assign_sale_commission', { p_shop_id: currentId.value, p_line_id: lineId, p_membership_id: employee, p_appointment_id: fulfillment })
  if (result.error) throw result.error
  await refresh(); saved.value = true
 } catch { actionError.value = true } finally { pending.value = false }
}
</script>
<template>
 <BsCommissionPolicyPage v-model:form="form" v-model:editor="editor" :dirty="dirty" :first="offset" :total-records="data?.history.totalCount ?? 0" :copy="copy" :available="Boolean(currentId)" :loading="loading" :error="Boolean(error)" :action-error="actionError" :pending="pending" :saved="saved" :records="records" :assignments="assignments" @save="save" @page="offset = $event" @assign="assign" @retry="actionError = false; refresh()" />
</template>
