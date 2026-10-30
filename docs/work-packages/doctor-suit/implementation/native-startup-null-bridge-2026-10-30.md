# Native startup: preserve the missing-WebView fallback

Requested audit: DOCTOR-NATIVE-STARTUP-NULL-BRIDGE-AUDIT-20261030. This does not renumber the canonical 104 tasks. Local parent is PR522/head94b45d75bc2fb5acb8ec1632dd579c2b31545c5e. PR522 retains its own qualification slot; this correction is separate and unpublished at this checkpoint.

## Demonstrated defect

The pinned Capacitor Android8.5.3 `BridgeActivity.onCreate` catches a WebView layout-inflation exception, displays its existing `no_webview` fallback and returns before `load()` creates the bridge. Doctor's `MainActivity.onCreate` then unconditionally dereferenced `getBridge().getWebView()`. Its later `onStop` already allowed an absent bridge/WebView. The startup dereference is therefore unsafe under an actual upstream lifecycle contract.

The correction retains secure-window and response-cache policy initialization, then applies the existing WebView cache policy only when that WebView exists. It introduces no retry, relaunch, delay, session, permission, private-data admission or replacement UI. The upstream fallback remains a failure to satisfy the original Doctor shell assertions; preventing a secondary null dereference does not turn unavailable WebView initialization into accepted readiness.

## Bounded before/after evidence

`apps/doctor-suit/tests/helpers/native-startup-boundary.py` compiles the actual `MainActivity.java` with small JVM boundary doubles using the existing JDK compiler module. It does not install/use an Android SDK, emulator, browser, provider or service. It is an explicit diagnostic command, not a new Java prerequisite for ordinary root unit tests.

On the original class (SHA256 `85b0be3cdeab7547ce6c8e56eb8b6c87c610e774022da791b04a49a8461482e1`), absent-bridge and absent-WebView inputs both throw a null dereference; the normal-WebView control passes. The probe exits1. On the guarded class (SHA256 `d1b5a25944e86dd911d20cb30cb636fdf9408ba13d5fdb37e207ed41c6b39bb6`), all three cases pass, retaining secure-window, disabled response cache, existing-WebView no-cache and safe stop/cache clearing; the probe exits0. These are JVM unit/protocol outcomes, not native acceptance.

To reproduce from the repository with a JDK containing `jdk.compiler`, preserve the original class in a separate scratch file using `git show 94b45d75bc2fb5acb8ec1632dd579c2b31545c5e:apps/doctor-suit/mobile/doctor/android/app/src/main/java/com/buildingsuit/doctor/synthetic/MainActivity.java`. Run the helper with that file and label `before` (expected exit1), then with the current MainActivity path and label `after` (expected exit0). Safe results are written under `.local/doctor-native-startup/`. The helper does not invoke the guarded Android runtime scripts or claim platform qualification.

The owned native policy suite adds `absent-bridge-cache-policy-safe`: call the null-boundary helper inside the real installed activity and verify the existing WebView cache, secure window and response-cache protections remain intact. This is an additional sixth policy case, not a replacement for any of the original five or any launch/navigation/lifecycle case. The candidate reader requires the complete current population; original five-case receipts remain retained with their original sources and cannot certify this changed candidate.

Local evidence includes143 passing focused M4/launch tests (including18 narrow launch/receipt cases), a full root regression of2738 tests/2715 passed/zero failed/23 skipped, scoped lint, unchanged80 migrations/149 full route templates with zero debt, and the controlled JVM before/after results. The exact JVM content bindings and outcomes are retained in `native-startup-null-bridge-2026-10-30-unit.json`. Actual Android API29/API36 execution of the new regression, full candidate checks and post-merge qualification remain unrun. No physical-device, clinical, offline-data, signing/distribution or release acceptance is inferred.

## Historical failure remains separate

Protected run41050302028/job124045703258 on staging2af2cdb1 failed API29 cold-launch-signed-out. Its launch command completed with exit0/startReported=true; failure foreground was known and non-synthetic, without visible Doctor/WebView cues. Those observations do not prove that WebView inflation failed or that this null dereference occurred. A passing new candidate would not retroactively establish that cause. The failed receipt, different-APK passing control and unchanged original deadlines/assertions remain preserved. No blind rerun is performed.
