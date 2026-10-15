import type { BsOfflineCounterView } from '@building-suit/ui/types/offlineCounterPresentation'
import type { useOfflineCounter } from './useOfflineCounter'

export function useOfflineCounterView(counter: ReturnType<typeof useOfflineCounter>) {
  const { locale } = useI18n()
  const { businessCurrency } = useShop()
  return computed<BsOfflineCounterView>(() => {
    const ar = locale.value === 'ar'
    const newestSequence = counter.records.value.reduce((maximum, record) => Math.max(maximum, record.sequence), 0)
    const state = ar ? { unsynced: 'غير متزامن', syncing: 'جارٍ المزامنة', failed: 'تعذر التزامن', synced: 'متزامن' } : { unsynced: 'Unsynced', syncing: 'Syncing', failed: 'Failed', synced: 'Synced' }
    return {
      notice: counter.recoveryError.value ? (ar ? 'لم يتم تأكيد نتيجة الخادم. العملية محفوظة؛ أعد فحصها قبل تسوية أي أموال.' : 'Server outcome could not be confirmed. The transaction is retained; check again before reconciling money.') : counter.storageError.value ? (ar ? 'التخزين المحلي غير متاح. احتفظ بهذه الصفحة مفتوحة ولا تسجل عمليات جديدة بدون اتصال.' : 'Local storage is unavailable. Keep this page open; offline recording is unavailable.')
        : counter.online.value ? (ar ? 'الاتصال متاح. العمليات المحلية تظل معلقة حتى يؤكدها الخادم.' : 'Online. Local transactions remain pending until confirmed by the server.')
          : (ar ? 'بدون اتصال. أصناف الكتالوج المحفوظة والوردية المفتوحة المحفوظة متاحة. البحث عن العملاء والسجل الكامل يحتاجان اتصالًا. يتحقق الخادم من المخزون والأسعار والصلاحيات عند المزامنة.' : 'Offline. Previously viewed catalog items and the saved open shift are available. Customer search and full history require connection. The server checks stock, prices and permissions on replay.'),
      reconcile: ar ? 'فحص النتيجة وتسوية العملية' : 'Check outcome and reconcile',
      retry: ar ? 'إعادة المحاولة بنفس معرف العملية' : 'Retry with the same request IDs',
      records: counter.records.value.filter(record => (record.state !== 'synced' && record.resolution?.phase !== 'reconciled') || record.sequence > newestSequence - 200).map(record => ({ id: record.envelope.localId, label: `${record.sequence} · ${record.envelope.command.kind === 'service' ? (ar ? 'تنفيذ خدمة' : 'Service fulfillment') : record.envelope.command.kind === 'sale' ? (ar ? 'بيع محلي' : 'Local sale') : record.envelope.command.kind === 'close' ? (ar ? 'إغلاق وردية' : 'Shift close') : (ar ? 'حركة نقدية' : 'Cash movement')} · ${record.envelope.command.kind === 'service' ? String(record.envelope.command.args.p_quantity) : new Intl.NumberFormat(ar ? 'ar-EG' : 'en-EG', { style: 'currency', currency: businessCurrency.value, maximumFractionDigits: 20 }).format(Number(record.envelope.command.kind === 'close' ? record.envelope.command.args.p_counted_amount : record.envelope.command.args.p_amount))}`, state: record.state, canRetry: !record.resolution, isResolved: record.resolution?.phase === 'reconciled', canReconcile: (counter.online.value || record.resolution?.phase === 'cancelled') && !counter.busy.value && record.state !== 'synced' && record.resolution?.phase !== 'reconciled', status: record.resolution?.phase === 'reconciled' ? (ar ? 'تمت التسوية؛ لم تُسجل العملية' : 'Reconciled; not posted') : record.resolution?.phase === 'cancelled' ? (ar ? 'أُلغيت بالخادم؛ تأكيد التسوية مطلوب' : 'Cancelled at server; reconciliation acknowledgement required') : state[record.state], detail: record.resolution?.phase === 'reconciled' ? (ar ? 'حُفظت العملية والتسوية. لم تُسجل قيود مالية جديدة.' : 'The transaction and reconciliation are retained. No new financial entry was posted.') : record.error ? (ar ? 'راجع المخزون والسعر والوردية والصلاحيات. العملية محفوظة ولم يتم إسقاطها.' : 'Review stock, price, shift and permissions. This transaction is retained.') : '', receipt: record.state === 'synced' && record.envelope.command.kind === 'sale' && record.result ? `/sales/${record.result}/receipt` : null })),
    }
  })
}
