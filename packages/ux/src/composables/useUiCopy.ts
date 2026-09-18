import { uiMessages, type UiMessageKey } from '@building-suit/i18n'
export function useUiCopy() {
  const { locale } = useI18n()
  return (key: UiMessageKey) => uiMessages[locale.value === 'ar' ? 'ar' : 'en'][key]
}
