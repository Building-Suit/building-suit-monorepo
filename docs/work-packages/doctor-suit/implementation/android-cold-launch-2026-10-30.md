# Owned Android cold-launch observation — 2026-10-30

Requested engineering audit `DOCTOR-ANDROID-COLD-LAUNCH-AUDIT-20261030`; this does not renumber the 104 canonical tasks or complete DOS-M4 native/domain acceptance. Parent staging is `80cfbb1b90f543b643b869261a6043fdb1139ac7`, after PR520. No active Doctor parent remains; this is a separate Doctor root into staging.

## Evidence and gap

Automatic Android run [41037396506](https://github.com/Building-Suit/building-suit-monorepo/actions/runs/41037396506), API29 job124002457808, failed `cold-launch-signed-out`. The receipt had no signed-out/practice cues, no visible WebView/synthetic package and no classified client issue. Build, API36, owned cleanup, seven vault cases and five online-policy cases passed. The four later shell cases were unrun. Early emulator connection warnings did not prevent boot or app verification; setup-only failure is unproven.

Protected run [41037388712](https://github.com/Building-Suit/building-suit-monorepo/actions/runs/41037388712), API29 job124002811125, passed all five shell cases on the same source and stock WebView74. Its separately built APK hash differs. This is not identical-binary proof and does not establish the failed launch's cause. The original failed receipt cannot distinguish activity-manager rejection, another foreground activity, or an app foregrounded without rendered shell readiness.

## Bounded source delta

The runner retains the original cold-launch command result privately and projects only fixed booleans plus a bounded exit code. Stdout and failure stderr inspection is capped at8192 characters per stream; no intent, URL, component name, raw error, token or log text is emitted. Command completion and `Starting: Intent` are explicitly distinct from foreground or UI readiness. On an already-decided failure only, one read of current activity state uses the existing redacted foreground parser before cleanup. This observation describes that instant, not the preceding readiness interval. Unavailable/ambiguous reads remain unknown.

Original command arguments, single launch, five cases, readiness deadlines, polling intervals, assertions, cleanup and acceptance expression remain unchanged. There is no added `-W`, launch retry, readiness wait, emulator reset, or product behavior repair. The consistency reader permits historical receipts without these optional diagnostics; supplied diagnostics must have the fixed shape, and a launch failure or failure-foreground observation cannot certify a passing receipt. Tests cover rejection/unknown states, bounded redaction and that consistency boundary.

## Qualification and limits

Local checks use pinned Node26.8.1/pnpm10.33.0 and frozen dependencies. Pure parser/lifecycle/candidate tests and source preservation checks are appropriate here; actual APK/emulator acceptance remains owned GitHub execution only. No SDK or Doctor runtime is installed/launched in this executor. Exact candidate CI and any new reproduction outcome must be reported separately; prepared diagnostics are not a repaired historical failure. The screenshot capture recurrence remains a distinct unresolved browser issue, recorded on PR520. No hosted provider, physical-device, clinical, legal, signing/store or production authority is granted.

Before publication: frozen offline installation, root setup and separate mobile prepare completed; 142 M4/parser unit tests passed (including33 focused launch/lifecycle/candidate tests), changed-file lint passed in the owning Doctor app, and `pnpm check` passed with80 preserved migrations and149 complete route templates/zero debt. An AST comparison against the parent preserved all30 original action calls, three wait expressions, two deadlines, the five-case population and the receipt acceptance expression. An initial fixture default-argument error and import placement error were corrected before this qualification; neither changed product behavior. Exact-parent and default release checks run on the committed candidate are required before pushing.
