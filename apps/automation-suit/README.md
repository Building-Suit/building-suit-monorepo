# Automation Suit dashboard

Nuxt operations dashboard for the generic Automation Suit control plane. The initial UI is evidence-first; state-aware recovery commands are copyable for deliberate operator execution.

## Local data source

For the current workstation setup, the dashboard reads the existing local Automation Suit control-plane PostgreSQL service on `127.0.0.1:54329` through the dedicated `bs_dashboard_reader` role.

The service's existing runtime secrets remain in:

```text
/home/tareq/Services/building-suit-monorepo-plane/.env
```

The dashboard stores its dedicated reader connection in `apps/automation-suit/.env` and never exposes it to the browser. Project/policy writes are disabled unless a separate `NUXT_CONTROL_OPERATOR_DATABASE_URL` writer connection is configured; keep that URL server-only and restrict the dashboard behind its required authentication.

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
- a validated project registration wizard and retry-policy editor when the operator writer is configured

## Safety

Normal dashboard reads use the transaction-read-only role created by `sql/001_dashboard_reader.sql`. The optional operator connection is isolated from the browser and only powers validated, audited project and retry-policy saves. Task lifecycle changes continue through the generic CLI and backend transition functions.

See `INSTALLATION.md` in the ZIP root for the exact local setup commands.
