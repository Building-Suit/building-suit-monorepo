# Supabase Flattening — `database/supabase/supabase` → `./supabase`

## Before

- The working tree had **no Supabase project at all** — the Supabase directory had been
  deleted in commit `9b7647a` ("chore: remove supabase directory ...", Jan 2026).
- Git history contained the real project at `database/supabase/supabase/`:
  - `config.toml` (project id, ports, auth redirect config)
  - `migrations/20251224154509_remote_schema.sql` (2,060 lines, snapshot of the hosted DB)
  - `.gitignore` (local dev artifacts)
- No `supabase/config.toml` existed at any other level, so there were **no collisions** to
  merge (per prompt §7.3 there was nothing to silently overwrite).

## After

Canonical CLI project rooted at `./supabase`:

```text
supabase/
├── config.toml                                  # recovered + adapted
├── migrations/
│   ├── 20251224154509_remote_schema.sql         # recovered, byte-identical content
│   └── 20260909000000_rebuild_alignment.sql     # NEW forward migration (see below)
├── tests/
│   └── db_smoke_test.sql                        # NEW psql assertion suite
└── .gitignore                                   # recovered
```

## Changes made to the recovered `config.toml`

Only what was required to run locally in this environment; identity values preserved:

1. `project_id = "shop-suit"` (was a placeholder).
2. Removed `studio.openai_api_key = env(OPENAI_API_KEY)` — it made `supabase start` fail
   locally when the variable is unset; Studio works without it.
3. Ports moved off the defaults because another Building Suit project (`ledger-suit`) was
   already running its own local stack on 54321–54327:
   - API `55321`, DB `55325`, Studio `55322`, Inbucket `55323`, pooler `55324`,
     analytics disabled-port `55326`, edge-runtime `55327`.
4. `[edge_runtime] enabled = false` — this project has **no Edge Functions** and the edge
   runtime health check hangs when the sandboxed environment blocks `deno.land`/`jsr.io`
   fetches. Re-enable when functions are added (documented in `config.toml` comment).

## Migration safety (§7.2)

- `20251224154509_remote_schema.sql` was **not** renamed, re-dated, reformatted, or merged.
- The new alignment migration uses a fresh timestamp (`20260909000000_`) after the
  historical one, so ordering is deterministic on any environment replaying history.

## Reference search (§7.4)

```bash
rg -n "supabase/supabase|supabase\\supabase" .
```

produces only the historical mention inside this documentation set (clearly labeled).

## Local commands (§7.5)

All standard commands now work from the repository root:

```bash
supabase start          # verified
supabase db reset       # verified
supabase status         # verified
```

No nested `cd supabase/supabase` or `--workdir` required.
