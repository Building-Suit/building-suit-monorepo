# DOS-M1-012 working evidence

Parent: PR356 head `a43ae003af9b875c861369cee69ae5222bb65558`. Immutable planning remains PR345 head `4ca7110f4d6efa828e0b41213e5c059bf02ba9db`. The implementation tracker distinguishes checked portions from open acceptance.

All four DOS-M1-012 criteria remain **OPEN** while implementation and actual-service verification are in progress. No upload, identity verification or clinical interpretation is counted as accepted here. Existing PostgreSQL/provider-interface scaffolds and HTTP fixtures do not close real Supabase service acceptance.

The planned administrative attachment contract uses a private Doctor bucket, bounded PDF/PNG/JPEG files (5 MiB), trusted server byte/type validation, immutable uploaded versions and uploader/time/location history. Clients receive metadata and current-authority file delivery rather than public object URLs. Stored patient relationships remain practice-owned; a working clinic attributes an operation and does not own the person. Entered patient data and uploaded/unreviewed files never imply a clinical finding, verified patient identity, prescribed treatment or reviewed result.

Product server orchestration belongs in the Doctor-owned Supabase Edge Function. It validates the caller against actual Auth and the Doctor SQL session contract; trusted service credentials stay server-only. Server-only metadata finalization follows byte/type/hash checks, while current database permissions are rechecked for every write/delivery. Client direct Storage access is denied. UI composition remains entirely in packages/ui, with app-owned logic/props and shared UX cleanup. This uses the plan's allowed Supabase function paths and avoids adding Suit-local presentation or a second application framework.

An owned cloud CI fixture will exercise actual local Supabase Auth/Storage/Functions without hosted connections or external email. Unused local services may be excluded to fit the runner; excluded Realtime acceptance must remain explicitly open. No unhealthy-service override or skipped/fabricated provider pass is allowed. Only synthetic accounts/files may be used; credential bodies, keys, emails and callback material must not be retained as logs/traces/screenshots.

No hosted migration, deployment, provider purchase, external message, Automation import/activation or main/stg merge is authorized. Genuine clinical/legal/catalogue/provider gates remain separate.

## Backend checkpoint (partial task)

The actual migrated PostgreSQL suite passes 67 new document assertions (378 cumulative) and 14 inherited real transaction races. The private file handler passes 11 focused Node tests, including validation, retry, corrupted bytes and permission revocation during I/O. Portable Edge source passes strict TypeScript checking. These are executed local results; they do not prove actual Auth/Storage services or patient-facing browser acceptance.

A dedicated `doctor-actual-provider` GitHub job now starts an exclusively owned local Doctor project and exercises actual confirmation mail captured locally, Auth sessions, Storage bytes and the Edge runtime. It refuses linked directories and existing project containers/volumes, captures all key-bearing CLI output, and cleans up only its own lifecycle. Realtime is excluded and remains UNRUN. This job is initially UNRUN until GitHub executes it. All four task criteria remain OPEN until the complete UI and acceptance paths pass.

## UI and service compatibility checkpoint

The new canonical `BsPatientProfilePage` renders `/patients/[id]`; the directory now links to it. Recorded fields are explicitly entered/unverified. Administrative history and file versions show account and clinic attribution; attachment metadata remains uploaded/unreviewed without findings or interpretation. Raw file bytes and preview URLs remain in memory. Context/session loss, navigation, dialog closing and scope disposal abort or reject late payloads and revoke previews. File service unavailability preserves metadata/history and disables delivery/upload.

Executed focused checks: 19 Doctor file/profile tests and one shared Blob URL lifecycle test pass. Four new protocol browser journeys pass (English desktop dark and Arabic mobile light): private profile, file validation, lost-response retry/double-click, immutable replacement history, image preview disposal, archive preservation, independent doctor scopes, read-only clinic and open-upload revocation. These owned HTTP journeys remain distinct from actual provider acceptance.

The first actual-provider cloud attempt exposed an unsupported CHECK constraint on managed `storage.buckets` (`must be owner`, SQLSTATE 42501). This draft-only migration was corrected before integration; no hosted/shared migration was applied. Bucket creation/configuration now uses supported local CLI/Storage API interfaces. The function checks the bucket is private and bounded before Storage I/O. Restrictive bucket/object client policies remain. This follows Supabase's read-only managed-schema guidance: https://supabase.com/docs/guides/storage/schema/design. The subsequent real-provider run is pending; no service acceptance is claimed from a failing startup.

## Verification checkpoint before the UI commit

