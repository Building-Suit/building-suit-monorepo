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

## Parallel workspace pipeline, 2026-11-09

The workspace workflow is replaced with an explicit validation graph. It retains the
`Verify workspace` workflow identity and `.github/workflows/ci.yml` path, and the
required `branch-policy`, `review` and `verify` contexts. Existing independent
financial, database, mobile, provider and authorization workflows remain intact.
They are not redundant just because workspace validation also runs.

- `plan` distinguishes metadata edits, normal review and full protected/root
  validation. Title/body edits retain separate metadata contexts and concurrency
  groups; retargets and ambiguous edits still validate code.
- Unit/workspace/provenance, HQ worker invariants, HQ cancellation browsers and
  disposable release-catalog checks run independently. `review` succeeds only
  when every lane succeeds. No failure, cancellation or unexpected skip is green.
- For staging/promotion roots and protected pushes, typecheck, lint and the full
  application build start independently of review. GitHub-hosted runners isolate
  their files, ports and disposable databases. The old repository-wide
  `workspace-full-validation` queue is removed; unrelated PRs and protected
  pushes no longer serialize behind one another.
- Build and built-asset checks run once. A one-day artifact carries only generated
  `.output` directories, a tested-commit marker and archive checksum. Browser jobs
  download only the successful producer artifact ID from their own run and verify
  its SHA marker and checksum. This supports retrying only failed browser jobs
  without rebuilding a successful producer from the preceding attempt. After the
  one-day artifact expires, use Re-run all jobs. No cross-run build cache or
  privileged artifact consumption is added.
- The existing foundation and shared-regression Playwright configurations each
  run as two complete shards, on different runners. The deployed-only public
  changelog suite remains a separate SQL/browser lane. At most four browser jobs
  run at once. Tests, worker counts, retries, fixtures and per-suite setup/cleanup
  are unchanged. Shared fixtures are never parallelized inside one runner.
- `verify` is a fail-closed aggregate over the plan, branch policy (PRs), review,
  both static checks, build/assets and all browser shards. Only a successful
  protected-push `verify` can unlock the unchanged release catalog and signed HQ
  worker publishers. Environment serialization, attestations, schema compatibility,
  deployment readiness and protected-ref checks are unchanged.

Measured pre-change examples, not promises: PR #561 run `42669363071` took 21m42s
(6m54s review then 14m39s verify). Staging push `42658162558` queued verify for
19m30s behind another run, then spent 17m58s in verify; its workflow took 45m17s.
The redesign removes that global wait and overlaps independent work. Runner quota,
cache state and application-test duration still affect completion time. Measure
exact-head runs after rollout before quoting an achieved speedup. Parallel setup
may increase runner-minutes even when wall-clock time falls.

Guard tests live in `tooling/git/tests/ci-workflow-efficiency.test.mjs`; release
trigger and protected-verification regressions also exercise publication identity.
Local validation and the exact GitHub run results belong in the review PR. Passing
focused tests alone does not establish full workspace or deployment readiness.

## Preinstalled workspace browser runtime, 2026-11-11

`unit-review`, `hq-browser`, `build` and every `browser-tests` shard use the same
official Microsoft Playwright `v1.62.1-resolute` image, pinned to OCI index digest
`sha256:aebd85bce8056dcdc2269853fd94ea432b6a201da4f0ef125b509489ecd52ddb`.
The index and its Linux/amd64 manifest were verified against the official MCR
registry. The image supplies Chromium, its headless shell, fonts and OS libraries;
these jobs no longer run `playwright install --with-deps` or contact Ubuntu apt
mirrors at runtime. This addresses the repeated DNS failure in staging run
`43036447641`, not a failing product assertion.

The builder and browser consumers share Ubuntu 26.04, architecture, image digest
and the repository's Node version so restored native artifacts do not cross OS
releases. `actions/setup-node` still reads `.node-version` (26.8.1); the image's
bundled Node 24 does not replace it. pnpm 10.33.0, frozen-lockfile installation,
all tests, shard configuration and artifact identity/checksum rules remain.
Container scripts explicitly use Bash, including the existing artifact-ID guard.
`--init --shm-size=1g` provides process reaping and shared memory without host IPC,
privileged mode or additional capabilities. Fixtures remain local and synthetic.

`tooling/ci/playwright-runtime.mjs` fails before tests when the image, installed
Playwright, root manifest, Node, OS or browser path disagree. It also launches the
bundled Chromium and checks a local page. Git, Bash, OpenSSL and flock must be
available. A dependency upgrade must update the image version and independently
verify its digest, update the workflow guard test, then run complete workspace
validation. Never silently install missing browser dependencies or substitute a
host browser. Review image/OS screenshot differences instead of automatically
updating reference images or relaxing assertions.

The image is about 998 MB compressed per cold amd64 pull; it trades repeated apt
and browser downloads for a versioned MCR pull. It is a reliability improvement,
not a guaranteed wall-clock reduction. MCR, package and GitHub access remain
required. Measure the full run and runner usage. The Docker/Postgres validation,
specialist workflows and both publication jobs are unchanged. No settings,
permissions, resolver changes, bypasses or test exemptions are introduced.
