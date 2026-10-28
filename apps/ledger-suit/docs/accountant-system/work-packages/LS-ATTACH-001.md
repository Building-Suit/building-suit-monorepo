# LS-ATTACH-001 — private upload admission and exact file bytes

2026-10-23. Parent PR #452 at `0a51f6ee860ac77d8d0258bbd4c248e3bf0e1e5e`. The native recovery rehearsal exposed a valid reserved attachment upload failing with Storage HTTP 403. This is a product repair split from the unfinished recovery work; that worktree's pending runtime helpers were excluded from this branch.

## Cause and correction

The actual Storage 1.70.3 uploader tests RLS using `metadata.contentLength` before transferring bytes. Ledger's predicate required `metadata.size`, which the provider records after transfer. In addition, the SDK turns a browser `File`/`Blob` into multipart form data: the declared request length includes boundaries and differs from the reserved file size.

The forward migration supports exact `contentLength` admission and the existing exact `size` shape. At least one length is required; if both appear, both must equal the reserved bytes. Missing, null, conflicting, oversized and noncanonical lengths fail. The existing reservation owner, expiry, exact object/bucket, MIME and capability checks remain mandatory. No provider table or Storage policy is replaced, and no grant changes.

Both transaction attachments and import source documents now send the file's raw `ArrayBuffer`. This keeps the request length equal to the reserved file size. A local file-read failure aborts the reservation. The original commit operation still validates the actual stored size/MIME, atomically creates metadata, preserves quota accounting and reuses the attachment on retry. Unknown-length and oversized multipart requests are not admitted as a substitute for exact sizes.

Reviewed upstream source: [Storage uploader v1.70.3](https://github.com/supabase/storage/blob/v1.70.3/src/storage/uploader.ts), `canUpload`, `upload`, `completeUpload` and `fileUploadFromRequest`. Its final database write uses provider authority, so allowing a MIME-only preflight would have weakened byte admission; this implementation retains exact declared-byte validation instead.

## Actual verification

[The dated evidence](../v2-acceptance/storage-upload-admission-2026-10-23.json) retains source identities and results. The real Auth/Storage/PostgREST stack uses the owned local recovery-source project on ports 60621/60622, with an official unmodified Storage 1.70.3 image. It is separate from any hosted project. Native tests provision synthetic users through the real Auth admin API, sign in normally and exercise actual JWT/RLS/Storage requests.

The pre-migration runner reproduced HTTP 403 for valid reserved raw bytes. After the forward migration, raw binary and browser-file bytes upload/commit/download exactly, commit retry reuses its attachment, and quota usage equals the three objects' 147 bytes. Direct multipart overhead, wrong size/MIME, forged user metadata and anonymous/viewer/outsider writes are rejected. All rejected uploads leave exactly the three intended object/attachment rows.

Before and after applying migration `20261023202826` to that source, all 122 existing public/app table fingerprints match: SHA-256 `30ffc15d69b5097ecf0597d9fb51fe998ae6443b0b7a4987eafe6aa55f46fe8f`. The original 11 journals / 22 entries, AR/AP, asset/bank records, imports, recurring rule and audit history remain intact. The original 106 applied migration files are unchanged. Test writes afterward are separately identified synthetic fixtures.

All 66 native SQL files / 1,996 assertions, 128 Ledger units and four targeted browser cases pass. Ledger typecheck, lint, production build and workspace checks pass. The standard database suite adds 17 focused permission/metadata/expiry regressions. EN/AR browser checks inspect the exact outgoing PDF bytes and MIME from both transaction attachments and reviewed import documents. Those UI requests are controlled fixtures; the independent native runner supplies actual provider evidence.

To run the native regression in a designated owned local full Supabase stack, supply its keys through the environment, never command arguments or committed files:

```sh
LEDGER_STORAGE_DISPOSABLE_TEST=1 node apps/ledger-suit/scripts/test-storage-admission-native.mjs verify
```

`LEDGER_STORAGE_API_URL` defaults to the isolated Ledger `http://127.0.0.1:60321`; the guarded recovery source `http://127.0.0.1:60621` is also supported. Set `LEDGER_STORAGE_ANON_KEY` and `LEDGER_STORAGE_SERVICE_KEY` for that exact project. The `baseline` mode is only for the retained pre-migration 106-version environment; `verify` requires the new version. Hosted URLs and unknown resource owners are rejected.

The source recovery fixture remains committed and preserved. Timed database/Storage restoration, off-site backup operation, live Automation reconciliation, configured hosted review and accountant UAT remain separate readiness gates. No hosted migration, provider configuration change or claim of unrestricted sale readiness occurs here.
