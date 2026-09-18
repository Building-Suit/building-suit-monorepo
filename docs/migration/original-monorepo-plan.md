> Historical plan, superseded for database/identity by ADR 0002 and the current root PLAN.md. Not an active task queue.

# Ledger Suit + Shop Suit: bounded monorepo migration plan

**Reviewed:** 2026-09-18.
**Destination:** `/home/tareq/Dev/building-suit-monorepo`.
**Status:** Local workspace/UI implementation and verification are complete at the recorded checkpoint; hosted database/identity cutover is blocked on verified Ledger environment access and domains. Current evidence is in `docs/work-packages/STATUS.md`.
**Outcome:** Two independently deployable products that share Building Suit's design system, Ledger's requested layouts, common implementation patterns, and one Supabase project per environment, without altering the original source projects or redesigning existing business tables.

## 1. Scope and non-negotiable limits

The implementation will:

1. Copy Ledger Suit, Shop Suit, and all Building Suit documentation/reference material into this directory.
2. Create one workspace, dependency graph, lockfile, shared package system, CI system, and set of AI-agent workflows.
3. Make both products consume the same design tokens, brand rules, PrimeVue components, landing template, authentication template, signup wizard engine, authenticated shell, table, and UI interaction policies.
4. Put both products on the existing **Ledger Suit** Supabase project in production and **Ledger Suit STG** in staging. Project renaming is outside this task; configuration will use immutable refs.
5. Store product records in private `ledger_suit` and `shop_suit` schemas and expose only approved API contracts.
6. Coordinate shared identity now, including signup-trigger conflicts, existing identities, separate portal profiles/permissions, and the session-handoff mechanism selected for the actual domains.
7. Preserve existing implemented business functionality and prove the restructure works against the defined checks.
8. Finish the finite work packages below, record completion, say **`Done`**, and stop.

The implementation will not silently acquire the old repositories' roadmaps. Building's Flutter product, Ledger Accounting V2, Shop's unfinished sales/purchasing/reporting/employee features, a Super-Admin product, new payment integrations, new commercial plans, and speculative infrastructure are not part of this migration. Existing incomplete features remain accurately identified. Migration regressions and failures that prevent the required flows from working are in scope to fix.

**Database preservation:** no edits to historical migrations; no existing column additions/removals/renames/type conversions; no ID conversion; no enum-label changes; no financial/data-model redesign; no destructive data cleanup. New forward migrations may relocate objects and repair their namespace-dependent references, API compatibility, grants, and necessary shared-auth behavior. Any requirement that cannot be achieved within those limits must be identified precisely before the affected remote change.

## 2. Findings from the actual sources

| Source | Verified state | Consequence for this plan |
|---|---|---|
| `../ledger-suit` | Clean working tree at `6fb152e`; Nuxt 4/Vue 3/TypeScript; PrimeVue 4.5.5 in unstyled mode; Building-derived tokens, Manrope, IBM Plex Sans Arabic, Hugeicons; 66 migration files | Use its landing, login, signup flow, and authenticated shell as extraction references. PrimeVue installation alone is not a finished shared component library. |
| Ledger UI | Login and signup use `layout: false`; authenticated shell is `app/layouts/default.vue`; marketing shell is `app/layouts/marketing.vue`; tables are distributed through pages/components | Extract actual implementations and all their behavior, not just reusable CSS or a sidebar. |
| Ledger identity | `public.profiles.id` references `auth.users.id`; Auth insert trigger provisions a Ledger profile; signup uses email verification and resumable organization onboarding | A generic Auth event currently has Ledger-specific side effects. Resolve before sharing Auth with Shop. |
| Ledger database | Business objects in `public`, authorization helpers in private `app`; historical `20260908120000_user_managed_chart_of_accounts.sql` contains `TRUNCATE` | Never replay historical migrations against populated target data. Namespace moves need dependency and migration-history checks. |
| Ledger verification records | Current status records passing local build/typecheck/SQL checks, but an unstable invitation browser test and unverified deployed/restore status | These are prior records, not fresh verification of this monorepo. Recheck the migration's real acceptance flows. |
| `../shop-suit` | Clean at `addc782`; existing pnpm workspace, Nuxt app at `apps/shop-crm`; shadcn/Reka/Lucide/Solar UI rather than PrimeVue | Flatten into `apps/shop-suit`, replace UI implementation with shared components, preserve business behavior. |
| Shop current behavior | Supabase-client table/RPC access; current readiness documents supersede older rebuild/BFF documents; dashboard, products, services, manual inventory, and paid expenses have current implementation work | Do not resurrect the removed API-layer package or use historical BFF descriptions as the source of truth. |
| Shop migrations | Five legacy `supabase/migrations` files, nine newer `supabase/shop_crm_migrations` files; legacy replay is disabled | Keep all files unchanged for provenance. Build the target from the current hosted contract plus reviewed forward migration, not concatenated legacy chains. |
| Shop live location | Project `jkdncdexqcymwbihwdhp`, currently named **Building Suit**; `shop_crm` has **25 tables and 26 views** in this review | The older 24-table/25-view snapshot is stale. A fresh complete inventory is required when implementation begins. |
| Shop dependencies | `shop_crm.profiles.user_id` references managed `auth.users`; profile and other status types include `public` enums; private helpers also exist outside `shop_crm` | Copying only tables or running only `ALTER SCHEMA` is insufficient. Include identities, types, helpers, policies, functions, and service configuration. |
| `../building-suit` | Clean at `acaecb3`; 69 files under `.docs`, including 55 Markdown files, token sources, logos, PDFs, and images; also prototype and agent/plugin guidance | Preserve the entire documentation corpus and reference assets, not a handful of extracted design documents. |
| Building architecture | Requires a monorepo, one database per environment, bounded-domain private schemas, global account plus portal profiles, independent portal deployments, tenant authorization, and shared contracts/tokens | Adopt these principles, with the explicit compatibility exceptions below. |
| Destination | Empty before this planning task | No existing target implementation needs to be preserved beyond this plan and its companion rules. |

**Remote-access limitation:** Ledger's local configuration and CLI link reference `yqculoltqsyfastmihmu`, but the current connector cannot access it. Both connector and CLI list only Finance Suit and Building Suit; neither lists Ledger Suit STG. This review therefore cannot certify which immutable ref is production, the staging ref, or either environment's live schema/history. Do not substitute an accessible project. Resolve those identities/access in WP-00 before remote target work.

The review used source files and read-only cloud catalog queries. It did not retrieve customer records, execute migrations, run application builds, or claim the new structure already works.

## 3. Architecture decisions and source conflicts

Record these decisions in `docs/architecture/decisions/` during WP-01; they are decisions for this migration, not an invitation to redesign the products.

