/** Use committed router metadata, so an outgoing auth tree cannot own a protected page. */
export function doctorRootPresentation(path: string, layout: unknown) {
  const authEntry = /^\/(?:sign-in|sign-up|recover|verify)\/?$/.test(path)
  return {
    layoutKey: authEntry ? 'doctor-auth-entry' : `doctor-layout-${typeof layout === 'string' ? layout : layout === false ? 'standalone' : 'default'}`,
    pageTransition: authEntry ? { name: 'bs-auth-route', mode: 'out-in' as const } : false as const,
  }
}
