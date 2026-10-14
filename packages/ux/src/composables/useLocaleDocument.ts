/** Keep locale metadata and typography consistent across independently configured Suits. */
export function useLocaleDocument() {
  const head = useLocaleHead()
  const { locale } = useI18n()
  useHead(() => ({
    htmlAttrs: { lang: head.value.htmlAttrs?.lang || locale.value, dir: head.value.htmlAttrs?.dir || (locale.value === 'ar' ? 'rtl' : 'ltr') },
    link: [...(head.value.link || [])],
    meta: [...(head.value.meta || [])],
  }))
}
