import type { BsOfflineCounterView } from '@building-suit/ui/types/offlineCounterPresentation'
import type { useOfflineCounter } from './useOfflineCounter'

export function useOfflineCounterView(counter: ReturnType<typeof useOfflineCounter>) {
  const { locale } = useI18n()
  return computed<BsOfflineCounterView>(() => {
    const ar = locale.value === 'ar'
    const state = ar ? { unsynced: 'غير متزامن', syncing: 'جارٍ المزامنة', failed: 'تعذر التزامن', synced: 'متزامن' } : { unsynced: 'Unsynced', syncing: 'Syncing', failed: 'Failed', synced: 'Synced' }
    return {
      notice: counter.storageError.value ? (ar ? 'التخزين المحلي غير متاح. احتفظ بهذه الصفحة مفتوحة ولا تسجل عمليات جديدة بدون اتصال.' : 'Local storage is unavailable. Keep this page open; offline recording is unavailable.')
        : counter.online.value ? (ar ? 'الاتصال متاح. العمليات المحلية تظل معلقة حتى يؤكدها الخادم.' : 'Online. Local transactions remain pending until confirmed by the server.')
          : (ar ? 'بدون اتصال. الكتالوج المحفوظ فقط متاح؛ المخزون والأسعار والتصاريح يتحقق منها الخادم عند المزامنة.' : 'Offline. Only cached catalog items are available; the server checks stock, prices and permissions on replay.'),
      retry: ar ? 'إعادة المحاولة بنفس معرف العملية' : 'Retry with the same request IDs',
      records: counter.records.value.map(record => ({ id: record.envelope.localId, label: `${record.sequence} · ${record.envelope.command.kind === 'sale' ? (ar ? 'بيع محلي' : 'Local sale') : record.envelope.command.kind === 'close' ? (ar ? 'إغلاق وردية' : 'Shift close') : (ar ? 'حركة نقدية' : 'Cash movement')}`, state: record.state, status: state[record.state], detail: record.error ? (ar ? 'راجع المخزون والسعر والوردية والصلاحيات. العملية محفوظة ولم يتم إسقاطها.' : 'Review stock, price, shift and permissions. This transaction is retained.') : '', receipt: record.state === 'synced' && record.envelope.command.kind === 'sale' && record.result ? `/sales/${record.result}/receipt` : null })),
    }
  })
}
