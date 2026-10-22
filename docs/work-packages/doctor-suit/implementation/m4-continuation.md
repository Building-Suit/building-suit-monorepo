# Doctor M4 continuation

The owner requested milestone continuation after the dashboard/branding feature. New work starts from published Doctor leaf PR435, `a438c2b59359c1bf6345664fee3362a2e3176437`. Shop/Ledger branding is independent on the shared stack and is not copied into the Doctor parent.

M4 task001 is published for review in PR438 and has a concrete platform/distribution decision packet in dos-m4-001.md and dos-m4-001-decision-packet.json. It compares the current web/PWA path, a hybrid wrapper and a genuinely native renderer, with reserved paths, existing verification commands and missing device/signing/cost evidence. The owner explicitly selected Android first as its own app inside the monorepo on 2026-10-22. The updated packet recommends a distinct Capacitor8.5.3/Nuxt mobile package at the reserved root and names the required workspace/command registration. Framework/renderer, exact device/distribution/cost and clinical offline approvals remain OPEN; the platform answer alone is not those approvals.

M4 tasks002–010 depend on this decision and both platform/offline gates. Their canonical IDs, dependency graph, decisions and fingerprints remain unchanged. Do not create a scaffold, install a framework or create store/signing resources before approved evidence. Mobile clinical acceptance also retains M2-014's qualified gate.

M3 external provider delivery remains disabled and its actual-service acceptance remains OPEN. Focused capacity observation still finds the 32GiB executor using Docker vfs and no running project; the previously failed full Supabase extraction is not blindly repeated. No hosted connection, live-schema refresh, real-patient use, provider activation, Automation mutation or main/staging promotion is authorized.

Use one separate PR per implemented milestone task. Task001 is a reviewable evidence packet with blocked acceptance, not a completed mobile milestone.

Preview the existing Doctor runtime from this worktree with `pnpm dev:doctor --worktree codex/doctor-suit/m4-001-platform-decision`. Pinning the Doctor source avoids selecting the independently active shared-brand worktree, whose Doctor app still comes from staging. Shop/Ledger branding remains on PR437; the separate feature worktrees are not implicitly combined.

## Android shell continuation — 2026-10-22

The earlier platform-only hold above is historical. The following contextual continuation permits only the documented partial synthetic shell engineering; the independent qualified, offline and distribution gates remain open.

The owner explicitly selected Android first and a separate monorepo app. PR438 retains the platform/device/distribution packet; its concrete Capacitor/shared-screen proposal was followed by “Continue them please”. DOS-M4-002 records contextual technical authorization for that synthetic shell. No explicit widget answer, qualified clinical/offline approval or distribution decision is fabricated.

The current Doctor leaf is [PR446](https://github.com/Building-Suit/building-suit-monorepo/pull/446), `codex/doctor-suit/m4-002-android-shell`, parent [PR442](https://github.com/Building-Suit/building-suit-monorepo/pull/442). The parent checkpoint70e20a9e721d7804ea21fdc24abf27bfe47c1acd is merged with history preserved. Read `dos-m4-002.md`, its verification/device JSON records and `m3-acceptance-ci.md` before resuming. Refresh preflight/live GitHub; do not infer current acceptance from a historical receipt.

The separate client package is `apps/doctor-suit/mobile/doctor`, `@building-suit/doctor-mobile`. It uses pinned Capacitor8.5.3/shared Nuxt/Vue, root workspace/lockfile, strict shared templates and versioned synthetic context contracts. It currently has no native sign-in adapter, persistent Auth token, private patient/chart data, offline replay or provider transport. Task003 owns secure native session work; task009 owns only an explicitly approved offline policy. DOS-M4-001, M2-014, physical-device, qualified clinical/offline and store/release gates remain open. This is partial shell engineering under the documented dependency amendment; canonical packets are unchanged.

The focused Android workflow compiles a debug APK and checks exact-head/digest-bound API29/API36 emulators. The service workflow retains all SQL/browser/provider/shared checks. First sourcec08fc8b0 stopped during Android SDK setup before compilation; devices were skipped. Device receipts do not count a skipped job, generic browser viewport or merely signed-out screen as a successful native journey. Source/unit/boundary/type/static builds are local; Android/browser/provider runtime belongs to owned GitHub CI. Read the exact run before selecting a fix.

Historical full repository unit baseline atc08fc8b0: 2,203 tests, 2,126 pass, 54 inherited Shop failures, 23 skipped. New parent fixes add three passing regressions; the full suite was not repeated simply to update that historical count. Required CI still blocks staging integration. No real patients, hosted migrations, provider activation, Automation mutation, release signing/store upload, deployment or staging/main promotion is authorized by this continuation.
