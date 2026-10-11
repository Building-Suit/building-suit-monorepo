# SAS-M1-REGISTRY-001 local verification

Implementation is ready for independent inspection, with acceptance still blocked
by the missing linked shared shell and unavailable runtime verification below.
No commits, pushes, merges, deployments or hosted database changes were made.

Executed on 2026-10-06 in this task's worktree. Commands used the available Node
24 runtime on PATH; the pnpm executable still emits its own Node 20 engine warning.

| Exact check | Result |
| --- | --- |
| `pnpm agent:preflight` | Failed: fetch/GitHub state could not be verified. |
| `pnpm --filter @building-suit/super-admin-suit test:unit` | Passed: complete app suite (auth, bootstrap, registry). |
| `node --test apps/super-admin-suit/tests/unit/*.test.mjs` | Passed. |
| `node apps/super-admin-suit/tests/unit/registry.test.mjs` | Passed: 4 behavioral/source checks. |
| `pnpm exec turbo run typecheck lint build --filter=@building-suit/super-admin-suit` | Passed after fixing state typing and request-fetch type inference. |
| `pnpm check` | Passed: canonical tokens, workspace boundaries and historical migration checks. |
| `pnpm test` | Failed: tooling/control-plane batch-ssh-transport and tooling/git dev-worktrees suites. Focused direct executions exposed sandbox `spawnSync EPERM` for Bash/Node subprocesses. All Super Admin test files passed. |
| `git diff --check` | Passed. |
| `pnpm --filter @building-suit/super-admin-suit exec playwright test tests/e2e/registry.spec.ts --workers=1 --retries=0` | Failed before tests: configured web server exited. Direct server execution exposed sandbox `listen EPERM 127.0.0.1:4324`. |
| `pnpm --filter @building-suit/super-admin-suit exec playwright test tests/e2e/auth.spec.ts --workers=1 --retries=0 --repeat-each=2` | Failed before tests for the same server restriction. |
| `pnpm exec supabase test db --local` from this app | Failed before SQL execution: read-only telemetry write under the user Supabase directory. Docker socket access is also denied. |
| `pnpm exec supabase gen types typescript --local --schema public` from this app | Failed for the same Supabase telemetry restriction. Checked types were preserved, not hand-patched. |
| `pnpm db super-admin-suit migration new registry_navigation` | CLI scaffold failed on its telemetry write. Forward migration created in the app-owned migration directory manually. |

No screenshots or rendered states were reviewed. Browser, database migration,
RLS/projection execution and generated-type acceptance are unverified. Required
next checks are the full disposable local reset/test/type generation and both
browser commands above in an environment permitting Docker and local listeners.
The app README documents descriptor contracts and the missing BS-SA-SHELL-001
shared-template prerequisite. Only this task's app files changed; shared packages
and all other products were preserved.
