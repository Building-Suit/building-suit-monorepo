import type { BsWebsiteAddressView } from '@building-suit/ui/types/websiteAddressPresentation'
import type { ShopRpcDatabase } from '~/types/shopCrmRpc'
import { suggestWebsiteSlug, validWebsiteSlug, websiteUrl, configuredWebsiteDomain } from '#shared/websiteAddress'

export function useWebsiteAddress(canManage: Ref<boolean>) {
  const { currentId, current, currentLocationId } = useShop()
  const { locale } = useI18n()
  const user = useSupabaseUser()
  const actor = computed(() => user.value?.id ?? null)
  const config = useRuntimeConfig()
  const domain = configuredWebsiteDomain(config.public)
  const environment = config.public.supabase.url
  const captureScope = useShopTaskScope()
  const client = useSupabaseClient<ShopRpcDatabase>().schema('public')
  const slug = ref('')
  const success = ref('')
  const action = useRecordAction(() => slug.value)
  const { visible: open, dirty, pending, error } = action
  const { data, pending: loading, error: loadError, refresh } = useAsyncData(
    () => `shop-data:website-address:${JSON.stringify([environment, 'shop-crm', actor.value, currentId.value])}`,
    async () => {
      if (!currentId.value || !actor.value || !canManage.value) return null
      const isCurrent = captureScope()
      const response = await client.rpc('shop_website_address', { p_shop_id: currentId.value })
      if (response.error) throw response.error
      return isCurrent() ? response.data : null
    }, { server: false, watch: [currentId, currentLocationId, actor, canManage], default: () => null },
  )
  watch([currentId, currentLocationId, actor, canManage], () => { open.value = false; slug.value = ''; success.value = ''; error.value = '' })
  function edit() {
    if (!canManage.value || loading.value || loadError.value) return
    slug.value = data.value?.slug ?? suggestWebsiteSlug(current.value?.name ?? '', crypto.randomUUID().replaceAll('-', ''))
    success.value = ''; action.edit()
  }
  async function save() {
    const shopId = currentId.value
    const isCurrent = captureScope()
    if (!shopId || !canManage.value || !validWebsiteSlug(slug.value)) return
    const saved = await action.run(async () => {
      const response = await client.rpc('shop_website_address_save', { p_shop_id: shopId, p_slug: slug.value })
      if (response.error) throw response.error
      if (isCurrent() && shopId === currentId.value && canManage.value) await refresh()
    }, () => locale.value === 'ar' ? 'تعذر حفظ العنوان. راجع الصيغة أو جرّب عنواناً آخر.' : 'Could not save this address. Check the format or try another address.')
    if (saved && isCurrent() && shopId === currentId.value && canManage.value) success.value = locale.value === 'ar' ? 'تم حفظ العنوان بدون نشر الموقع.' : 'Address saved. Website remains unpublished.'
  }
  const view = computed<BsWebsiteAddressView>(() => {
    const ar = locale.value === 'ar'
    return {
      title: ar ? 'عنوان موقع المتجر' : 'Shop website address',
      help: ar ? 'العنوان مستقل عن اسم المتجر. الموقع غير منشور في هذه المرحلة. العناوين السابقة تظل محجوزة لنفس المتجر.' : 'The address is separate from your display name. Websites are unpublished in this phase. Previous addresses stay reserved to this Shop.',
      label: ar ? 'العنوان المختصر' : 'Address slug',
      currentUrl: canManage.value && data.value && domain ? websiteUrl(data.value.slug, domain) : '',
      aliases: canManage.value && domain ? (data.value?.aliases ?? []).map(slug => websiteUrl(slug, domain)) : [],
      loading: loading.value, failed: Boolean(loadError.value), denied: !canManage.value,
      pending: pending.value, dirty: dirty.value, error: error.value ?? '', success: success.value,
      submitDisabled: !canManage.value || !validWebsiteSlug(slug.value) || slug.value === data.value?.slug,
      loadingLabel: ar ? 'جارٍ التحميل' : 'Loading', failedLabel: ar ? 'تعذر تحميل العنوان.' : 'Could not load address.',
      deniedLabel: ar ? 'تحتاج صلاحية إدارة الإعدادات.' : 'Settings permission required.', retry: ar ? 'حاول تاني' : 'Retry',
      edit: ar ? 'تعديل العنوان' : 'Edit address', save: ar ? 'حفظ العنوان' : 'Save address', cancel: ar ? 'إلغاء' : 'Cancel',
      rules: ar ? 'من 3 إلى 50 حرفاً إنجليزياً صغيراً أو رقماً، وشرطات بين الكلمات. بعض الأسماء محجوزة.' : '3–50 lowercase ASCII letters or digits, with hyphens between words. Some names are reserved.',
    }
  })
  return { slug, open, view, edit, save, refresh }
}
