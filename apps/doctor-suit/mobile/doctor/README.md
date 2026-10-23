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