| Decision | Resolution |
|---|---|
| One repository, separate applications | Use pnpm workspaces and Turborepo. Each product retains its own routes, app configuration, content, product state, tests, and deployment. Shared packages are local workspace dependencies. |
| Web stack | Standardize on one tested Nuxt 4/Vue 3/TypeScript/Tailwind 4 combination and PrimeVue. Resolve the actual locked versions, including differing Vue Router/Nuxt/Supabase module versions, rather than installing every latest version. Pin Node and pnpm consistently in local tooling and CI. |
| Building docs specify Nuxt UI | The user's explicit PrimeVue requirement takes priority. Record this override; do not install Nuxt UI beside PrimeVue. Shop's shadcn/Reka components are replaced in the copied app. |
| Building production target is Flutter | Share architecture principles, language-neutral contracts, brand assets, tokens, and documentation. Do not port Ledger/Shop to Flutter or treat the Pug prototype as a Vue runtime package. |
| Building proposed DB has `bigint id` + `public_id`, coded statuses, and other new conventions | Preserve Ledger/Shop's existing identifiers, columns, enums, amounts, and constraints. These proposed database redesign rules do not apply retroactively to this relocation. |
| Building finance and Ledger accounting differ | Share command/query, authorization, transaction, audit, and immutable-history principles. Keep Ledger's double-entry accounting and Shop's FIFO/business rules in their own domains. |
| Atomic Design | Use atoms, molecules, organisms, and templates for the shared UI. Product pages remain in apps. Atomic Design is a UI organization method, not a database or domain architecture. |
| Shared interaction behavior | Shared policy and composables own record actions, overlays, feedback, validation timing, interruption handling, and table state. Product adapters own schemas, fields, permissions, and business commands. |
| Shared identity | Implement one Auth identity namespace and shared auth implementation now. Keep portal profiles and tenant memberships separate. Never make possession of a global session sufficient for product access. |
| Physical identity storage compatibility | Keep the existing Ledger and Shop profile tables and IDs. Resolve them through shared identity/portal-profile contracts. Do not merge/reshape them into new `platform.users`/`platform.profiles` tables in a relocation-only task. This is an explicit storage exception to Building's future provider-independent bridge, not a postponement of shared-account login. |
| Private schema meaning | `ledger_suit` and `shop_suit` are not exposed through PostgREST. Use `ledger_suit_api` and `shop_suit_api` for approved views/RPCs; use corresponding private helper schemas. A schema name alone is not security. |
| Future products | Reuse registered app configuration and shared packages. Create one small generator/example; do not implement future products or speculative packages. |

