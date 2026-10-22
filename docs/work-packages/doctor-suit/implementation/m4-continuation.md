# Doctor M4 continuation

The owner requested milestone continuation after the dashboard/branding feature. New work starts from published Doctor leaf PR435, `a438c2b59359c1bf6345664fee3362a2e3176437`. Shop/Ledger branding is independent on the shared stack and is not copied into the Doctor parent.

M4 task001 is published for review in PR438 and has a concrete platform/distribution decision packet in dos-m4-001.md and dos-m4-001-decision-packet.json. It compares the current web/PWA path, a hybrid wrapper and a genuinely native renderer, with reserved paths, existing verification commands and missing device/signing/cost evidence. No platform is silently chosen. The owner's platform question remains pending.

M4 tasks002–010 depend on this decision and both platform/offline gates. Their canonical IDs, dependency graph, decisions and fingerprints remain unchanged. Do not create a scaffold, install a framework or create store/signing resources before approved evidence. Mobile clinical acceptance also retains M2-014's qualified gate.

M3 external provider delivery remains disabled and its actual-service acceptance remains OPEN. Focused capacity observation still finds the 32GiB executor using Docker vfs and no running project; the previously failed full Supabase extraction is not blindly repeated. No hosted connection, live-schema refresh, real-patient use, provider activation, Automation mutation or main/staging promotion is authorized.

Use one separate PR per implemented milestone task. Task001 is a reviewable evidence packet with blocked acceptance, not a completed mobile milestone.

Preview the existing Doctor runtime from this worktree with `pnpm dev:doctor --worktree codex/doctor-suit/m4-001-platform-decision`. Pinning the Doctor source avoids selecting the independently active shared-brand worktree, whose Doctor app still comes from staging. Shop/Ledger branding remains on PR437; the separate feature worktrees are not implicitly combined.
