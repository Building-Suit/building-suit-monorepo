# SS-WEB-LAUNCH-001

Qualification draft stacked on reviewed PR339 at `e009102b448062602496e11978a2aad60717c2fd`. Includes a history-preserving merge of already reviewed staging `ff568402698a1a79703d323db8b59f39e10bf0c0`; does not merge into staging or alter any parent. Parent owns the eventual single combined website integration.

The [launch checklist](../../apps/shop-suit/docs/website-launch-checklist.md) maps every repository acceptance criterion to database, built HTTP and browser evidence, and distinguishes implemented, synthetic verified, provider configured, deployed and actual production smoke states. BS-CHANGELOG-VERSION-001 hosted BASELINE_PIN remains a separate prerequisite blocker documented by PR338; no baseline controls, release machinery or hosted data were changed. The previously prohibited public booking scope is superseded only by explicitly authorized/reviewed SS-APPT-002; ecommerce remains absent.

Adds a composed two-tenant fixture, production-built adversarial journey, twelve EN/AR light/dark phone/tablet/desktop keyboard journeys, and one disposable CI gate combining the unchanged full Shop operational/financial regression with all seven website SQL suites and existing feature browser/HTTP suites. Public changelog UI uses a synthetic public release contract; reader unit tests and disposable SAS replay retain their independent real adapter contracts. No origin allowlist or permission boundary is relaxed.

No application presentation, design tokens, registered templates, database schema, provider setting or customer publication changes. No new migration, manual deployment, external message or main promotion. The requested official frontend-design guidance was read for the stack; qualification preserves its existing shared-template Manrope/IBM Plex Sans Arabic design and AR/EN behavior.

Local thin PostgreSQL verifies actual website SQL including atomic races; full provider migration/history and maintained Shop regression intentionally remain CI-only. Exact-head results are recorded in the draft PR, with failed/unrun prerequisites remaining explicit.

The first full CI replay correctly failed on the historical bootstrap fixture (`PLAN_UNAVAILABLE`): unlike the maintained account-provisioning gate, the launch job had not prepared the legacy catalog before migrations. The launch job now reuses that existing CI-only baseline preparer and permission seed. The temporary migration/config edits exist only on the disposable runner and are removed after regression; no historical source migration, product behavior or test assertion is changed.

The corrected full provider/Shop matrix, typecheck, lint, build, six built HTTP suites and all preceding browser suites passed in CI. Four maintained changelog feed cases then exposed shallow checkout missing the preserved bootstrap tree. Launch CI now uses full history, matching the existing changelog gate, and retains failure artifacts. No release reader/fixture assertions are changed.
