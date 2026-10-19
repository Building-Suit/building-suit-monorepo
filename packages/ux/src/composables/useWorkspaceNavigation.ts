/** Shared shell navigation, route dismissal and trigger focus restoration. */
export function useWorkspaceNavigation() {
  const route = useRoute()
  const mobileNavOpen = ref(false)
  const navigationTrigger = ref<HTMLButtonElement | null>(null)
  const topHeader = ref<{ focusNavigationTrigger: () => void } | null>(null)
  useTheme()
  async function closeMobileNav(restoreFocus = true) {
    mobileNavOpen.value = false
    if (restoreFocus) {
      await nextTick()
      if (navigationTrigger.value) navigationTrigger.value.focus()
      else topHeader.value?.focusNavigationTrigger()
    }
  }
  watch(() => route.fullPath, () => {
    if (mobileNavOpen.value) void closeMobileNav(false)
  })
  const isActive = (to: string) => route.path === to || route.path.startsWith(`${to}/`)
  return { mobileNavOpen, navigationTrigger, topHeader, closeMobileNav, isActive }
}
