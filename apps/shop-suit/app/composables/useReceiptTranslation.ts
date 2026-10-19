/** Receipt language is independent of the interface language. Load both lazy dictionaries. */
export function useReceiptTranslation() {
  const { t, te, locale, loadLocaleMessages } = useI18n()
  const loaded = ref(0)
  async function prepare() {
    await Promise.allSettled((['en', 'ar'] as const).map(language => loadLocaleMessages(language)))
    loaded.value++
  }
  onMounted(() => { void prepare() })
  return (key: string, language: string) => {
    // Depend on completion even if the framework's lazy message object is replaced.
    void loaded.value
    return t(key, {}, { locale: te(key, language) ? language : locale.value })
  }
}
