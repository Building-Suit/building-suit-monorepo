# Agent guidance review — local structure, 2026-09-19

Reviewed the root `AGENTS.md`, scoped rules for all three apps, UI and Supabase, and `docs/agent-workflows.md` against the implemented workspace.

- Active rules describe ordinary future development, maintenance, testing and releases. They do not require repeating source copying, repository conversion or this task's table-relocation restrictions.
- App navigation matches actual `app/pages`, `app/composables`, `app/components`, `app/types` and `app/utils` ownership. No empty feature-layer scaffolding is required.
- Shared UI, token, interaction, identity and data boundaries name existing packages and their current responsibilities. Rules require verifying deployed state rather than assuming the target database architecture is live.
- Workflow commands match root scripts. The new-platform command exists and its generated app passed prepare, typecheck and build; the temporary verification app was removed afterward.
- Database guidance points to `docs/shared/database.md` and the environment registry. No nonexistent automatic deployment workflow is claimed.
- Root and per-app READMEs use current workspace paths/commands. Standalone setup/deployment instructions and provider-link metadata are archived as source evidence.
- Original Building instructions remain under the documentation app's `reference/agent-guidance`; the docs app rules explicitly distinguish these from active agent instructions.
- Rules require relevant checks, accurate reporting of unrun work, preservation of unrelated edits, and stopping when the requested scope is complete.

The hosted identity/schema work remains incomplete. Review affected environment/API/session references again when those already-planned work packages are implemented; this does not add a new roadmap.
