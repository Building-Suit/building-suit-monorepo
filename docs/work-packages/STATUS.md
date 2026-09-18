# Monorepo implementation status

Checkpoint: 2026-09-19. Local workspace, shared UI and documentation are implemented and verified. Hosted database and identity integration are incomplete. [Verification evidence](../migration/verification.md) records passing checks and their limits.

| Work package | Current result |
|---|---|
| WP-00: discovery | Three source repositories inventoried; target Ledger production/STG refs/access and deployment origins are still missing. |
| WP-01: workspace | 502 files imported with provenance; one pnpm/Turbo workspace and lockfile, independent apps, functioning future-platform generator. |
| WP-02: design and docs | Canonical Building tokens/brand resources, full preserved documentation app, extracted shared standards and live component catalogue. |
| WP-03: shared UI | Ledger landing/auth/signup/application compositions shared by both products; atomic components, modal/confirmation/wizard/theme behavior centralized. |
| WP-04/05: database and identity | Local Ledger and Shop recovery baselines exercised. Hosted private/API schemas, data transfer, account reconciliation and SSO remain blocked on the environment prerequisites. |
| WP-06: product integration | All 30 product tables consume the same PrimeVue wrapper. Competing Shop UI stack removed; form styles and record dialogs aligned. Hosted API conversion remains dependent on WP-04/05. |
| WP-07/08: automation and validation | Workspace CI implemented. Three app builds/typechecks, lint, invariants, 18 browser journeys, 678 Ledger assertions and five current Shop SQL suites pass. Hosted release/recovery and domain-isolation tests remain unrun. |
| WP-09: acceptance | Original source preservation and current agent-guidance audit pass. Overall completion is withheld until the hosted schema/identity requirements and final environment acceptance are satisfied. |

Permanent agent rules and workflows describe future development only. The one-time migration plan, scripts, evidence and blockers remain under `PLAN.md` and `docs/migration`.

No hosted migrations, deployments or production traffic changes have occurred. Original repositories and their local databases remain untouched. Continue with the finite sequence in [remote prerequisites](../migration/remote-prerequisites.md) after target access and domains are supplied; do not add an unrelated roadmap.
