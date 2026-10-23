# Doctor Suit Android client

The separate `@building-suit/doctor-mobile` workspace builds a bundled Capacitor Android client from the shared Nuxt/Vue presentation system. It belongs to Doctor Suit and uses the root pnpm workspace and lockfile. It does not create another operational Suit, backend or Auth project.

DOS-M4-002 currently provides synthetic navigation and access states only. Mobile sign-in remains unavailable until task003's reviewed native session adapter. No private records, persisted Auth tokens, offline commands or provider delivery are enabled. An emulator or static build does not establish qualified clinical, physical-device, offline or distribution acceptance. See the [implementation record](../../../../docs/work-packages/doctor-suit/implementation/dos-m4-002.md).

From the repository root, source preparation and validation are:

```sh
pnpm install --frozen-lockfile
pnpm run setup
pnpm --filter @building-suit/doctor-mobile typecheck
pnpm --filter @building-suit/doctor-mobile build
python3 apps/doctor-suit/mobile/doctor/scripts/android-brand.py
pnpm --filter @building-suit/doctor-mobile sync
node --test apps/doctor-suit/tests/unit/dos-m4-002.test.mjs tooling/checks/application-roots.test.mjs
pnpm check
```

The bundle is generated under `.output/public`; Capacitor copies it to ignored Android assets. The canonical Doctor mark is converted to Android vector paths without changing its geometry or colours. The Gradle distribution has a pinned checksum. Generated web assets, SDK paths, debug APKs, credentials and signing keys are excluded from Git.

The Doctor Android workflow owns debug APK compilation and Android API29/API36 emulator execution, using JDK21 and compile/target SDK36. It verifies cold launch, retained guarded deep links, hardware back, background/resume and rejection of unknown links against the exact source head and APK digest, retaining redacted receipts. Do not start Android SDKs, emulators, Doctor application acceptance browsers or backend services locally for this work. Required root/shared unit commands retain their existing isolated Shop receipt document browser cases against supplied reference assets; report these separately from Doctor runtime acceptance. The debug application ID is `com.buildingsuit.doctor.synthetic`; no store upload or release signing resource is configured.

Routes render complete shared Bs templates. The client has English/العربية, RTL, theme and brand infrastructure from the shared layer. Navigation allows only workspace, schedule and account. Every future authenticated context must match the current user, SID, Doctor, practice, clinic, local synthetic environment and supported contract version; portal selection alone grants no capability. Session/background/connectivity changes discard context, and stale reads cannot restore it. Native links carry no tokens, and no external navigation or provider endpoints are configured.

Current device evidence: sourcef29777d0/run40015081233 passes all five synthetic journeys on API29/WebView74 and API36/WebView133 against the same exact-head/APK digest, with fresh accessibility hierarchies and successful cleanup. Historical failures remain in the device packet. This does not establish physical-device, visual/accessibility, clinical/offline/distribution or full task acceptance.

The mobile-only Vite compilation target is `chrome74`, matching the stock engine observed in the mandatory API29 job. It constrains generated syntax; it does not polyfill newer runtime APIs or prove old-engine CSS/layout compatibility. Both native jobs remain mandatory; sourcef29777d0 supplies the first passing exact-head emulator matrix. Qualified platform acceptance remains open.

An eager pre-plugin imports pinned `core-js/actual` for standard APIs used by the compiled shared runtime (including array indexing, own-property checks and string replacement). The isolated unit regression restores missing APIs and checks edge semantics. This is app-specific and leaves the existing workspace dependency graph intact; it still requires the exact APK/device journey checks and does not qualify older-engine CSS or physical-device behavior.

DOS-M4-003 adds native session engineering: email-first sign-in and account use the canonical shared templates, entered-code recovery extends the shared recovery form, and credentials persist only as Keystore-encrypted no-backup ciphertext. Every foreground restore and periodic/expiry check revalidates the provider user and server SID; unchanged checks preserve drafts and failed/revoked/expired scope clears protected state. Native bridge logging is disabled. Default builds stay disconnected.

For an explicitly owned local synthetic target only, provide DOCTOR_MOBILE_SYNTHETIC_API (Doctor port65321), DOCTOR_MOBILE_ACCOUNT_ORIGIN (Doctor web port3006 or owned actual-service port4342) and DOCTOR_MOBILE_PUBLISHABLE_KEY at build time. Blank, hosted, wrong-port, privileged-key or unmatched marker/account-server configurations fail closed. The web server keeps its existing email-lookup secret server-side; no privileged key enters this bundle. Debug networking accepts only loopback/emulator hosts; release cleartext stays disabled. Use .test credential addresses only. Native provider/device/security/physical and clinical/offline/distribution acceptance remain separate pending obligations; read the003 records.

A later exact-sourcef655/run40017225361 retains a new API36 background/resume failure after three passing cases, while API29 passes allfive. The earlierf297 passing matrix remains historical evidence. The harness now requires an observed background foreground-transition before resuming once, plus a confirmed return to the owned activity; null/ambiguous transition state cannot pass. Fresh native CI is required before claiming this failure resolved.

DOS-M4-004 adds memory-only context selection using the existing server-authorized context RPCs and practices owner RLS. The shared workspace header selects doctor/practice/location and always shows current scope. Only local synthetic_preview context is supported; commercial candidate/clinical authority remains disabled. Unsaved edits require shared discard confirmation, and scope/session/connectivity changes clear protected state and reject stale requests. Native actual-service/device context acceptance remains pending.

DOS-M4-006 adds owner-scoped synthetic encounter creation and notes through the same shared clinical template and versioned APIs as web. Notes editing preserves the other snapshot sections. Explicit amendment drafts can be edited; finalized content remains immutable. Conflicts/unknown saves retain a read-only draft and cannot resend. Closing/discarding loads fresh server state; restart stores/replays no command or chart. Signing, releases, exports, files and live prescribing remain unavailable.

Native operation deadlines use AbortController and bounded owned timers, and command UUIDs use cryptographic getRandomValues. The registered stock WebView74 lacks newer AbortSignal static methods and crypto.randomUUID, which core-js/actual does not provide. An isolated missing-API reproduction now passes without global polyfills. This is runtime compatibility engineering, not physical-device, visual/CSS or native Auth-provider/clinical acceptance.
