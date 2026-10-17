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
