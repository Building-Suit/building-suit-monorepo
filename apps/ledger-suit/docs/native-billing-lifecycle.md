# Native local billing lifecycle

LS-BILL-NATIVE-001 uses one explicitly disposable, fixed owned Ledger project. Read the [work package](accountant-system/work-packages/LS-BILL-NATIVE-001.md) and [dated evidence](accountant-system/v2-acceptance/native-billing-verification-2026-10-26.json) before interpreting results. Hosted release, live Automation reconciliation and accountant UAT remain separate.

## Prerequisites and ownership

Use the repository's pinned Node/pnpm/Supabase CLI, local Unix Docker socket and verified native provider image cache from the [financial verification](native-financial-verification.md) and [recovery](restore-retention-portability.md) work. The billing helper adds the official pinned Edge Runtime 1.74.3/Deno 2.1.4 filesystem. It requires checksum-verified crane 0.20.7, available on PATH or selected by `LEDGER_CRANE_BINARY`. It imports the exact exported filesystem with matching process/environment configuration for the managed `vfs` driver, verifies the rootfs digest and removes only its generated tar. No provider SQL shim is installed.

The project is `ledger-billing-20261025`, under ignored `.local/verification/billing`; API/DB/Mailpit/UI are 60821/60822/60824/60830. Every helper requires `LEDGER_BILLING_DISPOSABLE_TEST=1`, accepts no connection URL or credential and validates its marker, workdir, project and ports. Runtime start refuses volumes older than the marker. Private generated keys/passwords, logs and state stay in the owned ignored directory. Do not print those files or signed receipt URLs. No helper resets/deletes financial data or volumes.

Before network/Docker work in the managed environment, inspect its current policy and configured credentials. Preserve Docker auth/proxy configuration and certificate verification. The network helper appends exact local service exemptions plus the pinned CLI's dedicated `kong` gateway alias. The read-only function mount carries the host's combined public CA bundle; `SSL_CERT_FILE` points there and `DENO_TLS_CA_STORE=mozilla,system` preserves both stores. The pinned npm certificate provider otherwise replaces earlier system roots when processing `mozilla`. Never disable TLS verification.

## Prepare and start

From the current worktree root:

```sh
export LEDGER_BILLING_DISPOSABLE_TEST=1
node apps/ledger-suit/scripts/prepare-native-billing-project.mjs
node apps/ledger-suit/scripts/prepare-native-billing-network.mjs
node apps/ledger-suit/scripts/prepare-native-billing-image.mjs
node apps/ledger-suit/scripts/native-billing-runtime.mjs start
```

Existing required provider aliases must be cached; startup fails rather than silently substituting a provider. Startup checks actual Auth/Storage/REST HTTP 200 after bounded readiness polling. Alpine wget health labels can remain unhealthy behind the platform proxy; that is distinct from the required actual requests. If disk/readiness fails, inspect the owned private log and resource state. Preserve all finance/recovery volumes; rebuildable task-owned caches can be removed deliberately.

Serve functions in another terminal; JWT verification stays enabled:

```sh
export LEDGER_BILLING_DISPOSABLE_TEST=1
node apps/ledger-suit/scripts/native-billing-functions.mjs
```

## Verify and run the real UI

The SQL helper runs the three unchanged pgTAP fixtures through real PostgreSQL/psql, requiring complete plans and identical before/after data fingerprints. It does not need the CLI's separate pg_prove image. Run it before creating the lifecycle fixture:

```sh
node apps/ledger-suit/scripts/test-native-billing-sql.mjs
node apps/ledger-suit/scripts/test-native-billing-lifecycle.mjs
pnpm --filter @building-suit/ledger-suit prepare
pnpm --filter @building-suit/ledger-suit build
```

The lifecycle is a checkpointed single synthetic run. It saves each completed dated step before continuing, so an interruption does not reset the database or duplicate a financial journal. Completion labels are historical step evidence; `verify-native-billing-result.mjs` freshly checks final actual rows, migration identity and provider readiness independently. Initial fixture failures are recorded in the work package. A new intentionally different scenario requires a separately owned scope; do not erase this one.

Start the built frontend in another terminal:

```sh
node apps/ledger-suit/scripts/native-billing-ui.mjs
```

Use Playwright's installed Chromium, or explicitly select a local executable with `LEDGER_CHROMIUM_EXECUTABLE_PATH`. The recorded environment used `/usr/bin/chromium` 154. The browser helper signs in through actual email/password UI, quotes/uploads on mobile, and previews/approves on a separate dedicated operator desktop session. It installs no API interception or session injection. `baseline` is only for the actual old frontend to reproduce the internal-host receipt link; run `verify` on the fixed build:

```sh
node apps/ledger-suit/scripts/test-native-billing-browser.mjs verify
node apps/ledger-suit/scripts/test-native-billing-preview-expiry.mjs
node apps/ledger-suit/scripts/test-native-billing-upload-boundary.mjs
node apps/ledger-suit/scripts/verify-native-billing-result.mjs
```

The expiry helper requires the actual signed lifetime to have elapsed; continue other checks instead of changing clocks or bypassing expiry. Subscription time-boundary simulation is explicitly limited to the owned test subscription's SQL dates. The seat-quota test reserves an invitation in SQL without sending an email. Only the owner's signup confirmation is delivered through local Mailpit; other synthetic identities use explicit trusted local Auth provisioning.

## Preserve and stop

Stop the owned UI/function supervisors in their terminals, then:

```sh
node apps/ledger-suit/scripts/native-billing-runtime.mjs stop
```

This preserves test database, Storage and module-cache volumes. Do not use reset, no-backup, prune-volume or destructive cleanup commands. Check ownership again before restarting after an environment interruption.
