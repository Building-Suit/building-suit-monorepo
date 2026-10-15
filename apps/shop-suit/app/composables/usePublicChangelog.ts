import type { ChangelogCopy, ChangelogFeed } from '@building-suit/contracts'
import { createChangelogClient } from '@building-suit/data-access'

/** Public environment-local transport. No preview, task or planned-release fallback. */
export function usePublicChangelog() {
  const { locale } = useI18n()
  const request = useRequestFetch()
  const client = createChangelogClient(signal => request('/api/changelog', { signal }))
  const { data, status, error, refresh } = useAsyncData('public-changelog:shop-suit', () => client.list({ suit: 'shop-suit', status: 'released' }), { server: false })
  // An empty error/loading snapshot is never interpreted as a published release or a clock source.
  const feed = computed<ChangelogFeed>(() => data.value ?? { serverNow: '1970-01-01T00:00:00Z', suits: [], entries: [] })
  const state = computed(() => error.value ? 'error' as const : status.value === 'pending' || status.value === 'idle' ? 'loading' as const : 'ready' as const)
  const copy = computed<ChangelogCopy>(() => locale.value === 'ar' ? {
    timeline: 'سجل التحديثات', suit: 'التطبيق', status: 'حالة الإصدار', allSuits: 'كل التطبيقات', allStatuses: 'كل الحالات', released: 'تم الإصدار', comingSoon: 'قريباً', targetVersion: 'الإصدار المستهدف', new: 'جديد', published: 'تاريخ النشر', releasedAt: 'تاريخ الإصدار', empty: 'لا توجد تحديثات منشورة بعد', loading: 'جار تحميل التحديثات', error: 'تعذر تحميل التحديثات', denied: 'الوصول غير مسموح', retry: 'إعادة المحاولة',
  } : {
    timeline: 'Changelog', suit: 'Suit', status: 'Release status', allSuits: 'All Suits', allStatuses: 'All statuses', released: 'Released', comingSoon: 'Coming Soon', targetVersion: 'Target version', new: 'New', published: 'Published', releasedAt: 'Released', empty: 'No published updates yet', loading: 'Loading updates', error: 'Unable to load updates', denied: 'Access denied', retry: 'Retry',
  })
  return { feed, state, copy, refresh }
}
