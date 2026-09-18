# Building Suit monorepo — finite implementation plan

This is the current plan, incorporating the user’s independent-Supabase decision. The original detailed plan is preserved in `docs/migration/original-monorepo-plan.md`; its shared database/private product schemas and mandatory shared-login requirements are superseded. Permanent agent guidance describes future development only.

## Scope and acceptance

| Requirement | Implementation and acceptance |
|---|---|
| One monorepo | One pnpm workspace, root lockfile and Turbo task graph; independently runnable Ledger, Shop and documentation apps. |
| Preserve originals | Work only in this selected copy. Preserve all source repos and all 80 historical migration files byte-for-byte; record provenance and verify hashes. Do not change existing business columns, IDs or values to accomplish relocation. |
| Shared architecture/system design | Apps own presentation routes, product orchestration, domain rules and adapters; packages supply reusable UI, UX, contracts and infrastructure. No app-to-app or shared-package-to-app dependencies. Authorized writes stay atomic and server-enforced. |
| Building design system | Canonical Building tokens, palette, Manrope/IBM Plex Sans Arabic typography, Hugeicons, brand assets, responsive behavior, RTL/LTR and theme rules. Generate outputs from a single editable token source. |
| Shared landing | Full Ledger landing/marketing composition reused with each platform’s own copy, imagery, links and sections. |
| Shared login | Ledger login layout, placement and verification mechanics reused with product-specific content and Auth configuration. |
| Shared signup | Same auth layout plus shared Ledger-style wizard/navigation, verification, progress and recovery mechanics; product-specific fields and provisioning rules. |
| Shared authenticated shell | Ledger sidebar, header and main content container with product navigation, permissions, tenant controls and content. |
| PrimeVue and table | One shared PrimeVue stack and `BsDataTable` everywhere a product table is used; native table options/events/slots remain available for sorting, filtering, pagination, selection, editing, expansion, lazy data, grouping, frozen/scroll/resizable columns, exports and state. Product adapters provide data and capabilities. |
| Consistent behavior | Shared record-action/dialog/wizard/confirmation/feedback controllers govern add/edit, loading, validation, errors, dirty-state protection and focus. Change common behavior once; verify all consumers. |
| Atomic Design | Atoms, molecules, organisms and templates for shared presentation. Product domain models stay in the owning application. Reuse components used by two or more products without inventing speculative abstractions. |
| Complete Building docs | Preserve all original Building documentation in a dedicated searchable app; extract maintained shared design, interaction, table, database and architecture specifications. Originals remain historical evidence if superseded. |
| Independent Supabase pairs | Ledger and Shop each own production and staging in a product organization, using the same product-specific migration history for both environments. App-owned CLI roots, four unique refs, distinct local instances and environment-bound scripts. |
| Emails and central management | User configures one owner email per pair, with `ceo@building-suit.com` intended as central Owner. Four active Free projects with that shared Owner conflict with the documented quota; retain the requested arrangement as pending until the user resolves roles/plans/provider confirmation. Do not silently buy a plan or lower permissions. |
| Public schema | Ledger remains in `public`. Shop’s business tables/views/client RPCs move from `shop_crm` to `public` through a new forward migration. Preserve RLS, grants, dependencies and behavior; protected helper and provider-managed schemas retain their roles. |
| Dedicated Shop organization | Extract Shop’s data, referenced Auth users/identities and dependent service configuration from the shared source into dedicated Shop staging/production. Never transfer the entire shared Building source as a shortcut. Reconcile records/IDs/constraints/policies and rehearse recovery before switching app traffic. |
| Deferred Single Auth | Separate project-scoped users and session cookies. No account merging, global identity database, SSO or cross-product session handoff in this scope. Shared auth UI remains shared. |
| Manual secrets | Commit blank examples only. Document exactly where project refs/organization IDs, browser keys, PATs, database credentials and function/provider secrets belong. Keep real files ignored and validate mappings without logging credentials. |
| Future agent rules | Root/scoped `AGENTS.md`, ongoing development workflows, starter templates, ownership and exact commands match the final tree. Review them after restructuring. Keep one-time migration/copy instructions outside active rules. |
| Finish and stop | Verify finite checks, report actual local completion and any concrete hosted prerequisites. Do not create a new feature roadmap or treat deferred Single Auth as an unfinished task. |

## Repository structure

```text
apps/
  ledger-suit/       # product app + supabase/{migrations,functions,tests,templates}
  shop-suit/         # product app + supabase/{migrations,tests,templates}
  building-suit-docs/# original documentation + maintained specs + catalogue
packages/
  design-tokens/ brand/ ui/ ux/ auth/ data-access/ contracts/
  i18n/ nuxt-layer/ config/ testing/
supabase/
  environments/{ledger-suit,shop-suit}/ # blank deployment templates; real files ignored
  legacy/shop-suit/                    # untouched source SQL, not a replay chain
docs/
  shared/ architecture/ agent-workflows.md
  migration/                          # one-time evidence and hosted transfer procedure
tooling/                              # generators, boundaries and product-selecting CLI
```

## Bounded execution order

1. Copy/audit sources and establish the workspace, shared architecture, design system and complete documentation app. Preserve provenance and original bytes.
2. Share Ledger landing/auth/signup/shell and common UI/interaction behavior. Integrate Shop with the shared components and table; retain product business contracts.
3. Configure independent app-owned Supabase roots, public-schema adapters, isolated session cookies, local databases and production/staging examples. Add a new Shop baseline and relocation history without changing old SQL.
4. Verify fresh local initialization, both SQL suites, Shop relocation preservation, app build/typecheck/lint, shared invariants and browser flows including independent sessions. Review source hashes and final future-agent guidance.
5. User supplies actual organization/project refs, origins and credentials after resolving the Free/Owner quota. Follow `docs/shared/supabase-manual-setup.md`; repository configuration cannot create missing accounts or transfer data by itself.
6. Complete only the scoped hosted setup/transfer and acceptance steps in `docs/migration/shop-dedicated-projects.md` once those targets exist. Stage first; preserve source/target backups, compare live source definitions, restore only Shop-owned data/identities/services, then verify and cut over production. Ledger stays within its own pair; Single Auth remains deferred.
7. Record actual results and stop. No hosted completion claim before data/Auth/service checks pass.

Current results are in `docs/work-packages/STATUS.md` and `docs/migration/independent-project-verification.md`. No automatic hosted deployment is enabled.
