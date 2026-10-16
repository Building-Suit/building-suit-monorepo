# Shop website hostname suffix

Deployment configuration selects exactly one owned public namespace. It never comes from a tenant profile, request body, query string, forwarded header or resolver response. Stored slug claims and public RPC contracts remain host-independent; there is no database migration.

| Environment | Accepted suffix | Public URL |
| --- | --- | --- |
| Production | `shops.building-suit.com` (default) | `https://{slug}.shops.building-suit.com` |
| Staging | `stg.shops.building-suit.com` (explicitly required) | `https://{slug}.stg.shops.building-suit.com` |
| Local fixture/development | Either owned suffix; empty defaults to production | Loopback transport only in tests |

Only these two exact lowercase ASCII suffix strings are accepted. URLs, wildcard strings, ports, trailing dots, whitespace, Unicode/punycode variants, IPs and arbitrary domains are rejected. Production cannot select staging, and staging cannot select production. Missing staging configuration fails closed for public hosts; the configured private app and loopback health/test authority remain available. Unknown environment names also deny public hosts.

## Exact application configuration

Set the following on the respective deployment, using the existing approved environment mechanism. These are non-secret settings. This PR does not apply them, pull credentials, deploy or modify a provider.

Production:

```dotenv
APP_ENV=production
APP_URL=https://shop.building-suit.com
NUXT_PUBLIC_APP_ENVIRONMENT=production
NUXT_PUBLIC_APP_URL=https://shop.building-suit.com
NUXT_PUBLIC_WEBSITE_HOSTNAME_SUFFIX=shops.building-suit.com
```

Staging:

```dotenv
APP_ENV=staging
APP_URL=https://stg.shop.building-suit.com
NUXT_PUBLIC_APP_ENVIRONMENT=staging
NUXT_PUBLIC_APP_URL=https://stg.shop.building-suit.com
NUXT_PUBLIC_WEBSITE_HOSTNAME_SUFFIX=stg.shops.building-suit.com
```

Private origins above are the maintained [environment registry](../../../docs/architecture/environments.json) values; do not set `APP_URL` to a public tenant or wildcard. Keep build-time `APP_ENV`/`APP_URL` and runtime `NUXT_PUBLIC_APP_ENVIRONMENT`/`NUXT_PUBLIC_APP_URL` consistent. Existing private Auth cookie-prefix configuration is built from `APP_ENV`; this task does not change it. Keep each deployment's existing Supabase endpoint, publishable key, Auth and data in its own environment; do not copy production credentials/data into staging.

`runtimeConfig.public.websiteHostnameSuffix` is declared with an empty default and receives its native `NUXT_PUBLIC_WEBSITE_HOSTNAME_SUFFIX` override at runtime. Production/local preserve the previous default; staging requires an explicit value. A differently named unprefixed runtime variable is not an alias. Nuxt documents [runtime overrides and public configuration](https://nuxt.com/docs/4.x/guide/going-further/runtime-config#environment-variables).

Changing a deployment suffix requires a normal approved configuration/deployment cycle and fresh host smoke checks. It does not rename stored slugs or reclaim another Shop's aliases. Public owner previews, canonical/hreflang/pagination, robots/sitemap, booking/portal links, redirects and POST Origin checks all use the same validated suffix. Staging remains noindex with a disallowed robots policy and empty sitemap; production indexing behavior is unchanged. Invalid configuration produces no invented production preview URL in owner settings.

## Separate staging DNS, TLS and ingress requirements

The parent has verified the production wildcard certificate issued; no production DNS/certificate work is requested here.

The staging operator follow-on must bind **`*.stg.shops.building-suit.com`** to the approved staging application/ingress, using the exact staging target supplied by that provider. If the provider uses a CNAME, the record owner is `*.stg.shops.building-suit.com`; its target is the provider-issued staging hostname, not the production target. No target is guessed or configured in this PR. Keep the private `stg.shop.building-suit.com` binding separate. Bare suffix/apex requests are denied by the application.

Provision/verify a separate staging certificate containing **`*.stg.shops.building-suit.com`**. The production certificate for `*.shops.building-suit.com` does not cover that additional label: TLS wildcards match one complete leftmost label. See [RFC 9525 §6.3](https://www.rfc-editor.org/rfc/rfc9525.html#section-6.3). If the chosen provider requires DNS-01 delegation, its staging challenge owner is `_acme-challenge.stg.shops.building-suit.com`, distinct from the production challenge; use only the provider's exact instructions/issued target.

DNS wildcard synthesis and TLS wildcard matching are different mechanisms. An explicit staging wildcard/closest-encloser arrangement is required rather than relying on production wildcard fallback; see [RFC 4592](https://www.rfc-editor.org/rfc/rfc4592.html). This document does not claim current staging DNS, TLS or provider bindings are configured.

Ingress must preserve the verified HTTP authority and run the public/private routing boundary before any private page/API/static asset response. The application ignores `Forwarded`, `X-Forwarded-Host` and client tenant headers. A production host on staging, a staging host on production, an extra tenant label, port, reserved slug or malformed authority fails closed before any tenant RPC. Do not put both public namespaces on one environment as aliases. Provider static routing/CDN behavior must be checked separately after an approved deployment.

## Deterministic qualification and follow-on smoke

- Pure tests cover exact suffix/environment combinations, malformed configuration/authorities, private-host separation and every URL helper.
- Built HTTP tests start production and staging servers with distinct loopback synthetic backends. They verify two tenants, canonical/alias/SEO URLs, cross-suffix/cross-tenant Origin rejection for all four public write/read API families, host-only environment-prefixed cookies, cross-environment token denial, invalid config without backend access, and unpublish/logout.
- EN/AR phone/desktop browser journeys verify staging URL navigation through booking and portal. Owner tests verify staged current/alias/profile preview URLs. Existing production HTTP and launch browsers run unchanged. The new staging browser transport uses loopback, aborts unknown requests/redirects, and tests alias redirects separately over loopback HTTP; it does not disable certificate validation or depend on real staging DNS.
- Existing disposable SQL launch/domain gates preserve tenant permissions, publication readiness and capability scope. No new SQL or hosted write is needed.

After provider configuration and normal deployment are separately authorized, verify the exact deployed SHA, staging certificate chain/SAN, both staging tenants and aliases, staging noindex/cache headers, production-host denial on staging (and converse), private routes/static data exclusion, all public POST Origin checks and immediate unpublish. These actual-host/provider smoke checks are **NOT RUN** by this PR. No real customer publication or messaging is performed.
