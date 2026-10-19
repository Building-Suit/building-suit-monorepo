import { consentKey, readPrivacyPreference, privacyPreference, removeAnalyticsCookies } from '@building-suit/ux'
import type { PrivacyPreference, PrivacyPresentation } from '@building-suit/ux'
import { isPublicPath } from '#shared/publicSeo'
export function useShopPrivacy(initialize = false) {
  const preference = useShopState<PrivacyPreference | null>('shop-privacy', () => null)
  const ready = useShopState('shop-privacy-ready', () => false)
  const settings = useShopState('shop-privacy-settings', () => false)
  const draft = useShopState('shop-privacy-draft', () => false)
  const { locale } = useI18n()
  const router = useRouter()
  const user = useSupabaseUser()
  const config = useRuntimeConfig()
  let memoryOnly = false
  let expiryTimer: ReturnType<typeof setTimeout> | undefined
  function scheduleExpiry() {
    clearTimeout(expiryTimer)
    if (preference.value) {
      const remaining = preference.value.savedAt + 180 * 24 * 60 * 60 * 1000 - Date.now()
      expiryTimer = setTimeout(restore, Math.max(0, Math.min(remaining, 2147483647)))
    }
  }
  function clearOptionalStorage() {
    removeAnalyticsCookies(document, location.hostname)
    try { sessionStorage.removeItem('bs-shop.analytics.signup') } catch { /* storage may be blocked */ }
  }
  function restore() {
    if (memoryOnly) preference.value = readPrivacyPreference(JSON.stringify(preference.value))
    else {
      try { preference.value = readPrivacyPreference(localStorage.getItem(consentKey)) } catch { preference.value = null }
    }
    if (!preference.value?.analytics) clearOptionalStorage()
    if (!settings.value) draft.value = preference.value?.analytics === true
    ready.value = true
    scheduleExpiry()
  }
  function save(analytics: boolean) {
    preference.value = privacyPreference(analytics)
    try { localStorage.setItem(consentKey, JSON.stringify(preference.value)); memoryOnly = false } catch { memoryOnly = true }
    draft.value = analytics
    settings.value = false
    scheduleExpiry()
    if (!analytics) clearOptionalStorage()
  }
  if (initialize) {
    const storage = (event: StorageEvent) => { if (event.key === consentKey || event.key === null) restore() }
    onMounted(() => {
      restore()
      window.addEventListener('storage', storage); window.addEventListener('focus', restore); window.addEventListener('pageshow', restore)
    })
    onBeforeUnmount(() => {
      clearTimeout(expiryTimer)
      window.removeEventListener('storage', storage); window.removeEventListener('focus', restore); window.removeEventListener('pageshow', restore)
    })
  }
  return computed<PrivacyPresentation>(() => ({
    showReopen: false, ready: ready.value, prompt: !preference.value && !user.value && isPublicPath(router.currentRoute.value.path, config.public.changelogAvailable), settings: settings.value, analytics: draft.value,
    open: () => { draft.value = preference.value?.analytics === true; settings.value = true },
    close: () => { settings.value = false }, save, change: value => { draft.value = value },
    copy: locale.value === 'ar' ? {
      title: 'خيارات الخصوصية', body: 'نستخدم تخزيناً ضرورياً لتسجيل الدخول وتفضيلات اللغة والمظهر. تحليلات Google الاختيارية متوقفة حتى توافق. يمكنك الرفض واستخدام الخدمة وتغيير اختيارك لاحقاً.',
      accept: 'قبول الاختياري', reject: 'رفض الاختياري', settings: 'إعدادات الخصوصية', necessary: 'التخزين الضروري: جلسة الدخول واللغة والمظهر وحفظ خيار الخصوصية لمدة 180 يوماً. لا يتم تعطيل تسجيل الدخول عند رفض التحليلات.',
      analytics: 'تحليلات Google الاختيارية لقياس الصفحات العامة', save: 'حفظ الاختيار', policy: 'سياسة الخصوصية وملفات الارتباط',
    } : {
      title: 'Privacy choices', body: 'We use necessary storage for sign-in, language and theme preferences. Optional Google Analytics stays off until you accept. You can reject, use the service and change your choice later.',
      accept: 'Accept optional', reject: 'Reject optional', settings: 'Privacy settings', necessary: 'Necessary storage: sign-in session, language, theme and your privacy choice for 180 days. Rejecting analytics does not disable sign-in.',
      analytics: 'Optional Google Analytics for public pages', save: 'Save choices', policy: 'Privacy and cookie policy',
    },
  }))
}
