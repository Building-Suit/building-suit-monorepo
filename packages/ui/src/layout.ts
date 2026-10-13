/** Shared semantic container options; values are resolved by the UI stylesheet. */
export interface BsLayoutProps {
  padding?: 'none' | 'xs' | 'sm' | 'md' | 'lg' | 'xl'
  surface?: 'none' | 'default' | 'muted' | 'raised'
  border?: boolean
  radius?: 'none' | 'control' | 'card' | 'round'
  visibility?: 'all' | 'mobile' | 'desktop'
  grow?: boolean
  overflow?: 'visible' | 'hidden'
  span?: 1 | 2 | 3 | 4 | 5
}
