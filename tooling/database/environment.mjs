/** Validate local configuration only; live ownership and key validity require provider checks. */
export function validateEnvironment(registry, product, environment, app, secret) {
  if (!Object.hasOwn(registry.products, product || '') || !['production', 'staging'].includes(environment)) throw new Error('Select a registered product and production/staging environment')
  const selected = registry.products[product]
  const target = selected[environment]
  const ref = target.projectRef
  if (!ref || !/^[a-z]{20}$/.test(ref)) throw new Error('Enter the verified project ref in docs/architecture/environments.json')
  if (!selected.organizationId) throw new Error('Enter the verified organization ID in the environment registry')
  const products = Object.values(registry.products)
  const refs = products.flatMap(p => [p.production.projectRef, p.staging.projectRef]).filter(Boolean)
  if (new Set(refs).size !== refs.length) throw new Error('Each product/environment must use a different project ref')
  const organizations = products.map(p => p.organizationId).filter(Boolean)
  if (new Set(organizations).size !== organizations.length) throw new Error('Each product pair must use its own organization')
  if (product === 'shop-suit' && ref === registry.sources['shop-suit'].projectRef) throw new Error('The shared Shop source is not the dedicated target')
  if (secret.SUPABASE_PROJECT_REF !== ref || secret.SUPABASE_ORGANIZATION_ID !== selected.organizationId) throw new Error('Deployment file ref/organization does not match the selected registry entry')
  if (!secret.SUPABASE_ACCESS_TOKEN || /REPLACE|YOUR_/i.test(secret.SUPABASE_ACCESS_TOKEN)) throw new Error('Enter the deployment account access token')
  if (!secret.SUPABASE_DB_PASSWORD && !secret.SUPABASE_DB_URL) throw new Error('Enter this project’s database password or connection URL')
  if (app.APP_ENV !== environment) throw new Error('APP_ENV does not match the selected environment')
  const url = `https://${ref}.supabase.co`
  if (app.SUPABASE_URL !== url || app.NUXT_PUBLIC_SUPABASE_URL !== url) throw new Error('Frontend build/runtime URL does not match the selected project')
  for (const key of [app.SUPABASE_KEY, app.NUXT_PUBLIC_SUPABASE_KEY]) {
    let anonymous = false
    try { anonymous = JSON.parse(Buffer.from(key.split('.')[1], 'base64url')).role === 'anon' } catch { /* Prefer publishable keys. */ }
    if (typeof key !== 'string' || (!key.startsWith('sb_publishable_') && !anonymous) || /REPLACE|YOUR_/i.test(key)) throw new Error('Frontend configuration requires a real publishable/anon key, never a secret/service-role key')
  }
  if (app.NUXT_PUBLIC_SUPABASE_KEY !== app.SUPABASE_KEY) throw new Error('Build/runtime publishable keys differ')
  const prefix = `bs-${product.replace(/-suit$/, '')}-${environment}-auth-token`
  if (app.NUXT_PUBLIC_SUPABASE_COOKIE_PREFIX !== prefix) throw new Error('Cookie prefix must isolate the selected product and environment')
  let origin
  try { origin = new URL(target.appUrl) } catch { throw new Error('Enter the verified application origin in the environment registry') }
  if (origin.protocol !== 'https:' || origin.origin !== target.appUrl) throw new Error('Hosted appUrl must be an HTTPS origin without a path or trailing slash')
  const appOrigin = app[selected.appUrlVariable || 'APP_URL']
  if (appOrigin !== target.appUrl) throw new Error('Application origin does not match the selected environment')
  return `${product}/${environment}: local configuration matches. Verify live ownership, keys, migration history and backup before applying changes. No remote operation was performed.`
}
