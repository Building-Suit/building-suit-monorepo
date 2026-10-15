/** Keep locale metadata and typography consistent across independently configured Suits. */
export function useLocaleDocument(options: { documentLinks?: boolean } = {}) {
  const head = useLocaleHead()
  const { locale } = useI18n()
  useHead(() => ({
    htmlAttrs: { lang: head.value.htmlAttrs?.lang || locale.value, dir: head.value.htmlAttrs?.dir || (locale.value === 'ar' ? 'rtl' : 'ltr') },
    link: options.documentLinks === false ? [] : [...(head.value.link || [])],
    meta: [...(head.value.meta || [])],
  }))
}
