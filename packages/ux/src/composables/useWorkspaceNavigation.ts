/** Shared shell navigation, route dismissal and trigger focus restoration. */
export function useWorkspaceNavigation() {
  const route = useRoute()
  const mobileNavOpen = ref(false)
  const topHeader = ref<{ focusNavigationTrigger: () => void } | null>(null)
  useTheme()
  async function closeMobileNav(restoreFocus = true) {
    mobileNavOpen.value = false
    if (restoreFocus) {
      await nextTick()
      topHeader.value?.focusNavigationTrigger()
    }
  }
  watch(() => route.fullPath, () => {
    if (mobileNavOpen.value) void closeMobileNav(false)
  })
  const isActive = (to: string) => route.path === to || route.path.startsWith(`${to}/`)
  return { mobileNavOpen, topHeader, closeMobileNav, isActive }
}
