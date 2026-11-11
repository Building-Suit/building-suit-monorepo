# Recover the applied retirement migration source

## Verified origin and scope

HQ staging `dpruoncalmwicrqhqelu` records version `20261111013758`, named
`hq_retire_meetings_and_voice_greeting`, in
`supabase_migrations.schema_migrations`. At the 11 November 2026 read-only
inspection, its `statements` array contained one complete SQL statement. The
restored file is that decoded statement, including its final LF:

- Bytes: 11060; LF count: 177.
- MD5: `6991a79261ccf83eef863251d0d11583`.
- SHA-256: `06f92be9097abc12b585eb8ef1e51ae23b9bd3e0f343f55b7310565d66d9a8ef`.

All five function bodies created by that statement exactly matched the deployed
catalog. The private greeting table and RLS, renamed claim predecessor, absence
of the two obsolete meeting activity triggers, and denial of the four public
meeting RPCs to anon/authenticated/service_role also matched. No customer rows,
credentials or private Brain text are included in this source recovery.

The original author, application mechanism and Git commit are unproven. No
original file was found in inspected staging path history, visible HQ branch
heads or commit/PR searches. The ledger is the source of these recovered bytes;
it is not evidence of a Git origin or permission to execute the statement again.

## Why Git reconciliation is needed

At staging commit `562bafe8cbcc0d6c83652e8f9a0b9c1762ea98d6`, the applied version
was missing from the repository. Supabase's existing Git deployment reported
`Remote migration versions not found in local migrations directory` and stopped
before pending `20261111033000_hq_retail_assignment_context.sql`.

Restoring the exact historical filename and body allows the normal migration
history comparison to recognize the already-applied version. The intended
hosted result is to skip 13758, then apply pending 33000 once through the existing
Git integration. Do not repair/delete/reinsert ledger rows, use an empty source
placeholder, renumber either migration, manually execute retirement, or install
another deployer. The private parity checker performs no database operations.

The original 17-file baseline and all existing forward inventory entries remain
unchanged. A separate `recoveredAppliedMigrations` entry identifies this history
recovery. Its identity, exact source hashes and provenance shape are independently
pinned by the validator; editing both a file and its manifest hash cannot bless
different historical SQL. Tests reject changed bytes, CRLF conversion, missing or
duplicate entries, placeholders, altered project/source authority and invented
Git commits.

## First-application effects are real

This SQL is deliberately not idempotent. On a previously unmodified schema it
blocks queued meeting-linked work, ends active meetings, interrupts unplayed
contributions, revokes meeting RPC access, renames the existing claim entry point,
adds a queue-fenced retirement wrapper, and creates immutable private greeting
receipts with bounded founder-authorized greeting functions. Existing evidence
and running/completed jobs must remain truthful. These are not harmless no-op
effects on a clean or differently populated environment.

Version 20000 changes separate worker compatibility functions. Version 33000
changes the workforce enrichment helper, not the retirement wrapper. Source
inspection found no direct collision, but disposable execution must verify the
sequence, rollback and preservation assertions. Full provider services and real
hosted data are not reproduced by a synthetic fixture.

## Acceptance and rollout boundary

Local provenance/parity checks are executable without hosted access. PGlite
checks are preliminary. Native PostgreSQL tests must use an isolated database,
the actual installed Supabase CLI for history selection, and no hosted endpoint.
They must prove an already-recorded 13758 is not replayed, 33000 applies once,
clean prior-schema first-application effects are explicit, and failed application
rolls back without blessing history. Do not label a handwritten selection model
as Git integration acceptance.

Before any authorized merge, verify the current staging head and migration
history still match the reviewed inputs, native and complete CI pass, and the
existing HQ Git integration remains the sole deployment path. Repository config
enables migrations; it does not prove provider Automatic branching settings.
An authorized staging merge may unblock automatic application of 33000 and
other ordinary staging deployment/release workflows. Source preparation alone
does not authorize merge, provider changes, worker recovery or task replay.
