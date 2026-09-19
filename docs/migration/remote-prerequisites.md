# Hosted completion prerequisites for the independent product pairs

This is a one-time setup record, not an ongoing agent workflow. ADR 0002 supersedes the previous shared database/SSO migration.

All four refs and application origins are now configured in the environment registry. The [Shop transfer record](shop-dedicated-projects.md) records a completed Production schema/scoped business-and-Auth copy and verified Staging schema. Original source data remains intact. Account roles and the requested shared CEO Owner arrangement still need verification against provider limits.

Remaining work is bounded:

1. Configure custom SMTP and OTP templates for the dedicated Shop projects; verify real email signup/recovery delivery.
2. Configure/deploy the apps at the recorded production/staging origins using their respective ignored environment files. Use an appropriate synthetic catalog and users for Shop staging browser checks.
3. Before production cutover, reconcile source changes since the recorded snapshot or use a bounded write freeze, verify data/authenticated journeys and execute the documented recovery/cutover procedure. Do not replay the empty-destination import into populated Production.
4. Verify the relevant Ledger environment/service settings independently when releasing Ledger changes. No account merging or Single Auth is required.

The latest source-code integration opens review PRs only. It does not redo the hosted transfer, send mail or switch application traffic. Full details and private-artifact locations are in the transfer record; credentials and customer payloads are never committed.
