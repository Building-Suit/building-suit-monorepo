# Doctor manual InstaPay implementation

The user selected InstaPay instead of X-Pay for the initial route, then authorized the full-vision launch list prices after the comparison. This changes the payment route and commercial price inputs; it supplies no clinical, qualified legal/tax or live-release approval. No customer payments or production activation are authorized. Work starts from stg `c08d64fd6de5ff16cd1202826103cee9846f6b81`; all nine original plans and Automation remain untouched.

## Authorized launch list prices — 2026-10-18

Canonical source: `apps/doctor-suit/config/introductory-plans.v1.json`, mirrored by the checked forward migration and consistency tests.

| Plan | Monthly EGP | Prepaid yearly EGP | Active clinic locations | Total named users including owner | Server staff reservations excluding owner |
|---|---:|---:|---:|---:|---:|
| Starter | 299 | 2,990 | 1 | 5 | 4 |
| Clinic | 599 | 5,990 | 3 | 10 | 9 |
| Group | 999 | 9,990 | 5 | 25 | 24 |

A year is 12 calendar months for ten monthly payments (16.7% saving). Self-service activation has no setup fee. These are the user-selected launch list prices, without a crossed-out former price, lifetime promise, tax-treatment claim, clinical-release claim, or unlimited storage/support promise. All qualified administrative features are included. Unit economics remain provisional; profitability is not established.

Parent-coordinated research accessed 2026-10-18: [Tabeeb Hub](https://tabeeb-hub.com/en/pricing) 149/249/449 EGP; [ClinicsAdmin](https://clinicsadmin.com/en) 250/500 monthly and 2,500/5,000 yearly; [Clinbeam](https://clinbeam.com/pricing) 599/1,199/2,499; [Tabbaba](https://tabbaba.com/pricing/) 799/1,599/3,299 and a 2,500 setup charge. These are the parent's current official-source research observations, not feature-equivalence or audited unit-economics findings. Tabeeb Hub has a lower starting price, so Doctor is not described as cheapest.

The existing quota model excludes the owner from staff, counts an active person's unique practice membership once across clinic grants, and reserves pending invitations. This decision therefore maps total user limits to 4/9/24 staff places plus the owner, without silently changing existing counters. Active clinics remain distinct unarchived locations. Existing trial days, renewal/grace, downgrade/expiry, cancellation/refund and historical-access policy are preserved; there is no approved universal trial default, and the researcher's proposed 14 days is not adopted. Published prices do not fabricate complete legal/lifecycle terms or enable quotes without configured approved versioned terms.

## Manual verification contract

Customers submit a reference/time against their own immutable server quote and held intent. Customer claims stay `submitted`; a screenshot/reference is never proof of received funds or paid entitlement. One exact notice per intent and request-key receipts protect duplicate/replayed submissions. A separate stored Doctor reviewer grant is required; editable metadata, practice ownership/delegation, service-role calls and the subscriber's own reviewer grant do not authorize self-verification. Reviews use revisions and immutable attributed events. Verification records exact received minor amount/currency and a beneficiary bank-record reference; one normalized bank reference per recipient account cannot fund multiple notices. Verified funds and entitlement activation are distinct events.

Recipient configuration is versioned and unconfigured by default. It has no invented destination or beneficiary, and no Shop payment configuration/session/data is copied. Shop/Super Admin payment presentation and review patterns are design references only. [Official InstaPay Q&A](https://www.instapay.eg/?page_id=348&lang=en) documents recipient/transfer-reference and pending-status concepts; Doctor's independent received-funds review is an application control, not an automatic provider verification claim. No PIN, OTP, card credential, bank login or arbitrary proof URL is accepted.

This checkpoint supplies the server notice/review foundation and safe published price catalog. The next slice adds separate configured synthetic paid-period activation and private receipt byte handling; customer/admin presentation and actual byte acceptance are still in progress; this document does not claim those unfinished paths pass. Live acceptance remains disabled. Database/service fixtures run in GitHub CI under the no-local-services instruction; static and pure unit checks can run in this cloud workspace. Generated types are retained from the migrated disposable CI database, not handwritten.

Exact remaining inputs: Doctor-approved recipient IPA/mobile destination and bank-displayed beneficiary/merchant identity; accountable independent reviewer user IDs and authority; actual trial, grace and renewal/activation/downgrade/cancellation/refund policies where unconfigured; qualified terms/tax applicability and applicable real-data/hosting/recovery/launch decisions. The prices/limits above are authorized for publication; no recipient, complete lifecycle/legal terms, real payment acceptance or production activation is supplied by that decision. Provider secrets must stay in approved operator custody and are not requested in chat.

The activation policy is unconfigured by default. The implemented bounded policy, `inactive_account_on_review`, activates only an unconfigured/expired account after independent funds verification, current frozen-offer/account checks and a separately recorded policy reference. Active trials, suspended accounts, stale accounts/offers and unknown configurations remain held for review. It does not invent proration, active-period replacement, grace, automatic charges or refund rules. Month/year bounds are server-derived calendar intervals. Synthetic test activation does not grant real-user, clinical or live-payment approval.

The final user decision supersedes the earlier provisional 199/399/699 proposal. Standard future product features are included as released, without separate feature add-on charges, within plan capacity. This promises neither availability before implementation nor delivery dates, lifetime-fixed subscription pricing, unlimited usage/storage/support, or externally purchased messaging/provider capacity. Current administrative capabilities and future clinical/mobile/integration scope must be labeled separately in every offer surface.
