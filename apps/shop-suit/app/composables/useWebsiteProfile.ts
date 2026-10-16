import { readPublicLogo } from '@building-suit/ux'
import type { BsWebsiteProfileView } from '@building-suit/ui/types/websiteProfilePresentation'
import type { ShopRpcDatabase } from '~/types/shopCrmRpc'
import { emptyWebsiteProfile, parseWebsiteProfileSettings, type WebsiteProfileSettings } from '#shared/websiteProfile'
import { websiteUrl } from '#shared/websiteAddress'

export function useWebsiteProfile(canManage: Ref<boolean>) {
  const { currentId, currentLocationId, activeLocations, isOwner } = useShop()
  const { locale } = useI18n()
  const user = useSupabaseUser()
  const actor = computed(() => user.value?.id ?? null)
  const environment = useRuntimeConfig().public.supabase.url
  const client = useSupabaseClient<ShopRpcDatabase>().schema('public')
  const captureScope = useShopTaskScope()
  const form = ref(emptyWebsiteProfile())
  const optIn = ref(false)
  const success = ref('')
  const logoPending = ref(false)
  const action = useRecordAction(() => form.value)
  const { visible: open, pending, dirty, error } = action
  const { data, pending: loading, error: loadError, refresh } = useAsyncData(
    () => `shop-data:website-profile:${JSON.stringify([environment, 'shop-crm', actor.value, currentId.value])}`,
    async () => {
      if (!currentId.value || !actor.value || !canManage.value) return null
      const isCurrent = captureScope()
      const response = await client.rpc('shop_website_profile', { p_shop_id: currentId.value })
      if (response.error) throw response.error
      return isCurrent() ? parseWebsiteProfileSettings(response.data) : null
    }, { server: false, watch: [currentId, currentLocationId, actor, canManage], default: () => null },
  )
  watch([currentId, currentLocationId, actor, canManage], () => { open.value = false; form.value = emptyWebsiteProfile(); optIn.value = false; success.value = ''; error.value = '' }, { flush: 'sync' })
  watch(isOwner, () => { optIn.value = false })
  const safeError = () => locale.value === 'ar' ? 'تعذر حفظ الملف العام. راجع الحقول والصلاحيات وحاول مرة أخرى.' : 'Could not save the public profile. Check fields and permissions, then retry.'
  function edit() {
    if (!canManage.value || loading.value || loadError.value || !data.value?.slug) return
    form.value = { ...emptyWebsiteProfile(), ...structuredClone(data.value.draft) }
    success.value = ''; optIn.value = false; action.edit()
  }
  async function save() {
    const shopId = currentId.value
    const isCurrent = captureScope()
    if (!shopId || !canManage.value || logoPending.value) return
    const saved = await action.run(async () => {
      const response = await client.rpc('shop_website_profile_save', { p_shop_id: shopId, p_profile: form.value })
      if (response.error) throw response.error
      if (isCurrent() && canManage.value) data.value = parseWebsiteProfileSettings(response.data)
    }, safeError)
    if (saved && isCurrent() && canManage.value) success.value = locale.value === 'ar' ? 'تم حفظ المسودة. لم يتم نشر التغييرات.' : 'Draft saved. Changes have not been published.'
  }
  async function logo(file: File | File[] | null) {
    const selected = Array.isArray(file) ? file[0] : file
    const shopId = currentId.value
    const isCurrent = captureScope()
    if (!shopId || !canManage.value || pending.value || logoPending.value) return
    logoPending.value = true; error.value = ''; optIn.value = false
    try {
      const image = selected ? await readPublicLogo(selected) : null
      if (!isCurrent() || !canManage.value) return
      const response = await client.rpc('shop_website_logo_replace', { p_shop_id: shopId, p_data_url: image })
      if (response.error) throw response.error
      if (isCurrent() && canManage.value) data.value = parseWebsiteProfileSettings(response.data)
    } catch {
      if (isCurrent()) error.value = locale.value === 'ar' ? 'اختر صورة PNG أو JPEG أو WebP صحيحة حتى 128 كيلوبايت و2048 بكسل.' : 'Choose a valid PNG, JPEG or WebP up to 128 KiB and 2048 pixels.'
    } finally { logoPending.value = false }
  }
  async function publish() {
    const shopId = currentId.value
    const isCurrent = captureScope()
    if (!shopId || !view.value.canPublish || !optIn.value) return
    await action.run(async () => {
      const response = await client.rpc('shop_website_profile_publish', { p_shop_id: shopId, p_owner_opt_in: optIn.value })
      if (response.error) throw response.error
      if (isCurrent() && canManage.value) { data.value = parseWebsiteProfileSettings(response.data); optIn.value = false }
    }, safeError)
  }
  async function unpublish() {
    const shopId = currentId.value
    const isCurrent = captureScope()
    if (!shopId || !canManage.value || pending.value || logoPending.value) return
    const saved = await action.run(async () => {
      const response = await client.rpc('shop_website_profile_unpublish', { p_shop_id: shopId })
      if (response.error) throw response.error
      if (isCurrent() && canManage.value) { data.value = parseWebsiteProfileSettings(response.data); optIn.value = false }
    }, safeError)
    if (saved && isCurrent()) success.value = locale.value === 'ar' ? 'تم إلغاء النشر مع الاحتفاظ بالإعدادات.' : 'Unpublished. Your configuration is retained.'
  }
  const view = computed<BsWebsiteProfileView>(() => {
    const ar = locale.value === 'ar'
    const result: WebsiteProfileSettings | null = canManage.value ? data.value : null
    const missingLabels: Record<string, string> = ar
      ? { address: 'احفظ عنوان الموقع أولاً.', publicName: 'أضف الاسم العام.', description: 'أضف وصفاً قصيراً.', logo: 'أضف شعاراً.', contact: 'أضف وسيلة اتصال عامة مستقلة.', location: 'حدد موقعاً نشطاً ظاهراً مع اسم وعنوان عامين.', publishedItem: 'يلزم منتج أو خدمة منشورة.' }
      : { address: 'Save a website address first.', publicName: 'Add a public name.', description: 'Add a short description.', logo: 'Add a logo.', contact: 'Add an independently configured public contact.', location: 'Make an active location visible with a public name and address.', publishedItem: 'A published product or service is required.' }
    return {
      title: ar ? 'الملف العام للمتجر' : 'Public shop profile',
      help: ar ? 'ابدأ بمسودة مستقلة. لا يتم نسخ بيانات التشغيل أو الاتصال الخاصة. يتطلب النشر موافقة المالك واستيفاء متطلبات النشر.' : 'Start with a separate draft. Private operational and contact details are never copied. Publishing requires owner consent and all publishing requirements.',
      state: result?.state === 'published' ? (ar ? 'منشور' : 'Published') : result?.state === 'suspended' ? (ar ? 'موقوف' : 'Suspended') : (ar ? 'مسودة غير منشورة' : 'Unpublished draft'),
      url: result?.slug ? websiteUrl(result.slug) : '', logo: result?.logoDataUrl ?? '',
      missing: (result?.missing ?? []).map(key => missingLabels[key] ?? key),
      loading: loading.value, failed: Boolean(loadError.value), denied: !canManage.value,
      pending: pending.value || logoPending.value, dirty: dirty.value, error: error.value ?? '', success: success.value,
      canConsent: canManage.value && isOwner.value,
      canEdit: Boolean(canManage.value && result?.slug),
      canPublish: Boolean(canManage.value && isOwner.value && result?.catalog.integration === 'ready' && result.catalog.publishedItemCount > 0 && result.missing.length === 0 && result.state !== 'suspended' && !open.value && !logoPending.value),
      canUnpublish: Boolean(canManage.value && result?.state === 'published'),
      locationOptions: [
        ...activeLocations.value.map(l => ({ id: l.id, label: l.name, canShow: true })),
        ...(result?.draft.locations ?? []).filter(l => !activeLocations.value.some(active => active.id === l.id)).map(l => ({
          id: l.id, canShow: false,
          label: `${l.publicName || (ar ? 'موقع محفوظ' : 'Saved location')} (${ar ? 'مؤرشف أو غير متاح — يمكن إخفاؤه' : 'archived or unavailable — hide to keep editing'})`,
        })),
      ],
      copy: ar ? {
        loading: 'جارٍ التحميل', failed: 'تعذر تحميل الملف العام.', denied: 'تحتاج صلاحية إدارة الإعدادات.', retry: 'حاول تاني', edit: 'تعديل المسودة', save: 'حفظ المسودة', cancel: 'إلغاء', publish: 'نشر', unpublish: 'إلغاء النشر', optIn: 'بصفتي المالك، أوافق صراحة على نشر هذا الملف وبياناته العامة.', logo: 'الشعار العام', logoHelp: 'PNG أو JPEG أو WebP حتى 128 كيلوبايت و2048 بكسل. يتم حفظ الشعار فور اختياره للمسودة فقط.', removeLogo: 'إزالة الشعار', publicName: 'الاسم العام', description: 'وصف قصير', phone: 'هاتف عام', whatsapp: 'واتساب عام (رمز البلد والأرقام)', email: 'بريد إلكتروني عام', openingHours: 'مواعيد العمل العامة', seoTitle: 'عنوان محركات البحث', seoDescription: 'وصف محركات البحث', locations: 'المواقع العامة (لا تظهر تلقائياً)', visible: 'إظهار الموقع', address: 'العنوان العام', readiness: 'متطلبات النشر', catalogPending: 'انشر منتجاً أو خدمة واحدة على الأقل في الكتالوج العام قبل نشر الملف.'
      } : {
        loading: 'Loading', failed: 'Could not load public profile.', denied: 'Settings permission required.', retry: 'Retry', edit: 'Edit draft', save: 'Save draft', cancel: 'Cancel', publish: 'Publish', unpublish: 'Unpublish', optIn: 'As the owner, I explicitly agree to publish this profile and its public details.', logo: 'Public logo', logoHelp: 'PNG, JPEG or WebP up to 128 KiB and 2048 pixels. Choosing a logo saves it immediately to the draft only.', removeLogo: 'Remove logo', publicName: 'Public name', description: 'Short description', phone: 'Public phone', whatsapp: 'Public WhatsApp (country code and digits)', email: 'Public email', openingHours: 'Public opening hours', seoTitle: 'Search engine title', seoDescription: 'Search engine description', locations: 'Public locations (hidden by default)', visible: 'Show location', address: 'Public address', readiness: 'Publishing requirements', catalogPending: 'Publish at least one product or service in the public catalog before publishing the profile.'
      },
    }
  })
  return { form, optIn, open, view, edit, save, logo, publish, unpublish, refresh }
}
