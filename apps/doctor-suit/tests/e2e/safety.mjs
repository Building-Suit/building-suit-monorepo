export function assertLocalFixtureEnvironment(environment) {
  for (const key of Object.keys(environment)) {
    if (!/^(?:NUXT_PUBLIC_)?SUPABASE_URL$|^DOCTOR_TEST_BACKEND_URL$|^APP_URL$/.test(key) || !environment[key]) continue
    let url
    try { url = new URL(environment[key]) } catch { throw new Error(`Invalid local fixture URL: ${key}`) }
    if (url.protocol !== 'http:' || !['127.0.0.1', '[::1]', 'localhost'].includes(url.hostname)
      || url.username || url.password || url.search || url.hash || url.pathname !== '/') {
      throw new Error(`Remote or ambiguous fixture target rejected: ${key}`)
    }
  }
}
