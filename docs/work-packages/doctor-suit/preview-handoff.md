# DOS-M1-019 — synthetic preview handoff

This is a GitHub implementation/review handoff. It does not publish a product release, enable registration, merge staging, deploy a site or connect a hosted provider. Authoritative planning-v0.4 stays unchanged; the owner manages Vercel/Supabase connections and real domains.

## Preview behavior

| Surface | Current behavior |
|---|---|
| `/` | Approved text Doctor Suit branding and EN/AR synthetic product copy, title/description and public sharing locale. Internal preview navigation only; no invented external support, pricing, trial or store links |
| `/preview` | Interactive synthetic administrative scope, with unavailable clinical, payment and mobile capabilities explicitly labeled |
| Private and auth routes | Stable generic private title, no description/OpenGraph/Twitter/canonical metadata; `noindex,nofollow,noarchive,nosnippet` meta policy. No patient, account, clinic or callback material is projected into sharing metadata |
| All preview responses | Existing global `X-Robots-Tag: noindex,nofollow` and `Cache-Control: no-store`, independently checked in browser responses |
| Unknown destinations | True HTTP404, a complete shared neutral status page, no reflected path/query, and working links to the known preview routes |
| Sitemap endpoints |404; no generated sitemap advertises authenticated pages |
| Production canonical/OG URL | Omitted. No approved real domain is configured or guessed; DOS-M1-D005 remains separate from synthetic M1 acceptance |

Public metadata is derived from approved preview copy and the active locale. It uses reactive getters so browser navigation back to a private page removes public sharing tags. Private fields are never inputs to the metadata projection. The shared route-status template owns all presentation; Doctor owns HTTP status, approved copy and metadata policy. The implementation uses the pinned Nuxt4.5.2 interfaces, checked against installed types and the official [response-status](https://nuxt.com/docs/4.x/api/utils/set-response-status) and [reactive SEO metadata](https://nuxt.com/docs/4.x/api/composables/use-seo-meta) documentation.

## Review and local-only verification

The focused metadata PR follows PR363; merge order follows the same-stack parent chain, with parent-coordinated independent review and passing stg integration. Use the existing `pnpm dev:doctor` command from the selected cloud worktree for a local synthetic preview. The default loopback port is3006. Test fixtures use4336 (public) and4337/4338 (authenticated frontend/protocol), never a hosted database. Credential forms remain unavailable when the Doctor provider is absent or unverified. Fixture transports and actual disposable-provider acceptance are separate evidence.

- Five metadata/navigation units pass, including private/callback sentinel exclusion, omitted URL/canonical fields and known relative destinations.
- Eight public browser cases pass across English/Arabic, both themes and390/1280px: titles/descriptions/locales, no-store/noindex headers, omitted canonical/OG URL, all declared relative anchors, narrow layout and neutral404 links.
- Two authenticated EN/AR cases pass: private/auth metadata, active account views, public→history-return private tag removal, sign-out and invalid callback scrubbing. The tests await actual private rendering, not merely a changed URL. No credential-bearing trace/screenshot is produced.
- Root regression:1,821 pass/23 optional infrastructure skips. All seven typechecks pass; lint and strict105-template/0-local/80-historical boundaries pass. All seven final builds also pass. Consumer regressions, the full public suite, exact-head CI and publication receipts are recorded when complete.

The current [implementation tracker](implementation-tracker.md) now has explicit rows for all twenty M1 tasks. Earlier failures, pending rows and obsolete provider UNRUN observations are preserved as [history](implementation-history.md), rather than current verdicts. DOS-M1-020 still owns the exact combined acceptance packet and independent milestone reconciliation.

No human clinical/legal approval, catalogue license, real-domain approval, real-patient activation, communications provider, payment, mobile availability, retention/erasure policy, deployment or main promotion is inferred from this preview. The qualified-reviewer gates remain open until their actual evidence exists.
