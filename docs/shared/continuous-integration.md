# Continuous integration ownership

CI consolidates repeated setup/build work while retaining distinct product, financial and authorization checks. A failing check is not evidence that it is redundant.

## Consolidation, 2026-10-19

The workflow sources decrease from 23 files / 32 job definitions to 14 files / 19 job definitions. GitHub’s displayed check count is not a fixed workflow count: it also includes provider statuses, skipped jobs, metadata runs and checks contributed by earlier commits in a promotion PR. Historical runs remain visible after workflow deletion.

| Retired workflow | Maintained coverage |
|---|---|
| Shop website slug, profile, catalog, public showcase | `shop-website-launch-disposable.yml`: existing launch SQL matrix plus address/profile/catalog/showcase browser configurations |
| Shop appointment access, customer portal, public booking | Launch SQL matrix plus the existing access/actions/customer portal/booking browser configurations |
| Shop hostname isolation | Launch workflow: hostname unit contracts, built-server suffix test, suffix and owner browser configurations; its shared launch test runs once |
| Shop appointment email reminders | Launch workflow: Deno deployment graph, generated email check, reminder/schedule unit contracts, reminder SQL/concurrency, existing reminder browser configurations |
| Separate Doctor auth-protocol and actual-provider jobs | `doctor-browser` builds once and runs preview, protocol, stress, portable edge typecheck and actual local Auth/Storage/Functions acceptance in sequence |
| PR #345 bootstrap backend/evidence jobs | Retired after #345 merged on 2026-10-17. Source runners and historical evidence remain intact. Normal full workspace browsers and shared regressions continue through `pnpm test:e2e` |

The launch matrix still runs the full maintained Shop regression and seven website/booking SQL runners. Its owned disposable backend remains active through reminder SQL qualification and is stopped before the app build/browser fixtures. Cleanup runs on failure/cancellation. The longer consolidated jobs have explicit timeouts; fewer parallel builds reduce runner usage, but a single job can take longer and stops at its first failing step.

The launch path filter includes all Shop source, shared packages, root dependency/Node inputs and every absorbed feature runner. Editing a removed feature runner therefore still schedules its maintained owner. Distinct media, returns, tax, commission, service-material, XPay, ETA, provisioning, SAS live authorization, shared settings and release publication coverage remain separate because their acceptance/lifecycle requirements are not equivalent to the launch suite.

`branch-policy`, `review`, `verify`, protected-push validation, release provenance, cancellation failure semantics and publication readiness remain active. No branch protection, deployment configuration or environment variable was changed. At the audit, staging release context configuration required `verify` plus Shop’s staging Vercel status, not any retired context; production had no environment-level `RELEASE_REQUIRED_CONTEXTS` variable. That is an observation, not a production-readiness claim.

## Maintaining CI

Extend the owning suite instead of creating a feature-specific workflow that repeats its build and predecessor tests. Keep independent jobs when isolation or a genuinely different service contract requires them. Before retiring a workflow, compare its commands, path triggers, environment, artifacts and cleanup with its successor; move unique obligations first. Do not retire a failing check to make a PR green.

Title/body edits retain separate metadata contexts, while code changes and retargets still require full validation. Historical Doctor milestone evidence is not regenerated or declared accepted by this consolidation.

Validation for this change: source review only locally. No local tests, lint, builds, typechecks, browser runs or disposable databases were executed, per the owner’s instruction. GitHub CI on the review PR provides execution evidence; consolidation alone does not repair existing failing application tests.
