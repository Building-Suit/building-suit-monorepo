# Doctor bilingual policy review draft

Task DOS-M1-005 with signup/billing integration for DOS-M1-007 and DOS-AE-004. The owner requested bilingual terms/privacy/trial-subscription/InstaPay/cancellation-refund/health-data pages. The unchanged PR345 planning-v0.4 authority, later explicit 32% pricing decision, synthetic-data restrictions and clinical/legal gates govern this slice. Automation is neither imported nor activated.

Six public `/policies/*` routes use the existing `BsPublicLegalPage` and marketing layout. All composition remains in `packages/ui`; Doctor supplies typed content and known links. Signup, marketing footer, subscription and manual customer/reviewer billing link the same six draft documents. The existing authenticated `/privacy` review-intake route remains separate. Policy metadata is public draft copy with noindex/nofollow; unknown routes and private identifiers remain excluded.

Canonical bilingual content: `apps/doctor-suit/config/policy-drafts.v1.json`, version `doctor-preview-policies/2026-10-18.1`. `policy-review.v1.json` pins its SHA-256, source review, unconfirmed operator fields and `review_only` status. A content change after publication requires a new version and digest; there is no silent acceptance of later text. No approval, clinical certification, hosting location, retention duration, legal entity/address/registration/tax detail, jurisdiction or support/privacy contact is fabricated.

| Decision | Implemented statement | Still required for live/qualified use |
|---|---|---|
| Scope | Synthetic administrative preview, no real patient/clinical use | Clinical, licensing, legal, privacy/security and operating evidence |
| Prices | Monthly EGP299/599/999; annual2439.84/4887.84/8151.84, exactly32% off12monthly payments; zero self-service setup fee | Tax applicability and complete approved versioned terms |
| Renewal | Manual for launch offers; no automatic debit | Any future authorized policy change through a separately approved version |
| Future features | Standard features as released within capacity, no separate feature add-on charge | Feature implementation and scope-specific approval; no release-date/lifetime/unlimited/provider-capacity promise |
| Payment | Server-bound instructions; customer claim/receipt, independent bank check and separate activation | Doctor merchant/beneficiary, independent reviewer identities and live-payment approval |
| Trial/cancellation/refund | Existing configured version controls; no universal trial, refund window or charge invented | Qualified lifecycle, mandatory-rights, fulfilment/contact and dispute decisions |
| Personal/health data | Data minimization, own-account review intake and synthetic-only restriction | Operator/controller/processor roles, applicable grounds/rights, subprocessors/transfers, retention, incident and recovery arrangements |

Draft review is deliberately not represented as an accepted live contract or health-data consent. Signup links remain available, while `legalConsent` stays null for this unapproved draft. Existing synthetic subscription acceptance remains explicitly bound on the server to the exact approved terms ID/document reference, configuration/account revisions and retained idempotency key; missing documents, stale configuration and identity replacement keep acceptance unavailable. The existing tests cover those guarantees. A future qualified general contract must be versioned and integrated with genuine approval; inventing approval or collecting an apparently binding acceptance of missing operator terms would misrepresent the current state. This pending qualified action does not block unrelated authorized synthetic implementation.

## Source review, accessed 2026-10-18

[Official InstaPay Q&A](https://www.instapay.eg/?page_id=348&lang=en) supports bank-displayed beneficiary checks, original transaction references and investigation of pending/disputed transfers. Doctor's separate received-funds review is an application safeguard, not a provider integration or certification. No reversal/refund promise or PIN/card/bank-login collection is added.

[ICO specialist guidance on special category data](https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/lawful-basis/special-category-data/what-is-special-category-data/) explains that health information can include some administrative records where health information is revealed. It is context for future qualified review; UK-law applicability to Doctor is unconfirmed, and the guidance itself states it is under review. EGP/InstaPay does not establish governing jurisdiction. An attempted official Egyptian PDPC page fetch was unavailable; no unverified Egyptian-law provision is asserted.

## Acceptance evidence

Locally, the complete pure/static suite passes 2,016 tests with 23 explicit infrastructure skips, excluding the three browser-launching files reserved for CI. The 32 focused draft/version/digest/metadata/financial-acceptance regressions also pass, along with Doctor typecheck/lint, shared template lint and strict workspace/token ownership checks (zero local components,118 registered route templates). The existing exact server-bound SaaS acceptance tests remain in the focused run. Runtime services remain CI-only. Four browser cases cover both languages, desktop/mobile, light/dark, all six documents, no document reload on internal links, draft-only status, overflow and signup links; the actual-provider manual-payment browser also checks the labeled policy navigation. These cases remain pending until the exact candidate CI completes. No local service or browser was started, and no hosted migration, deployment or main promotion is included.