Nuxt layers support sharing configuration and framework integration; use an explicit shared layer for layouts/plugins/module registration, with reusable Vue components in packages. [Nuxt layers documentation](https://nuxt.com/docs/4.x/getting-started/layers). Keep workspace packages at explicit, non-overlapping paths. [Turborepo repository structure](https://turborepo.dev/docs/crafting-your-repository/structuring-a-repository).

## 4. Target directory structure

```text
building-suit-monorepo/
  AGENTS.md
  README.md
  PLAN.md
  package.json
  pnpm-workspace.yaml
  pnpm-lock.yaml
  turbo.json
  .node-version
  .github/workflows/
    ci.yml
    database-staging.yml
    database-production.yml
    deploy-apps.yml
  apps/
    ledger-suit/                    # Copied Ledger Nuxt app, independent deployment
      app/{pages,features,layouts}/
      config/platform.ts
      tests/
    shop-suit/                      # Flattened copy of Shop's apps/shop-crm
      app/{pages,features,layouts}/
      config/platform.ts
      tests/
    building-suit-docs/             # Real, buildable documentation app
      content/building-suit/        # Entire original .docs corpus and assets
      reference/prototype/         # Preserved Pug/HTML evidence, not production UI
      reference/agent-guidance/     # Original CLAUDE/.claude/plugin instructions
      app/                         # Docs navigation and shared component catalogue
    identity/                      # Only if separate-origin SSO needs an auth UI host
  packages/
    design-tokens/                 # Canonical JSON + generated CSS/TS/Tailwind outputs
    brand/                         # Fonts, icons, logos, typed product-brand registry
    ui/
      src/{atoms,molecules,organisms,templates}/
    ux/                            # Record actions, overlays, wizard and table policies
    auth/                          # Identity, sessions, portal-profile adapters, handoff
    data-access/                   # Supabase/query infrastructure, no product business rules
    contracts/                     # Shared interfaces/errors; product types kept distinct
    i18n/                          # Common EN/AR vocabulary and locale infrastructure
    nuxt-layer/                    # Shared integration/layout wrappers/config defaults
    config/                        # TS/ESLint/test/toolchain presets and boundary rules
    testing/                       # Shared test fixtures/helpers, no production data
  supabase/
    config.toml                    # One active migration/deployment root
    migrations/                    # Verified Ledger history unchanged + new forward work
    functions/                     # Ledger functions retained; shared runtime helpers
    templates/                     # Shared Auth template and existing product templates
    tests/{platform,ledger-suit,shop-suit}/
    inventory/                     # Metadata-only ownership/dependency manifests
    legacy/shop-suit/               # Both original Shop migration histories, unchanged
    legacy/config/                 # Original configs/seed snapshots, reference only
  docs/
    shared/                        # Extracted reusable architecture/brand/UX rules
    architecture/decisions/
    migration/                     # Copy map, checksums, runbooks, environment map
    work-packages/                 # Fixed WP-00 through WP-09 evidence
    agent-workflows.md
    source-audit.json
  tooling/
    copy-projects/
    design-tokens/
    checks/
    new-platform/
    database/
```

`apps/identity` is a bounded infrastructure frontend only when the actual domain topology requires it; it must not grow into a combined product dashboard. Its screens consume the same auth templates. WP-04 selects exactly one supported session strategy and records whether this app is required.

Do not create nested active workspaces or a second lockfile inside an app. Prototype package files are archival reference and excluded from workspace discovery. Every shared package must have an actual caller or an immediate role in the two-product migration.

### Copy and provenance rules

- Inventory and checksum the selected working trees before copying. Use the named main source directories, not similarly named Ledger worktrees or `building-suit-old`, unless a source correction is explicitly supplied.
- Copy, never move. Preserve tracked files and relevant untracked source/assets, including `.docs`, `.claude`, `.github`, dotfiles, scripts, tests, translations, and documentation.
- Exclude `.git`, dependencies, `.nuxt`, `.output`, caches, test output, provider link state, and credentials. Inspect symlinks and avoid dependencies on source-directory paths.
- Store an old-path → destination-path map, source commit, dirty-state report, file hashes, and exclusion reasons. Do not record secret contents or credential hashes.
- Preserve Shop root docs, `PATCHES`, scripts, migration histories, and workflow sources as well as the nested Nuxt app.
- Recreate ignored environment files using documented variable names. Keep frontend publishable keys separate from server/CI credentials.
- Establish a new Git repository in the destination with a clean copy checkpoint before refactoring. Do not inherit old remotes or automatically activate copied deployment jobs.
- Compare protected source-file hashes and Git state at completion. Any concurrent user edits must be reported without overwriting them.

## 5. Common application architecture and patterns

Use feature-oriented product modules with the same internal shape in both apps:

```text
features/<feature>/
  components/          # Product-specific forms/details composed from shared UI
  composables/         # Feature orchestration and typed queries/mutations
  application/         # Use cases where orchestration is needed
  domain/              # Product rules and types, without UI/Supabase dependencies
  infrastructure/      # Product repositories and RPC/query adapters
  contracts/           # Product validation/input/output contracts
```

Small features need only the files they use; do not generate empty layers. Route components compose features and shared templates. The flow is UI → feature action/query → repository/command adapter → approved Supabase view/RPC/Edge Function. Product-specific SQL remains authoritative for business invariants.

Shared patterns:

- **Composition and configuration:** apps supply typed `PlatformDefinition`, navigation, content, brand asset paths, auth requirements, tenant adapter, and feature registry.
- **Adapters/repositories:** Supabase schemas and transport details stay out of presentation components. Maintain separate Ledger and Shop repository contracts.
- **Command/query separation:** reads use approved query contracts; important writes retain authorized atomic database commands. Do not turn multi-step financial writes into browser orchestration.
- **Shared state ownership:** one selected query/mutation implementation, consistent pending/error/invalidation behavior, portal-local application state. Align with Building's Pinia/Pinia Colada direction where adopted; verify compatibility and replace current ad hoc caching through the same facade, not two competing caches.
- **Cache isolation:** keys include environment, portal, authenticated user, tenant, feature, and filters. SSR state is request-scoped. Clear sensitive caches and listeners on logout, portal change, tenant switch, and account change.
- **Dependency direction:** apps → shared packages; UI → tokens/brand/contracts; auth/data adapters → contracts. Shared packages cannot import either app or reach into a product schema implicitly.
- **Errors and observability:** a common typed error/result contract, translated presentation, request correlation and secret/PII redaction. Preserve diagnostic detail in appropriate logs without showing raw SQL/schema errors in the product.
- **Authorization:** shared interfaces for capabilities/entitlements; separate product policies, subscription catalogs, quotas, trial rules, and role meanings.
- **Reliability:** reuse existing transaction/idempotency/retry protections. Do not add a new event bus, outbox subsystem, job framework, or microservice to complete this structural migration.

Generate current database types for all relevant schemas from the verified target. Keep each product's exported DTOs separate and prohibit handwritten fake RPC types or blanket casts that hide contract mismatches.

## 6. Building Suit design system and branding

### Source authority and extraction

Use the original `building-suit/.docs/building-suit-brand-guidelines/` as the source:

- `07-design-tokens/design-tokens.json`: exact canonical token values.
- `03-visual-identity/`: palette, typography, layout/spacing, visual language, icons, imagery.
- `02-logo-system/`: approved usage, clear space, variants, app icons, prohibitions.
- `04-ui-system/`: component treatment, light/dark rules.
- `08-final-guidelines/`: consolidated final brand rules.
- `03B.BUILDING_SUIT_MOTION_SPEC.md` and UX/UI specs: relevant motion, states, accessibility, and responsive rules.

Extract the canonical runtime JSON into `packages/design-tokens`. Preserve the original file in the source documentation snapshot, explicitly identified as the import baseline. Thereafter, generated CSS, TypeScript, Tailwind mappings, docs tables, and any retained Dart token export derive from the runtime source. CI detects drift; agents do not edit generated files directly.

Preserve Building Navy `#16293B`, Premium Gold `#D89B42`, the full approved neutral/semantic palette, Manrope for Latin, IBM Plex Sans Arabic for Arabic, and Hugeicons Stroke Rounded. Primary actions remain Navy in light mode and Gold in dark mode. Include typography scale, Arabic line-height adjustment, spacing, radii, shadows, focus states, borders, surfaces, motion/reduced-motion, and responsive tokens. Document any missing semantic token once; do not invent per-page values.

Preserve product names, approved product logos, favicons, copy, and imagery through the brand registry. Shared family branding does not mean replacing Shop's name with Ledger's or using Building's logo everywhere. Audit current Ledger visuals against canonical rules; preserve its requested composition while correcting token-level divergence consistently.

### Atomic component ownership

| Layer | Shared contents |
|---|---|
| Foundations | Tokens, typography, icons, fonts, reset, accessibility and direction utilities |
| Atoms | Buttons, links, inputs, selects, checkboxes, radios, switches, badges, tags, avatar/icon, skeleton, spinner |
| Molecules | Labeled/floating field, error/help text, input group, search/filter control, language/theme control, field actions, small menu items |
| Organisms | Data table, form sections, dialog/drawer hosts, signup stepper, navigation sidebar, top bar, tenant selector, feedback/confirmation hosts |
| Templates | Marketing page, authentication page, signup page frame, authenticated application shell, standard list/detail/form composition |
| Pages | Remain in each app and supply real content, domain forms, queries, permissions, and actions |

Use PrimeVue's existing behavior/accessibility primitives through these wrappers. Keep unstyled mode with one shared styling/pass-through system, avoiding an unrelated default theme. Shared PrimeVue service registration happens once through the Nuxt layer. Migrate Shop away from shadcn/Reka/Lucide/Solar in the copied application and remove unused dependencies after callers are converted.

Publish a component catalogue inside the docs app, including its states and real configurations. A separate Storybook product is unnecessary for this migration. Any component reused by two or more current apps belongs in the shared system; future apps use the same rule. Do not prebuild every component that might someday exist.

Atomic Design's five levels inform this organization; applying them to shared UI while keeping actual pages in product apps is the selected implementation approach. [Atomic Design methodology](https://atomicdesign.bradfrost.com/chapter-2/).

## 7. Exact shared layouts and signup contract

### Landing page

Extract **the full Ledger landing experience**, including `app/pages/index.vue`, `app/layouts/marketing.vue`, their styles, navigation/footer, responsive behavior, and connected presentation components. Inventory every section before extraction: hero and preview illustration, calls to action, features, workflow, pricing, and any content/footer states in the actual source snapshot.

Implement one `BsLandingPage` template and common section components. Apps provide a typed content model containing translated heading/body text, logos, screenshots/illustrations, navigation targets, feature items, workflow steps, pricing adapter, legal/contact links, and calls to action. Keep the same section composition, spacing, widths, responsive placement, typography, header/footer and behaviors. Optional content must use documented shared slots or variants; do not maintain a second Shop landing layout.

Pricing values and availability remain product-owned and backend-derived where currently applicable. Do not copy Ledger prices/trials into Shop, fabricate social proof, or advertise unfinished Shop features as functioning. Preserve SEO metadata, canonical URLs, accessible headings, deep links and legal pages.

### Login and other authentication screens

Extract Ledger's full login composition into `BsAuthLayout`: form panel, content placement, showcase panel, logo position, mobile fallback, decorative treatment, legal links, language/theme control, spacing and error/loading states.

Both products' login screens use it with their own content and brand assets. Use the same frame for signup, confirmation/OTP, forgotten/reset password and supported callback/recovery screens. Preserve existing route entry points through thin wrappers or explicit redirects, including Shop's `/auth/*` paths and Ledger's `/login`, `/signup`, `/verify-email` routes.

### Signup wizard

Extract Ledger's wizard mechanics into `BsSignupWizard` plus a shared onboarding state machine. The app provides:

```text
SignupDefinition:
  translated step titles and descriptions
  ordered field/form components and validation schemas
  account requirements and supported credential methods
  product-specific profile and tenant requirements
  consent/legal links and verification requirements
  load/resume/provision/complete adapters
  successful completion destination
```

Shared mechanics include next/back navigation, validation timing, field focus, error summary, progress indication, pending/disabled states, safe resumable drafts, OTP entry/paste, resend cooldown, expiry, retry, refresh recovery, existing-account handling, idempotent completion, and duplicate-submit prevention. Never persist passwords or tokens in wizard draft storage.

Ledger keeps personal/contact/job fields, business/legal fields, type, country, timezone, currency, fiscal-year/tax requirements, email verification, and its actual cardless trial/organization command. Shop supplies its actual display-name/account fields, shop name, required plan choice and first-shop command. Do not add Ledger accounting fields to Shop or impose Building's phone/WhatsApp-only onboarding on the two existing email-based products.

Joining the second product uses the existing authenticated identity, then that product's onboarding. It must not attempt to create another Auth account, automatically create the other product's tenant, or start a second trial through repeated verification/resume callbacks.

### Authenticated application shell

Extract Ledger's side navigation, top header and main content container into one `BsAppShell`. Include navigation groups, active state, responsive collapse/mobile overlay, backdrop/Escape behavior, tenant switcher, account/settings/team/notification slots, breadcrumbs/page title/actions, content widths, scroll behavior, keyboard focus, theme/language controls, entitlement/loading/empty/error states.

Products provide navigation entries, translations, permissions, tenant adapter, optional feature slots, and account actions. They do not copy the shell or place product-specific queries inside it. Preserve Ledger organization switching and Shop shop selection. Clear old tenant data before displaying the next tenant; client route guards complement server authorization.

## 8. One full-featured shared data table

Create **one public table entry point: `BsDataTable<Row>`**. All current product data tables, including dashboard previews, report tables, import previews, audit/team pages, detail-dialog tables and chart accessibility tables, consume it or its documented read-only presentation mode. Semantic tables in prose/reference documentation are not a second product datagrid.

The table owns presentation and interaction state. Product adapters own columns, typed rows, filtering/query translation, permission checks, export commands, and mutations. Do not download an entire tenant dataset just to implement client filtering, totals or export.

### Required capability matrix

| Area | Required shared support |
|---|---|
| Columns and cells | Typed definitions, templates/slots, formatting for text/date/time/money/status, alignment, tooltips, links, row keys, header/footer groups |
| Sorting | Initial/default, single, multiple, removable sort, stable server translation and deterministic pagination |
| Filtering | Global search, per-column filters, row/menu modes, multiple constraints/operators, date/range/number/multiselect filters, debounce, clear/reset |
| Paging/querying | Client mode for bounded rows; server/lazy mode; page-size options, totals and current-page reporting, cursor adapter where required, cancellation/stale-result protection |
| Selection | Single, multiple, checkbox/radio modes, disabled rows, page-only versus explicitly requested all-filtered selection, keyboard interaction and clear selection |
| Actions | Standard toolbar/create/refresh/import/export hooks, row actions/context menu, permission-aware bulk actions, destructive confirmation through the shared controller |
| Layout | Density/sizes, stripes/gridlines, sticky headers, horizontal/vertical/flex scrolling, column widths/resizing/reordering/visibility, frozen columns/rows, responsive overflow |
| Advanced data display | Row expansion, nested details, row/column grouping, group headers/footers, expandable groups, aggregate/totals display, conditional row/cell styling |
| Large datasets | Virtual scrolling and lazy loading where supported; documented restrictions for incompatible combinations; no claim that every mode works simultaneously |
| Editing | PrimeVue cell/row editing capability in the wrapper contract, validation/save/cancel hooks; product create/edit flows still follow the single global editing policy below |
| State | Versioned saved table preferences, optional URL filters, reset, namespaced persistence by environment/product/user/tenant/table; no PII-heavy row persistence |
| Export/print | Shared CSV behavior and existing report/export integrations; adapters for print and additional required formats; escaping/formula safety, permitted fields only, honest current-page versus all-filtered export |
| System states | Initial loading, background refresh, skeletons, empty dataset, no search matches, error/retry, offline/stale state where applicable, disabled/busy actions |
| Access and localization | Arabic/English, LTR/RTL, light/dark, focus/keyboard, accessible names/sort announcements, mobile/touch, local number/date/currency formatting |
| Extensibility | Typed access to supported underlying DataTable/Column props, events, slots and pass-through options without bypassing shared styling or interaction policy |

**Bounded meaning of “all possible options”:** freeze the selected PrimeVue version in WP-01; inventory its complete DataTable and Column API against this matrix. Every supported option must be either exposed through the wrapper, governed by shared policy, or documented as an incompatible/unsupported combination with an alternative. The catalogue demonstrates every capability group. This does not require inventing future vendor features or enabling every option on every page. PrimeVue supplies the underlying table capabilities. [PrimeVue DataTable](https://primevue.org/datatable/).

Initial caller inventory includes Ledger `accounts`, `transactions`, `records/[kind]`, `reports`, `audit`, `imports`, `team`, `dashboard`, `TransactionDetailDialog`, and `RevenueExpenseChart`; Shop `dashboard`, `products`, `services`, `inventory`, and `expenses`. Re-scan the copied snapshot to ensure none are missed.

## 9. One shared UI behavior policy

Implement `useRecordAction`, `useOverlay`, `useConfirmation`, common form/wizard state, feedback and table policy in `packages/ux`; render through hosts in the shared shell. Use one request-scoped/client-app-scoped controller, not module-global SSR state.

| Interaction | Standard behavior |
|---|---|
| Add record | Opens the shared modal form on desktop. All products/pages use the same action controller and lifecycle. On small screens the same component uses the centrally defined full-screen dialog variant. |
| Edit record | Uses the same form dialog and save/cancel semantics. Multi-step financial creation uses the shared wizard inside the same presentation policy. |
| Complex existing full-page workflow | Preserve only a documented centrally registered workflow class where a modal would break the existing task; the same class behaves identically in both products. No arbitrary per-page choice. |
| Delete/archive/void/reverse | Shared confirmation and feedback; adapter retains the product's actual allowed operation. Never replace financial reversal with physical deletion. |
| Submit | Common pending indicator, disabled duplicate action, validation/focus, error mapping and success notification. Existing database idempotency remains authoritative. |
| Cancel/close/navigation | Same unsaved-change protection, Escape/backdrop rules, focus restoration, draft cleanup and history/back handling. |
| Refresh and mutations | Refresh/invalidate exactly the relevant tenant-scoped list/detail/totals after success; retain useful form state after failure. Do not optimistically claim a financial write succeeded. |
| Feedback | Same toast placement/duration classes, inline field errors, error summary, retry pattern, loading/empty/access-denied states and accessibility announcements. |
| Preferences | Same locale/theme/density behavior, first-paint theme handling, per-user isolation, and explicit migration of old storage keys. |

Inline table editing is available as a shared capability, but disabled for ordinary record CRUD under the default modal policy. Enabling a new editing class is one central policy change with tests and corresponding behavior in all products that use that class.

Inventory each existing add/edit action, including menus, keyboard shortcuts and empty-state CTAs. Convert every trigger to the shared controller. ESLint/import checks prohibit local PrimeVue Dialog/DataTable imports and duplicated controllers outside approved infrastructure. A change to the shared controller must update both products through their dependency graph and CI.

## 10. Supabase topology and migration design

### Environment and schema map

| Environment | Project | Products |
|---|---|---|
| Production | Existing **Ledger Suit**, immutable ref verified in WP-00 | Ledger and Shop |
| Staging | Existing **Ledger Suit STG**, immutable ref verified in WP-00 | Ledger and Shop with staging-only secrets/callbacks/test fixtures |
| Current Shop source | `jkdncdexqcymwbihwdhp` / Building Suit | Read-only migration source for Shop-owned objects/data; unrelated Building objects excluded |

```text
auth / storage / realtime / extensions / vault   Supabase-managed
ledger_suit                                    Private Ledger tables/types
ledger_suit_private                            Private Ledger helpers/triggers
ledger_suit_api                                Approved Ledger views/RPCs
shop_suit                                      Private Shop tables/types
shop_suit_private                              Private Shop helpers/triggers
shop_suit_api                                  Approved Shop views/RPCs
platform_api / platform_private                 Shared identity resolution, only as needed
public                                         Existing unrelated objects + bounded compatibility
```

Do not create Building's future domain or Super-Admin schemas just because documentation names them. Preserve unrelated existing target schemas and settings. Shared configuration must support later project display-name changes without application code changes.

### Private schemas and API compatibility

Both current applications use direct Supabase queries/RPCs. Moving tables into an unexposed schema means simply changing `db.schema` to `ledger_suit` or `shop_suit` would fail. Introduce explicit invoker views/read contracts and RPC wrappers in the API schemas, then update the repositories to use those contracts. Supabase documents separate API schemas as a way to keep internal objects unexposed. [Supabase API security](https://supabase.com/docs/guides/api/securing-your-api).

- Inventory each actual `.from`, `.rpc`, embedded join, storage access, subscription, Edge Function query and SQL caller.
- Preserve payload shapes, selected columns, ordering, filters, counts, pagination, defaults, errors and transactions.
- Use security-invoker views with explicit columns and appropriate base-table privileges/RLS; do not let view ownership bypass authorization.
- Direct writes/upserts and embedded relations need individual compatibility verification. Views do not automatically preserve table conflict-target/upsert behavior or relationship discovery. Use narrow authorized RPC adapters where necessary without changing stored columns or business semantics.
- Apply explicit schema usage/object grants and restrictive default privileges. No blanket `GRANT ALL` to anonymous/authenticated roles.
- Keep privileged implementations private with fixed safe search paths and explicit authorization; expose only the intended wrapper signatures.
- Do not rely on Data API checks alone for Storage/Realtime/Edge Functions. Preserve their independent authorization paths.

Custom schema exposure and client selection are separate configuration steps; generated client types must include the selected API schema. [Supabase custom schemas](https://supabase.com/docs/guides/api/using-custom-schemas).

### Inventory before any write

Capture both source and target catalog definitions, applied migrations, data counts/digests and permissions. Classify ownership for:

- Tables, partitions, columns/defaults/generated values, PK/FK/unique/check/exclusion constraints, indexes, identity/owned and standalone sequences.
- Enum/domain/composite types, collations, extensions and version dependencies.
- Views/materialized views, overloaded functions/procedures, return/argument types, trigger functions, trigger ordering, dynamic SQL, security/search-path settings.
- RLS enable/FORCE state and policies, ownership, role grants, default privileges, exposed schemas and role-level PostgREST settings.
- Auth application triggers/hooks, profile sync, account verification, invitation flows and signup metadata handling.
- Storage buckets/object bytes/policies, attachment keys and signed-link behavior.
- Realtime publications/channels/filters, replica identity and reconnect/invalidation behavior.
- Edge Functions, secrets by name, JWT checks/CORS, webhooks, email templates/providers, Cron jobs, Vault references and scheduled work.
- All code, tests, seeds, generated types, scripts and docs with `public`, `app`, `shop_crm` or `shop_private` references.

Record exact allowlisted objects rather than using a global textual `public` replacement. Shared/unrelated source enums/helpers must not be moved out from under Building Suit.

### Ledger: in-place namespace relocation

1. Verify the production/staging target and migration history; ensure historical destructive migrations are already accounted for and will not be replayed.
2. Capture a backup and prove restore in the selected safe test environment. Take before-checks for data and financial invariants.
3. Create destination private/API namespaces with restrictive grants.
4. Use `ALTER TABLE ... SET SCHEMA` for Ledger-owned tables. Move separately owned types, functions, views and standalone sequences according to the manifest; do not rebuild tables or convert their columns. PostgreSQL moves table-associated indexes, constraints and owned sequences with the table. [PostgreSQL 17 ALTER TABLE](https://www.postgresql.org/docs/17/sql-altertable.html).
5. Audit dependencies that retain object identity versus SQL text, dynamic SQL, qualified casts, search paths, function argument/return types, jobs and clients that require new names. `SET SCHEMA` is not a general rewrite of stored function source.
6. Add the required API contracts and a minimal, tested old-namespace compatibility layer if existing deployed Ledger callers must continue during cutover. Preserve exact existing direct-write/upsert semantics or use a coordinated write pause; do not assume all legacy callers work through views.
7. Update the copied application, Edge Functions, tests, types, seeds and scripts. Historical migrations stay untouched.
8. Compare definitions allowing only approved namespace/reference/access changes. Verify all IDs, row values/counts, constraints, balances, policies, grants and relevant runtime flows.

### Shop: cross-project transfer, then relocation

`ALTER TABLE ... SET SCHEMA` cannot move data between Supabase projects. Shop needs a scoped transfer into the target first.

1. Export a fresh, consistent Shop-owned schema and data snapshot, its dependency closure, Auth identity requirements and storage files. Keep encrypted data artifacts outside Git.
2. Exclude unrelated Building/Finance records, provider system schemas, source migration-history tables and obsolete `public` Shop tables unless verified current dependencies require them.
3. Prepare the Auth identity mapping before importing FK-dependent profile rows (section 11). Preserve existing domain IDs and values.
4. Reconstruct the exact current Shop definition in the target using a reviewed new bootstrap/import migration, temporarily using an isolated namespace where needed, then relocate to `shop_suit`. Preserve source files unchanged; maintain source-to-target object mapping. Resolve type-name collisions by ownership/schema placement, not enum conversion.
5. Copy data in dependency-safe order, include sequence state and referenced identity rows, and validate constraints/triggers. Imports must not replay business side effects such as stock movement, email, webhook, trial creation or ledger posting. Any controlled trigger suppression is confined to the isolated import and followed by full validation; never globally disable target protections.
6. Include the effects of the nine current Shop hardening/feature migrations and any newer hosted changes discovered at implementation. Do not replay the five obsolete public-schema migrations into Ledger's database.
7. Use approved API views/RPCs, least-privilege grants and unexposed raw tables. Update the copied Shop client from `shop_crm` to `shop_suit_api`.
8. Transfer any Shop Storage bytes and policies and configure required services explicitly. Database metadata alone does not copy stored files or external configuration. [Supabase migration/restore guide](https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore).
9. Reconcile row counts/digests, IDs, references, timestamps, stock/FIFO, expenses, subscriptions, plans and authorized reads/writes. Do not change Shop's `shop-crm` portal key merely to match a folder name; map its presentation identifier in configuration.
10. At production cutover, pause Shop writes through the deployment/routing boundary, capture/apply final changes consistently and prove reconciliation before switching the new app. Do not promise an online migration without an implemented synchronization mechanism. Source data remains available for recovery; do not delete or repurpose the original project.

### Migration history and reproducibility

- Keep Ledger's 66 original files byte-for-byte, subject to verification against target applied history.
- Preserve both Shop histories with exact filenames/content under `supabase/legacy/shop-suit/`, plus source project provenance and hashes. They are not automatically executable target migrations.
- Add a new current-state Shop import/bootstrap migration and ordered forward namespace/API/auth migrations. Generate new filenames with the CLI, not guessed timestamps.
- Maintain one authoritative active sequence for both target environments. Compare staging/prod divergence before applying; do not squash histories or casually mark migrations applied.
- Separate schema deployment, protected one-time customer-data import, and test/reference seeds. Import scripts track verified checkpoints and refuse incorrect environment/state.
- Fresh empty test bootstrap and upgrade of a representative populated database are separate verification paths. Historical destructive operations are allowed only in a proven empty/disposable replay context, never on hosted business data.
- Preserve raw pre-move seed/test files as reference; make new runtime seeds/tests target the moved schema and block use against production.

### Cutover and rollback

Stage first: backup/restore drill → migration dry run → representative import → namespace/API/auth changes → both applications → reconciliation → rollback rehearsal → final staged repeat after fixes.

Production uses the same reviewed artifacts and fixed environment refs. Serialize migration jobs; use bounded lock/statement timeouts, an explicit maintenance/write-pause plan and abort criteria. Drain relevant in-flight jobs/webhooks, retain retry/idempotency behavior, and avoid double-running scheduled work. Deploy compatible functions and app builds in the recorded order; update callback/origin settings without triggering real test payments or messages.

Before new writes are accepted, namespace/API/app rollback may be sufficient. After new writes, a whole old snapshot restore would lose data: keep writes paused, reconcile/copy back the new delta through a rehearsed procedure or roll forward. Define that point of no simple rollback explicitly. A failed preflight must leave the original live route intact.

Set one bounded compatibility window in WP-08, based on deployed clients and outstanding jobs; default to the cutover plus the next working-day verification. Remove/revoke only the newly introduced obsolete compatibility objects after zero caller evidence, or retain a specifically required external endpoint with a documented owner/contract. This is part of WP-09, not an endless cleanup project. Never remove unrelated `public` objects.

## 11. Shared accounts, login and portal isolation now

### Required model

```text
One Supabase Auth account per person in each environment
  -> shared identity/session implementation
  -> profile in the trusted current portal
  -> Ledger organization membership OR Shop shop membership
  -> that product's capabilities, subscription and data access
```

Production and staging share the model, not a session or customer-data store. One account across products does not merge organizations with shops, billing catalogs, roles, or data.

The initial physical adapters retain `ledger_suit.profiles` and `shop_suit.profiles` unchanged. The logical shared identity contract resolves the Auth account and the relevant existing profile/membership shape. A future physical `platform.users` bridge is not a prerequisite for the requested shared login and must not become a hidden table redesign during relocation.

### Existing-account migration

- Inventory source and target Auth users/identities and all Shop references in a protected migration environment; do not print PII/password hashes in logs.
- Preserve Ledger account IDs and credentials. Transfer only necessary Shop accounts with existing IDs where the supported migration method and collision checks allow it.
- Distinguish same UUID/same identity, different UUID/same verified identity, different identities with conflicting email/phone/provider IDs, unverified contacts, deleted/banned users, providers and MFA state.
- Never merge by display name, unverified email, or guessed identity. Supabase provider identity linking does not automatically merge two existing cross-project user UUIDs and their domain FKs.
- Rehearse supported import/reauthentication behavior; do not overwrite target `auth.users` or restore source Auth wholesale. Account confirmation/provider metadata and existing credential hashes need provider-compatible handling, not ordinary sign-up calls that create new IDs.
- Sessions, refresh tokens, provider settings and signing configuration are not assumed portable across projects. Preserve credential access where supported and plan a clear reauthentication step for moved Shop users. Do not disable verification to make migration pass.
- **Constraint gate:** if a collision requires changing a stored `user_id`, merging accounts, adding an identity mapping table or changing existing columns, that affected migration cannot honestly satisfy “just relocate.” Produce the exact collision report and smallest required exception for user resolution; do not remap silently or claim shared identity complete while leaving conflicting users behind.

### Signup and lifecycle coordination

- Inspect/reconcile Auth insert/update hooks so Shop registration does not accidentally create a Ledger tenant/trial or fail in a Ledger-specific trigger.
- Keep auth-event processing minimal and idempotent; explicit authorized onboarding provisions the current portal profile/tenant. Existing required profile-sync behavior must keep working for existing Ledger users.
- Namespace pending onboarding metadata/drafts by product. Metadata carries user-entered form data only, not permissions or trusted portal assignment.
- Support an existing account enrolling in the second product through authenticated onboarding; preserve invitation acceptance and ownership restrictions.
- Centralize password sign-in, recovery, verification/OTP, callback handling, refresh, logout, generic errors, rate-limit feedback and cache clearing.
- Preserve Ledger's verified-email requirement and evaluate the project-wide effect on Shop. Use common email confirmation settings required by the stricter existing flow, update Shop's verification experience accordingly, and do not lock out already valid users by rewriting confirmation state.
- Auth settings/templates are project-wide. Replace Ledger-only generic account email branding with family-level branding and allowlisted product return context; retain product-specific invitations/notifications. Inventory SMTP, recovery, OAuth callbacks, CORS and exact redirects for both environments.
- Preserve each product's required signup fields and credential methods. Building's future phone/WhatsApp/Google/biometric product flow is a separate configuration, not a forced conversion of these apps.

### Shared login versus browser SSO

Using the same project/account does **not** by itself share browser storage across origins. WP-04 must inspect the actual production/staging hosts and implement exactly one verified session strategy as part of this migration:

1. If both apps use trusted sibling subdomains and the existing session model supports it safely, use a deliberately scoped shared-cookie strategy with environment separation, secure attributes, SSR refresh coordination, CSRF controls and an audited subdomain trust boundary. Do not share cookies with unrelated or preview hosts.
2. For separate registrable domains, use Supabase's supported OAuth 2.1 authorization-code/PKCE flow and a minimal `apps/identity` authorization/login UI using the same Ledger-derived layout. Register each product/environment explicitly; validate client/redirect/state/nonce/PKCE, provide consent/denial handling and preserve product onboarding on return. Avoid custom bearer-token handoff, URL token sharing, iframes or broad parent-domain cookies.

The second strategy needs a standards-compliant client adapter: Supabase's OAuth-server client flow is distinct from ordinary `supabase.auth.signInWithOAuth` social-provider login. Test token refresh, SDK/Data API integration, client context and revocation explicitly. [Supabase OAuth server](https://supabase.com/docs/guides/auth/oauth-server), [OAuth flows](https://supabase.com/docs/guides/auth/oauth-server/oauth-flows).

Bounded SSO acceptance: sign in through one product, enter the other without entering credentials again when the hub session is valid, then resolve its profile/membership or show its onboarding/denial state. Explicitly define local sign-out versus sign-out-everywhere; revocation must stop refresh and sensitive server actions under the selected token-validity policy, and open tabs must clear product state. Do not promise instant invalidation of already-issued JWTs without implementing the required server check.

Trusted endpoints/API contracts resolve a fixed portal. Where OAuth client-specific restrictions are used, validate signed client claims server-side; an origin string, local storage value or request-supplied portal ID is not authorization. A Ledger-only member cannot read/write Shop data, and vice versa; a person intentionally enrolled in both has separate authorized contexts.

## 12. Building Suit documentation as its own app

Create a buildable `apps/building-suit-docs` with searchable/navigation-friendly rendering of the complete original documentation and a shared-component catalogue. Reuse tokens, typography and common UI; product-specific documentation navigation remains its own configuration.

Copy the **entire** `.docs` tree including EN/AR PRD/BRD, UX/UI/motion, architecture, database, API, security, testing, implementation, deployment, journey audits, business analysis, all brand chapters, source tokens, PNGs, PDFs, logos and exports. Preserve original prototype source, `.design-system-control` records and agent/plugin instructions as reference with clear provenance. Do not delete draft/open-decision material or claim prototype approval where none exists.

Extract these reusable documents into `docs/shared/`, retaining section-level citations and original status:

1. Brand foundations, voice, logos, fonts/icons, assets and design-token ownership.
2. Component/atomic design rules, component catalogue and template contracts.
3. Layout, responsive, RTL, light/dark, accessibility and motion rules.
4. Shared interaction policy, record actions, tables, forms and wizard behavior.
5. Monorepo/package boundaries, feature architecture and dependency direction.
6. Identity, portal context, tenancy, permissions, query/cache isolation and secrets.
7. Database ownership, API/private schemas, migration preservation and generated contracts.
8. Testing/verification standards, environment/deployment/rollback runbooks and AI workflows.

Keep Building-specific phone policy, buildings/units/occupancy, governance, financial dispute rules and Flutter architecture in its product documentation. Keep Ledger and Shop domain rules in their own app docs. Explain overrides from section 3 instead of copying contradictory instructions into common rules.

The docs app renders `docs/shared` and package-generated catalogue/token data through a build integration; do not create a second hand-maintained editable copy. Add provenance/index files, old-to-new link mapping, broken-link/asset checks and a document completeness manifest. Original snapshots remain identifiable. Shared documentation becomes the maintained rule source for all web products.

## 13. Tooling, CI/CD, AI rules and workflows

### Root tooling

- Provide documented root commands for `dev:ledger`, `dev:shop`, `dev:docs`, filtered builds, all builds, lint, typecheck, UI/contract tests, browser tests, token generation/checking and migration verification.
- Use distinct dev ports and app origins, one local environment strategy, and an explicit hosted staging test scope. Do not inherit conflicting source Docker/hosted-test conventions accidentally. No database reset command may infer a hosted target from a cached link.
- Centralize ESLint/TS/test settings. Enforce package boundaries, approved UI imports, no duplicate table/shell/controller, no service keys in client bundles, token/i18n completeness and old-migration hashes.
- Configure Turborepo dependency ordering, Nuxt `.output` build artifacts, docs output and environment-sensitive cache keys. Never cache deploys, migrations, external tests with side effects, secrets or database exports.
- Root CI runs affected packages and their dependents; a shared UI/auth/token change must validate both apps. Critical shared-database changes run both products' integration checks regardless of path filtering.

### Deployment workflows

- Give each product and docs app separate build/deploy configuration. Keep the existing host/provider where practical; monorepo migration does not mandate switching Netlify/Vercel providers.
- Root dependency changes and shared packages trigger dependent app deployments. Correct Shop's old app-path-only change detection and build-time environment placement.
- Configure staging/production app roots, output/presets, runtime variables, secret scopes, callback origins, health checks and rollback artifacts. Ensure deploys use the same verified commit/artifact.
- One serialized shared database deployment job per environment, independent of app deployment. Apps must not each push the same migrations on deploy.
- Run migrations against staging first. Production job requires the recorded staging result, environment/ref assertion, backup/restore evidence, drift check and concrete runbook. Never expose a production mutation through an unrestricted PR workflow.
- Preserve Ledger Paymob/invitation/notification/storage-cleanup behavior and registered endpoint URLs. Internal namespacing must not break provider callbacks; keep established external function names when needed and make their owning product explicit.
- Inventory shared Edge Function secret names, allowed origins, webhook handlers, Cron and Vault entries to prevent cross-product collisions. No new live Shop payment activation is included.

### AI-agent deliverables

Root [AGENTS.md](AGENTS.md) and [agent workflows](docs/agent-workflows.md) describe **ongoing development in the finished monorepo**. During implementation add scoped rules for apps, shared UI/tokens/auth and Supabase. Tool-specific agent configuration points to those rules instead of copying contradictory instruction sets.

Permanent guidance must teach agents how to find the owning app/package/schema, use current root commands, follow shared architecture/design/interaction rules, implement features and bug fixes, evolve schemas through new migrations, maintain authentication and documentation, add a requested platform, verify affected consumers, and release authorized changes. Use ordinary task/PR templates with outcome, ownership, affected contracts, verification and completion state.

**Keep one-time work out of permanent agent guidance.** Copy instructions, original-project paths/checksums, relocation/import steps, current access blockers, WP-00–09 sequencing and the relocation-only column freeze belong in this plan and `docs/migration/` runbooks. Agents doing future work must not be directed to rerun this migration, resume its work packages, or treat its temporary constraints as permanent prohibitions on authorized feature/schema development.

**Mandatory final review after the monorepo is built:** in WP-09, review every root/scoped agent rule file, tool-specific instruction entry point and agent workflow against the actual final repository. Check that paths exist, documented scripts/filters match package manifests, package/schema ownership and session architecture are accurate, shared source-of-truth references resolve, and examples for an app feature, shared component and database change lead to the correct owners and checks. Remove stale task-specific rules and placeholders. This is a documentation/navigation review, not a request to implement example features. Record the result in the completion evidence before saying `Done`.

Create a small `new-platform` template/generator that produces configuration, thin route/layout wrappers, shared package dependencies, i18n placeholders and a test skeleton. Verify it with a disposable fixture, then remove the fixture. It must generate no actual future product, database tables, deployment, billing model or new roadmap.

## 14. Finite execution order

Each work package has an exit condition. Progress automatically through authorized work once prerequisites pass; do not create new work packages to pursue unrelated improvements.

| Work package | Dependencies | Concrete deliverables | Exit condition |
|---|---|---|---|
| **WP-00 — Verify sources and environments** | None | Snapshot/copy manifest; exact source commits; fresh route/component/action inventory; production/STG project-ref map; deployed DB history/dependency inventory; current baseline failure list | Sources identified; target refs verified for remote work; all unresolved input/access facts recorded explicitly. Independent local work may proceed while remote access is unavailable. |
| **WP-01 — Copy and establish workspace** | Local portion of WP-00 | Copies in destination; flattened apps; root workspace/lockfile/config/Turbo; destination Git checkpoint; toolchain compatibility decisions; disabled legacy auto-deploy behavior | Apps run/build from destination at baseline; root filtered commands work; no imports/links/build artifacts written to originals; migration copies hash-identical. |
| **WP-02 — Preserve docs and materialize design foundations** | WP-01 | Complete Building docs/reference import; docs app; canonical tokens/generated outputs; brand/fonts/icons; initial atomic primitives and catalogue; source-conflict ADRs | Document/asset manifest complete, links/build pass, exact token provenance, no competing runtime token source. |
| **WP-03 — Extract shared templates and UI behavior** | WP-02 | Ledger landing/auth/signup/shell extraction; common modal/form/feedback controllers; typed product definitions; both apps consuming templates; basic `BsDataTable` API | Required layouts render in both products using the same code; signup fields/content remain product-specific; create/edit behavior shared. |
| **WP-04 — Resolve auth and database migration design** | WP-00 remote access; WP-01–03 interfaces | Identity collision report, Auth-hook plan, selected SSO mode/domain registry, dependency/ownership map, API compatibility matrix, forward migrations/import scripts, cutover/rollback runbooks | No unresolved data/column-change requirement hidden in scripts; migration preflight and auth/SSO contracts ready for staging. |
| **WP-05 — Rehearse schema transfer and shared identity in staging** | WP-04; verified backup/test scope | Backup/restore evidence; scoped Shop transfer; Ledger/Shop schema moves; API/private boundaries; profile adapters/hooks; shared account/SSO flow; configured storage/functions/jobs; generated types | Data/identity/schema invariants and negative isolation tests pass; staged login/signup/recovery/second-portal enrollment pass; rollback rehearsal passes. |
| **WP-06 — Convert all app callers and complete shared table** | WP-03; WP-05 contracts | All pages use shared components/actions/table; repositories target API schemas; full pinned table capability matrix/catalogue; obsolete Shop UI dependencies removed; new-platform template | Caller inventory fully converted; no accidental duplicate shells/tables/controllers; both product builds/typechecks/lint and applicable regression flows pass. |
| **WP-07 — End-to-end qualification and CI** | WP-05–06 | Both-product browser/isolation/invariant tests; UI screenshots/accessibility checks; documentation/root scripts; scoped agent rules; environment-aware CI/deploy workflows | Required matrix in section 15 passes on the final candidate; only unrelated product roadmap limitations remain documented. |
| **WP-08 — Production consolidation and deployment cutover** | WP-07; exact production access/runbook prerequisites | Final backup, drift check, bounded write pause, final Shop transfer, identical migration artifacts, compatible functions/apps, callback/settings updates, reconciliation | Both products use Ledger production project and their correct private/API schemas; required live smoke checks pass; data and service behavior reconcile. |
| **WP-09 — Close migration** | WP-08; bounded compatibility window | Final manifest/source preservation checks, limited compatibility cleanup, post-build review of all permanent agent rules/workflows against the actual monorepo, final evidence report and destination commit | Agent guidance contains only ongoing development rules/workflows with verified navigation and commands; every required acceptance item passes; no unresolved migration blocker; report **`Done`** and stop. |

WP-04/WP-05 remote prerequisites do not prevent finishing the copy, shared UI and documentation work. They do prevent claiming the database or shared identity migration complete. Missing access is a concrete blocker, not a reason to redirect the work to a different project or generate replacement infrastructure.

## 15. Acceptance matrix and definition of Done

“Works flawlessly” is operationalized as all checks below passing for the implemented scope, with no known migration regression. It is not an unsupported promise that every future product feature is complete.

### Requirement traceability

| User requirement | Implementation coverage | Required proof |
|---|---|---|
| One monorepo | Sections 4–5; WP-01 | One workspace/lockfile; independent app builds and shared dependency graph |
| Shared UI, architecture, system design and patterns | Sections 3, 5–9 | Enforced package boundaries; common feature structure, adapters, contracts, state and UX policy |
| Building color palette/design system/branding | Section 6; WP-02 | Canonical token comparison, assets/fonts/icons, both themes/languages, catalogue |
| Existing Ledger prod + Ledger STG project | Section 10; WP-00/05/08 | Verified immutable refs and environment checks; both apps connected to each correct target |
| Product-owned private schemas | Section 10 | Raw schema exposure denied; approved API works; RLS/grants/tenant isolation pass |
| One login/users, now if conflict | Section 11; WP-04/05 | Existing identity reconciliation; shared-account and selected SSO flow; no signup-trigger collision |
| Full Ledger landing layout shared | Section 7 | Both rendered pages use same template, with product content and valid links/pricing |
| Ledger login layout and placement shared | Section 7 | Both auth entry flows use shared template across responsive/theme/language states |
| Same auth layout for signup | Section 7 | Signup uses the shared auth frame in both apps |
| Ledger signup wizard shared with product requirements | Sections 7/11 | New/existing account, OTP/resume, independent forms/provisioning/trials, idempotent completion |
| Ledger sidebar/header/content container shared | Section 7 | One shell, both tenant adapters/navigation configurations, no duplicated implementation |
| PrimeVue and one table with complete option coverage | Sections 6/8 | Pinned API matrix, catalogue, all inventoried table callers converted |
| Other components shared across two or more apps | Section 6 | Reuse inventory and import checks; no app-to-app imports |
| Consistent UI behavior and central logic | Section 9 | Same add/edit/confirm/feedback/dirty-state behavior; shared change affects both apps |
| Atomic Design where appropriate | Section 6 | Atoms/molecules/organisms/templates, with domain pages and rules outside generic UI |
| All Building documentation as its own app | Section 12 | Full source-file/asset counts and hashes reconciled; docs app builds and links work |
| Extract common docs/tokens | Sections 6/12 | Source-to-shared traceability, active authority map and generated token consistency |
| AI workflows and rules for future monorepo work; reviewed after building | Section 13; WP-09; root/scoped rule files | Ongoing feature/fix/shared UI/database/auth/docs/release workflows; verified repository navigation/commands; no one-time migration instructions or temporary restrictions in permanent guidance |
| Copy into selected directory without touching old projects | Section 4 | Copy manifest, no outside-path imports or writes, original source hashes/Git state compared |
| Do not change old migrations/columns; only relocate | Section 10 | Historical hashes unchanged; normalized schema/data diff; exact exceptions blocked before change |
| Bounded finish, Done and stop | WP-00–09 and section 16 | All acceptance rows passed; no automatically generated follow-up backlog |

### Verification suites

1. **Workspace:** reproducible install, lint, typecheck, every app build, docs build, package-boundary checks, token drift, generated DB types, migration hashes, secret/client-bundle checks.
2. **UI:** representative screenshots of landing/login/signup/shell/table/dialog in EN/LTR and AR/RTL, light and dark, mobile/tablet/desktop; keyboard/focus/labels/contrast/reduced motion; no hydration/theme flash regressions.
3. **Shared behavior:** add/edit from toolbar/row/empty state; validation, duplicate submit, failure retry, success refresh, cancel/dirty navigation, focus restoration; every table capability group and documented incompatible combination.
4. **Authentication:** new signup, verification, resend/expiry, abandoned/resumed wizard, second-product enrollment, existing migrated account, wrong credentials, recovery/reset, invite acceptance, refresh and expired session, logout/account switching, real-origin SSO and replay/open-redirect denial.
5. **Authorization:** anon, Ledger-only user, Shop-only user, dual-portal user, owner, employee/member, read-only and suspended users; other tenant's IDs and references; forbidden export/direct RPC; subscription/permission boundaries. Membership or client-hidden controls must not be bypassable.
6. **Ledger parity:** organization selection/onboarding, balances and posting/reversal invariants, accounts, record dialogs, transactions, reports, imports/exports, team/invitation flow, audit, billing/entitlements, attachments and relevant background workers. Use existing tests and representative fixtures; preserve exact pre-move financial totals.
7. **Shop parity:** signup/login/shop selection/bootstrap, plan reads, dashboard, product/service create/edit/archive, manual inventory/FIFO, paid expense/category/void flows and subscription/permission checks. Do not claim unimplemented sales/purchasing/reporting workflows have passed.
8. **Database:** table/column/type/constraint/index definitions; IDs/values/counts/digests; no dangling FKs; sequence next values; profiles/users; plan/trial/subscription values; stock/FIFO and financial reconciliation; RLS/views/RPCs/search paths; storage access; Realtime; functions/jobs/webhooks and migration history. Check both upgrade and fresh test bootstrap paths.
9. **Recovery/deployment:** staged restore and rollback exercise, shared-database concurrency lock, correct target assertions, app build/callbacks, bounded write pause/final sync, production smoke checks and no duplicate scheduled side effects.
10. **Documentation and source preservation:** entire imported corpus accounted for, no broken source/asset links, all common rules traceable, originals untouched by the task. After the build is finished, verify all permanent agent rules/workflows against actual paths, scripts, owners and conventions; ensure they support future development and contain no one-time migration instructions or temporary restrictions.

Store results with commit, environment, exact command/scenario, outcome and artifact location. Reuse existing tests where meaningful; add tests for shared behavior, identity conflicts, schema moves and isolation, not trivial file moves. Fix relevant failures once, rerun affected checks, and run the final required suite. Do not keep adding tests after the exit criteria pass.

## 16. Known execution prerequisites and stop rule

The plan is complete. These facts must be resolved during the named work packages, not invented during execution:

- **Target access and refs:** the current credentials cannot access Ledger's linked ref and cannot identify Ledger Suit STG. Needed before target inventory or remote mutation.
- **Current hosted drift:** Ledger live history/schema, newer Shop changes, source dependency closure and backups require fresh verification at execution time.
- **Identity collisions:** their existence is unknown until both Auth namespaces can be inspected. Any collision requiring stored-ID changes needs a concrete exception decision under the user's preservation constraint.
- **Actual domains/session topology:** needed to select and configure the single SSO strategy, callback allowlists and optional identity UI host. Do not invent domain ownership or silently publish new hosts.
- **Deployment/write pause:** identify active deployments, provider access, ongoing jobs and the bounded final synchronization window before production cutover.
- **Definition of permissible compatibility changes:** namespace repairs and API/auth integration are included; a required alteration to existing business columns, values or constraints is not. Identify a precise conflict instead of broadening scope.

At completion, produce one evidence report listing the final app/package paths, environment/schema map, performed checks, retained unrelated baseline limitations and original-source preservation result. Do not claim commercial launch approval or completion of the old product roadmaps.

When WP-00 through WP-09 and the required acceptance matrix are complete: **say `Done` and stop.** No new improvement plan, future-product implementation, recurring task, speculative optimization or additional work package follows automatically.
