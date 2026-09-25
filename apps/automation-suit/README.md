# Automation Suit dashboard

Read-only Nuxt operations dashboard for the Building Suit Automation Suit control plane.

## Local data source

For the current workstation setup, the dashboard reads the existing local Automation Suit control-plane PostgreSQL service on `127.0.0.1:54329` through the dedicated `bs_dashboard_reader` role.

The service's existing runtime secrets remain in:

```text
/home/tareq/Services/building-suit-monorepo-plane/.env
```

The dashboard itself stores only its dedicated reader connection in `apps/automation-suit/.env` and never exposes that connection to the browser.

Browser -> Nuxt/Nitro -> `bs_dashboard_reader` -> control-plane PostgreSQL `control` schema.

## What it shows

- Suits and task progress
- workflow runs
- runner/Codex executions
- verification evidence
- decisions/blockers
- pull-request/publication state
- task event timeline and raw diagnostic payloads
- incident/recovery queue for failed, blocked, stale, verification, publication and retry cases
- optional n8n runtime observations with explicit control-plane/runtime mismatch detection

## Safety

The dashboard has no mutation API. The database role created by `sql/001_dashboard_reader.sql` is transaction-read-only and has SELECT access only.

See `INSTALLATION.md` in the ZIP root for the exact local setup commands.
