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

The Doctor Android workflow owns debug APK compilation and Android API29/API36 emulator execution, using JDK21 and compile/target SDK36. It verifies cold launch, retained guarded deep links, hardware back, background/resume and rejection of unknown links against the exact source head and APK digest, retaining redacted receipts. Do not start Android SDKs, emulators, browsers or backend services locally for this work. The debug application ID is `com.buildingsuit.doctor.synthetic`; no store upload or release signing resource is configured.

Routes render complete shared Bs templates. The client has English/العربية, RTL, theme and brand infrastructure from the shared layer. Navigation allows only workspace, schedule and account. Every future authenticated context must match the current user, SID, Doctor, practice, clinic, local synthetic environment and supported contract version; portal selection alone grants no capability. Session/background/connectivity changes discard context, and stale reads cannot restore it. Native links carry no tokens, and no external navigation or provider endpoints are configured.
