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
independently applies the approved 14-day policy to every new trial. The forward
migration changes the catalog/default without shortening existing trial deadlines;
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

## Shop Suit adaptation still to decide

Map organization ownership to shop ownership and counterparties to customers plus
vendors. Define whether monthly activity counts sales, purchases, or both, and
whether voids/returns consume capacity. Define product/service quotas explicitly;
Ledger's chart-of-account quota is not automatically a product limit. Do not
advertise storage, payroll, multi-currency, recurring billing, or imports before
those capabilities exist and their limits are enforced.

Task 08a provisionally sets active product caps at Basic 100 and Pro 1,000;
Task 08b provisionally sets active service caps at Basic 50 and Pro 500. These
are database-enforced operational values, not approved commercial promises.

The Basic/Pro prices and product/service limits remain current implementation
evidence, not newly approved commercial terms. See [Task 02](02-database-contract.md).

Ledger uses Paymob infrastructure; it remains outside Shop Suit's authorized
architecture. Shop Suit uses an operator-configured InstaPay/manual-transfer
notice, external manual verification, and audited operator-only activation. It
does not expose checkout/webhook behavior, automatic bank verification, or
customer self-activation. Exact Shop Suit prices and final quotas remain separate
commercial decisions.
