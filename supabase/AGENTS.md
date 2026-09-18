# Database development

Read the root rules and the current environment map and API contracts before database work.

- Identify the target by immutable project ref. Local development uses the project ID and ports in this directory's config; do not infer a remote target from a display name or cached CLI link.
- Preserve applied SQL history. Authorized changes use new forward migrations created with the CLI, dependency review, relevant data handling and recovery verification.
- Keep product ownership and private/API boundaries explicit. Inspect actual deployed schemas before writing a query; documentation describes intent but does not prove deployment state.
- Preserve tenant/portal authorization, RLS, financial invariants and audit history. Review functions, views, grants, Storage and Realtime alongside table policies.
- Fix privileged search paths and qualify database objects. Never trust user-editable auth metadata for authorization.
- Database tests and fixtures run only in an explicitly disposable local environment or designated staging scope. Do not reset a hosted business database.
- Regenerate affected client types and update app adapters with API changes. Keep privileged credentials out of frontend packages and logs.
- Run deployment operations explicitly with a verified environment and serialized execution. Report exactly what was applied and tested.