- Actual PostgreSQL: 68 task assertions, 379 cumulative; six new document races and 20 cumulative independent transaction races pass. Races cover one finalize receipt, replacement CAS, upload/delivery revocation, signout and patient archive after lock waits.
- Full root unit suite: 1,745 passing and 23 optional infrastructure skips at that checkpoint. A later stale archive-confirmation regression also passes: the app must retain the version the user confirmed if a foreground refresh discovers a replacement. The complete suite will be rerun after that addition.
- All seven applications build and typecheck. Root lint has zero errors and ten existing UI warnings; new source passes focused lint. Strict Edge TypeScript and workspace boundaries pass (100 complete route templates, zero Suit-local components). Immutable planning is unchanged.
- Complete Doctor HTTP protocol browser suite passes all 25 journeys and the unconfigured public suite passes all 34 journeys. These are owned fixtures. Inherited CPU/RPC stress and shared consumer browser regressions are running separately; their results are not assumed.
- CLI diagnostics now return fixed categories, fixed service identifiers and a whitelist of valid SQLSTATE codes only. No arbitrary raw line, match excerpt, error message, SQL detail or short-secret value is reflected. Four adversarial diagnostics tests pass. The actual-provider wrapper owns a detached function process group so cleanup includes the pnpm CLI child and cannot hold the job open after completion.

Real-provider progress is partial: actual local Auth confirmation and owner onboarding, private upload and exact retry passed before a fixture assertion. The fixture now obtains private object metadata through the service-only delivery RPC instead of a denied table read. The current real-provider run has not completed all byte validation/isolation/history/session assertions, so actual-service acceptance remains OPEN. Realtime and broader Auth recovery/PKCE journeys remain unrun by this job.

## Completed local acceptance paths / remaining provider check

All seven builds/types and root lint passed; the root suite subsequently passed 1,746 tests with 23 optional infrastructure skips after the stale-confirmation regression. The fresh Doctor build passed the four focused document journeys again. The complete protocol suite passed 25, CPU/RPC stress four, public 34, shared auth/access/signup 48 and shared settings 12. New source lint, strict Edge typing, diff hygiene and 100 complete template boundaries pass. No planning file changed.

The actual provider run reached its oversized-upload assertion after real Auth/mail, private upload/retry and direct/anonymous/public/signed Storage bypass denials. No raw provider output is reflected in diagnostics. The assertion did not pass, so actual C02 acceptance stays OPEN. A meaningful local streaming regression reproduced a separate blocking bug: size rejection awaited transport cancellation even when cancellation never settled. Cancellation is now best effort before the 413 response; that test failed before and passes after the fix. It is not assumed to be the complete explanation for the provider result. The next owned provider run will distinguish fixed transport/HTTP failure categories without logging response bodies or arbitrary error text.

| Criterion | Executed local behavior | Remaining acceptance |
|---|---|---|
| DOS-M1-012-C01 | Entered/unverified profile, explicit doctor/clinic context and attributed administrative timeline in EN/AR | Exact-head independent review |
| DOS-M1-012-C02 | Actual SQL denial matrix and private configuration; bounded MIME/size/name/hash handler tests; private browser flows; real-provider upload and bypass denials reached | Actual provider oversized/cross-practice checks and complete job success |
| DOS-M1-012-C03 | Immutable uploader/time/clinic versions, replacement/archive/history, current access and six real transaction races; stale-confirmation CAS | Complete actual-provider history/revocation run and exact-head review |
| DOS-M1-012-C04 | Entered and uploaded-unreviewed labels; strict decoders reject verified/reviewed claims; no findings or interpretation | Exact-head independent review |

M1 remains incomplete. Realtime and broader real Auth recovery/PKCE coverage are not supplied by this job, and DOS-M1-014 still owns appointment/location reference preservation. Clinical/legal/catalogue/provider authority remains gated.

Final local UI checkpoint: the full root suite passes **1,747 tests**, with **23 optional infrastructure skips** after the streaming-cancellation regression. Task file/profile/diagnostic coverage plus shared preview lifecycle totals **26 focused tests**. The fresh Doctor build and four document browser journeys pass after the archive-confirmation fix. The actual-provider job must still pass on the published candidate; its oversized assertion is not treated as accepted by the local cancellation test.

Provider transport follow-up: the cancellation fix did not establish the real oversized assertion; its recheck reported a fixed transport-failure category. The owned acceptance fixture now uses an HTTP Continue client that retains an actually parsed early response while a body is being written. Four real loopback HTTP tests pass: early 413 without body, 413 after body consumption, a 200 control that remains a success (and therefore fails size acceptance), and remote/ambiguous target rejection. The provider test still requires **HTTP 413**, never a socket error or missing response. No raw CLI line, response body or exception detail is printed.

A known file-access denial now immediately clears private metadata/history, selected file bytes and delivery availability before broader context reconciliation. A new controller regression passes. Root tests pass **1,752**, with the same **23 optional infrastructure skips**; fresh Doctor build/typecheck/lint and four focused document journeys pass for this follow-up. Actual provider acceptance remains open pending the next exact-head job.
