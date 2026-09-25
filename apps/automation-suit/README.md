# Automation Suit dashboard

Nuxt operations dashboard for the generic Automation Suit control plane. The initial UI is evidence-first; state-aware recovery commands are copyable for deliberate operator execution.

## Local data source

For the current workstation setup, the dashboard reads the existing local Automation Suit control-plane PostgreSQL service on `127.0.0.1:54329` through the dedicated `bs_dashboard_reader` role.

The service's existing runtime secrets remain in:

```text
/home/tareq/Services/building-suit-monorepo-plane/.env
```

The dashboard itself stores only its dedicated reader connection in `apps/automation-suit/.env` and never exposes that connection to the browser.

Browser -> Nuxt/Nitro -> `bs_dashboard_reader` -> control-plane PostgreSQL `control` schema.

## What it shows

- registered projects, workstreams and backward-compatible Suits
- workflow runs
- runner/Codex executions
- verification evidence
- decisions/blockers
- pull-request/publication state
- task event timeline and raw diagnostic payloads
- incident/recovery queue for failed, blocked, stale, verification, publication and retry cases
- optional n8n runtime observations with explicit control-plane/runtime mismatch detection
- inherited retry policies and exact per-attempt profiles
- live verification check lifecycle
- task detail, structured failures and diagnostic prompt generation
- read-only normalized n8n workflow snapshots

## Safety

The dashboard database role created by `sql/001_dashboard_reader.sql` is transaction-read-only. Deliberate state changes use the generic CLI, whose backend functions validate transitions and create audit evidence.

See `INSTALLATION.md` in the ZIP root for the exact local setup commands.
