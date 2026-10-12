/** App-owned registry data; selection is presentation state, never authority. */
export interface BsSuitRailItem {
  id: string
  label: string
  icon?: string
  logo?: string
  disabled?: boolean
}

export interface BsContextNavigationItem {
  id: string
  label: string
  icon?: string
  to?: string
  disabled?: boolean
}

export interface BsContextNavigationGroup {
  id: string
  label: string
  items: BsContextNavigationItem[]
}

export interface BsAdministrationShellLabels {
  suits: string
  navigation: string
  open: string
  close: string
  loading: string
  emptySuits: string
  emptyNavigation: string
}

