# Shop public SEO and privacy controls

Status: implemented in draft PR [#320](https://github.com/Building-Suit/building-suit-monorepo/pull/320); deployment and owner account setup remain separate.

## Ownership and scope

Shop owns the route/event allowlists and successful-new-shop adapter. `packages/ui` owns `BsPrivacyConsent`, the root host and pricing-link activation presentation. `packages/ux` owns preference validation, focus restoration, GA-cookie cleanup and the basic consent-gated transport. Other products do not enable the control merely by sharing `BsAppRoot`. The documentation catalogue has an inert demonstration.

This change does not alter authenticated authorization, checkout, ETA, returns, database schemas or provider configuration. Paid subscription conversion is **disabled**: no redirect, checkout start, saved browser state or trial is reported as a purchase. A safe future paid event needs an authoritative, deduplicated subscription-activation signal and an approved privacy contract; do not add payment, order or shop identifiers to GA.

Repository `AGENTS.md`, Shop/UI instructions and shared UI specifications were read. This saved environment has no `.agents/skills/frontend` or other executable frontend SKILL.md; the available `.agents` mount is empty. Archived prototype skills are not current application guidance.

## Indexing and languages

- Indexing is enabled only when the request origin is exactly `https://shop.building-suit.com` and `APP_ENV=production` (runtime `public.appEnvironment`). Before any later production release, verify the existing production environment value. Missing/unknown values fail closed. Preserve production indexing by configuring the production environment correctly; never set the staging project to production.
- Nitro middleware sends `X-Robots-Tag: noindex, nofollow` on other environments/hosts and non-public paths. Reactive robots metadata agrees with that policy. Robots remains crawlable, including staging, so Google can see `noindex` on its previously indexed staging homepage. Robots is not an access boundary; existing session/portal enforcement remains authoritative.
- `/sitemap.xml` is served by Nitro and includes only existing public canonical documents: `/`, `/about`, `/contact`, `/terms`, `/privacy`, `/delivery-shipping`, `/refund-cancellation`. `/pricing` is not a real route and is excluded. Staging/preview sitemaps contain no URLs. No user, authenticated, billing, callback or operational URL is included.
- #318 owns `/changelog` and its landing section. A build-time check adds that known public route to SEO/analytics eligibility and the sitemap **only when its actual Vue route file is present**. There is no dangling sitemap entry in this branch. Preserve #318's public route/auth allowlists when combining the two stacks; do not merge its backend feed just to obtain SEO coverage.
- Public canonical URLs always use the production origin and omit query/fragment values. Shop disables the locale composable's generated document links and supplies one canonical owner; other products retain their existing behavior.
- `no_prefix` Arabic/English routing is preserved. Both languages share one canonical document; there are no misleading same-URL hreflang alternatives. The actual rendered language/direction remain accurate. Tradeoff: search engines cannot independently address/index both language versions. Separate translated URLs would require a separately reviewed routing/auth migration.
- Sharing uses the existing 512px Shop logo and `summary` Twitter card, with factual SoftwareApplication JSON-LD (name, business-software category, web OS, publisher, languages). No reviews, offers, prices, rating, unsupported organization registration or contact facts are invented.

## Consent and data

The first-visit banner on anonymous public marketing/legal pages offers equally styled Accept optional, Reject optional and Settings; the switch starts off. Privacy settings remains reachable throughout the app. Authenticated operations and sign-in/signup screens do not show an unsolicited banner; their optional analytics stays off unless previously accepted, and ordinary operational page views are never tracked. Settings is a shared modal with native switch semantics, keyboard operation, Escape and focus restoration. Reject does not clear login cookies or gate application access.

`bs-shop.privacy` stores `{version, analytics, savedAt}` in localStorage for 180 days. Corrupt, future, expired and prior-version values fail closed and reprompt. Expiry is scheduled, and reload/focus/pageshow/storage changes revalidate preferences. Bump `consentVersion` whenever provider/purposes or collected event categories materially change; translations alone do not change purpose. Storage failures leave a memory-only choice and reprompt after reload. Changes in other tabs take effect through storage events.

No GA script, analytics cookie, analytics frame, request or cookieless consent ping is created before valid optional consent. The necessary preference itself is not an analytics identifier. With consent **and** a valid configured production measurement ID:

| Application action | GA event | Allowed application parameters |
|---|---|---|
| Anonymous public document view | `page_view` | Allowlisted canonical URL, constant `Shop Suit` title, blank referrer |
| Public pricing plan link activated | `select_content` | Same safe fields, `content_type=pricing`, `item_id=signup` |
| Confirmed creation and reload of a new owner shop during signup | `sign_up` | `method=email`, homepage URL, constant title, blank referrer |
| Paid subscription / payment initiation / ordinary business operation | None | Disabled |

GA also emits its standard session/engagement metadata after acceptance, using the isolated document’s sanitized page fields. There is no generic DOM click listener or arbitrary route collector. Queries, hashes, UTM values and original referrers are discarded, including marketing attribution that might contain personal information. Account/user IDs, names, emails, phones, shop/customer data, form contents and payment identifiers are never added to event payloads. Ordinary authenticated page views are excluded, including authenticated visits to public pages.

The standard `gtag.js` GA4 loader runs inside a removable, same-origin isolated document whose markup contains no business DOM, form or application history. Initial configuration and each event use sanitized page fields; the script request has no referrer. This extra isolation avoids passive collection of the application URL/form by provider features. It is a data-minimization measure, not a security boundary against a malicious provider script. Only already consented events can construct the document. Ads storage, ad user data and personalization are denied; Google signals/ad personalization/enhanced conversions are disabled in config; automatic page views are disabled. No advanced consent-mode pings are used.

A per-document event/path set prevents repeated reactive/navigation/back replays. Signup adds a consented tab-session boolean marker, never an account identifier. Failed verification/provisioning, existing-shop restoration and retry after a committed shop do not emit another completion. Signup measurement waits at most 1.5 seconds; blocking/CSP failure cannot turn a successful signup into a business error. Measurements can be lost to blockers, network failure or immediate navigation; this is not an audit/billing system.

Withdrawal first sets the provider’s documented `ga-disable-<ID>` flag to suppress unload/engagement sends, then removes the frame immediately, discards unsent events and tries to expire accessible `_ga` / `_ga_*` cookies at the host and supported parent domains. It also removes the owned tab-session marker. It does not send a denied-consent ping, clear authentication, erase already delivered provider data or promise removal of inaccessible/browser-restricted cookies. Leaving public pages or entering an authenticated operational context unloads the provider document. GA may still process browser/network information after acceptance; this feature does not claim anonymity.

## Browser storage inventory

| Storage | Provider / purpose | Duration / removal |
|---|---|---|
| `bs-shop-<environment>-auth-token*` cookies | Supabase / necessary identity session | Nuxt Supabase module default cookie max-age is 8 hours and may renew; actual token/session validity and runtime overrides also apply. Sign-out clears the current session. Analytics withdrawal leaves it alone. |
| `building-suit-locale` cookie | First-party Nuxt i18n / language preference | Default 365 days; changing language updates it. |
| `building-suit.theme`, supported legacy theme keys | First party / theme preference | localStorage until cleared or changed. |
| `bs-shop.privacy` | First party / remember consent or rejection | 180 days; purpose/version change or invalid data reprompts. |
| `_ga`, `_ga_<measurement suffix>` | Google Analytics / optional browser and session measurement | Configured up to 180 days, `cookie_update=false`, host-only; accessible cookies removed on rejection/withdrawal. |
| `bs-shop.analytics.signup` | First party / optional duplicate-event suppression | sessionStorage for the tab session; removed on withdrawal. |
| Existing offline operation/draft storage | First party / requested business operations | Existing synchronization/clear rules, independent of GA; not removed by rejecting analytics. |

The bilingual privacy page now explains these purposes and limitations. Provider-side retention remains unverified until owner setup, so the page does not claim a configured provider retention period or blanket legal compliance.

## Remaining owner setup

1. Resolve the pending GA account preference modal as the account owner. Select or create the intended production GA4 web stream using the existing account; this work has not accepted terms, invented an ID or created credentials.
2. Before supplying an ID, disable enhanced measurement (especially automatic history/page views, form interactions, outbound clicks and site search); keep user-provided data, Google signals, advertising personalization and Ads links off. Review account data-sharing selections and set the shortest appropriate event/user retention (normally the available two-month setting for this minimal funnel). Consider disabling granular location/device collection. Confirm those actual settings rather than relying solely on code configuration.
3. Configure the **public** `NUXT_PUBLIC_GA_MEASUREMENT_ID=G-…` only on the production Shop deployment. Keep it empty on staging/preview; environment and exact-host checks provide an additional barrier. No API secret, service account or Measurement Protocol credential is required. Rebuild/redeploy only in the parent's authorized release process. Test consented synthetic traffic in GA before treating delivery as verified, and verify no unexpected auto events are enabled.
4. `building-suit.com` Search Console domain ownership is already verified through the domain provider. No DNS work is needed. After authorized deployment, parent verifies the actual staging `noindex` response, keeps crawling allowed, and uses URL Inspection/recrawl (and temporary removal if appropriate) for the previously indexed staging URL. Google must recrawl; removal timing is not guaranteed.
5. After a later authorized production release, parent submits `https://shop.building-suit.com/sitemap.xml` to the verified property and inspects production canonical/indexing results. Optional `NUXT_PUBLIC_SEARCH_CONSOLE_VERIFICATION` is supported for a non-secret HTML verification token if needed; it is unnecessary for the existing domain property. No property connection, submission, indexing or ranking is claimed here.
6. Existing Vercel build quota blocks staging deployment verification for this batch. Do not retry repeatedly, buy capacity, alter projects or bypass the limit. Parent merges/deploys when permitted, then the user performs manual staging tests. No hosted DB changes are needed for this feature.

## Verification

Commands and actual final counts are recorded in `docs/work-packages/shop-seo-privacy-analytics.md`.

- New unit tests exercise environment/public-route allowlists, sitemap inclusion, invalid/expired/versioned consent, safe event payloads, cookie ownership, transport disposal and successful/failed/replayed signup provisioning.
- `marketing-privacy.config.ts` runs production/staging/unconfigured local built servers against synthetic public fixtures. Google script requests are intercepted; no traffic is sent to Google. The browser suite exercises pre-consent silence, accept/reject/settings/save/withdraw/reload/back, keyboard/focus, RTL/dark/mobile, stale/expired preferences, blocked storage, safe conversion payloads, pricing activation and authenticated-route provider unloading.
- A dedicated GitHub `marketing-privacy` job repeats the focused production-build browser suite on relevant PR changes. It does not deploy to Vercel or use a hosted database.

## Primary guidance consulted (15 October 2026)

- [Google Search SEO starter](https://developers.google.com/search/docs/fundamentals/seo-starter-guide), [crawlable noindex](https://developers.google.com/search/docs/crawling-indexing/block-indexing).
- [Google basic versus advanced consent mode](https://developers.google.com/tag-platform/security/concepts/consent-mode), [GA4 configuration](https://developers.google.com/analytics/devguides/collection/ga4/reference/config), [provider disable flag](https://developers.google.com/tag-platform/security/guides/privacy#turn_off_google_analytics), [event callbacks](https://developers.google.com/tag-platform/gtagjs/reference/parameters).
- [Google PII avoidance](https://support.google.com/analytics/answer/6366371?hl=en), [regional privacy controls](https://support.google.com/analytics/answer/12017362?hl=en).
- [ICO cookie guidance](https://ico.org.uk/for-organisations/direct-marketing-and-privacy-and-electronic-communications/guide-to-pecr/cookies-and-similar-technologies/), used for informed/equal optional choices, not as a claim that a particular jurisdiction's law has been fully assessed.
- Current [Nuxt 4 server](https://nuxt.com/docs/4.x/directory-structure/server), [shared directory](https://nuxt.com/docs/4.x/directory-structure/shared), [runtime configuration](https://nuxt.com/docs/4.x/guide/going-further/runtime-config), and [head metadata](https://nuxt.com/docs/4.x/getting-started/seo-meta) documentation through Context7. Installed Nuxt is 4.5.2; package sources were checked for actual cookie defaults.
