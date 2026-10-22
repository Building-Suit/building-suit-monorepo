# Doctor data development

Root and owning app AGENTS apply. This is the Doctor-only CLI root. Hosted catalog identities and the owner-authorized 2026-10-22 access-only migrations are recorded in the environment map and database runbook. Runtime bindings remain user-managed; real-patient fixtures, clinical activation and other hosted changes need their own authorization. Local lifecycle commands must remain local even when hosted refs are registered.

- Use forward migrations created with the pinned CLI. Preserve applied history.
- Business objects belong in public, with explicit grants and RLS. Privileged implementation belongs in doctor_private with empty search paths and explicit actor/context authorization.
- Identity, doctor-owned practice, location and independently invited membership remain distinct. No email/phone matching or editable metadata grants authority.
- Direct client writes are denied. Authorized atomic commands supply version/idempotency and append actor-attributed audit. Never grant clinical signing through administrative permissions.
- Test only disposable local Doctor data. Review the environment map, local-only lifecycle and fixture URL guard before execution. Never reset a hosted database or use another product's session/project.
