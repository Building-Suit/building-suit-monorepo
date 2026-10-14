# Plans and limitations: Ledger Suit reference

Reference: local `/home/tareq/Dev/ledger-suit`, commit `6802580`, reviewed 2026-09-18.
Use implementation migrations as evidence; the older launch plan document describes
an earlier baseline and is not a record of everything currently implemented.

## Reference catalog

Source: `20260911090000_launch_plan_catalog.sql`. These are **Ledger Suit values**,
not yet seeded, approved, or sold as Shop Suit plans.

| Rule | Solo | Starter | Business | Scale |
|---|---:|---:|---:|---|
| EGP/month | 399 | 599 | 1,099 | Preview only |
| EGP/year | 3,255.84 | 4,887.84 | 8,967.84 | Not purchasable |
| Members including owner | 1 | 3 | 10 | Unspecified |
| Monthly posted transactions | 500 | 2,500 | 10,000 | Unspecified |
| Storage | 1 GiB | 5 GiB | 20 GiB | Unspecified |
| Accounts | 30 | 100 | 300 | Unspecified |
| Counterparties | 100 | 1,000 | 5,000 | Unspecified |
| Recurring rules | 5 | 25 | 100 | Unspecified |
| Custom roles | 0 | 3 | 10 | Unspecified |
| Audit retention days | 90 | 365 | 1,095 | Unspecified |
| CSV imports | No | Yes | Yes | Unspecified |
| Exports/core reports | Yes | Yes | Yes | Unspecified |
| Multi-currency/priority support | No | No | Yes | Unspecified |
| Owned organizations | 1 | 1 | 1 | Unspecified |

Branches, advanced analytics and API access are disabled in all three launch
plans. The annual reference prices implement a 32% reduction from monthly × 12.
Ledger's launch documentation describes a cardless 14-day trial. Shop Suit now
independently applies the approved 7-day policy to every new trial. The forward
migration appends new catalog terms and changes the default without shortening existing trial deadlines;
exceptional live-customer records require an explicit audited operator command.

## Behavior to carry over

- Separate public visibility, active status, and purchasability. Scale must never
  be offered as a working paid plan merely because it is visible.
- Resolve entitlements centrally in the database. Missing commercial-plan keys
  fail closed; any legacy exception is explicit and narrowly scoped.
- Serialize quota-increasing writes. UI usage displays are advisory; atomic
  database checks prevent concurrent requests exceeding a plan limit.
- Count active members plus unexpired pending invitations; invitation acceptance
  exchanges reserved capacity for a member under the same lock.
- Enforce limits on direct writes as well as RPC paths. Reactivation and plan
  changes must coordinate with resource creation.
- Preserve records and authorized read access after trial/subscription expiry;
  block product mutations without deleting history.
- Count posted activity rather than drafts; retries must not consume quota twice.
- Preserve legacy plan IDs and subscription history. Downgrades must have explicit
  over-limit behavior and must not delete customer data.

Evidence includes `20260911093000_plan_quota_engine.sql`,
`20260911110000_member_seat_quota.sql`,
`20260911201132_custom_role_quota_enforcement.sql`,
`20260912094117_monthly_posted_transaction_quota.sql`, and
`20260913171823_launch_plan_concurrency_hardening.sql` in Ledger Suit.

## Shop Suit adaptation

Map organization ownership to shop ownership and counterparties to customers plus
vendors. Define whether monthly activity counts sales, purchases, or both, and
whether voids/returns consume capacity. Define product/service quotas explicitly;
Ledger's chart-of-account quota is not automatically a product limit. Do not
advertise storage, payroll, multi-currency, recurring billing, or imports before
those capabilities exist and their limits are enforced.

Task 08a provisionally set active product caps at Basic 100 and Pro 1,000;
Task 08b provisionally set active service caps at Basic 50 and Pro 500. Those
historical Basic/Pro values are not current commercial promises.

Basic/Pro prices remain historical implementation evidence and are not sold to
new customers. The approved Shop catalog has one Solo family with 1-member (EGP 349/month or
EGP 2,847.84/year) and 2-member (EGP 499/month or EGP 4,071.84/year)
variants under SS-LAUNCH-D05, Team at EGP 699/month or EGP 5,703.84/year, and one Multi
family with two-branch (EGP 999/month or EGP 8,151.84/year) and three-branch
(EGP 1,199/month or EGP 9,783.84/year) variants. Yearly prices apply the approved
32% reduction to monthly × 12. The selected immutable catalog term is authoritative
for variant, interval, exact price, trial policy, and enforced resource limits.

Ledger uses Paymob infrastructure; it remains outside Shop Suit's authorized
architecture. Shop Suit uses an operator-configured InstaPay/manual-transfer
notice, external manual verification, and audited operator-only activation. It
does not expose checkout/webhook behavior, automatic bank verification, or
customer self-activation.

## Approved six-resource limits

| Resource | Solo | Team | Multi 2 | Multi 3 |
|---|---:|---:|---:|---:|
| Active locations | 1 | 1 | 2 | 3 |
| Members including owner | 1 or 2 by selected variant | 8 | 16 | 25 |
| Active products | 250 | 500 | 1,000 | 2,000 |
| Active services | 50 | 100 | 200 | 300 |
| Active customers | 500 | 2,000 | 5,000 | 10,000 |
| Active suppliers | 50 | 150 | 300 | 500 |

Solo remains one of three public plan cards, with an English/Arabic member
switch inside its card. Non-member quotas are identical for both variants.
New selections use the current Solo generation; historical subscriptions retain
their exact immutable terms, including the historical two-member EGP 349 offer.
Pending unexpired invitations reserve member capacity and can block downgrades.

The database is authoritative for all six resources. Active-customer and
active-supplier writes use the same per-shop advisory-lock boundary as the
other resources. Archiving preserves history and frees capacity; plan changes
report blockers and never delete, archive, reassign, or otherwise mutate
business records automatically. UI counters are advisory views of that server
state.
