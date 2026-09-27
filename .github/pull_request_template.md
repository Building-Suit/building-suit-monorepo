Describe the concrete change and resulting behavior.

- Owning app(s)/shared packages:
- Stack key and parent PR (or note that this is the stack's only active `stg` root):
- Dependency and merge order (or independent feature):
- Verification performed and results:
- Deployment/database impact, if any:

Before publishing or resuming: run `pnpm agent:preflight`, inspect manual merges and existing worktrees, and reuse the current feature PR for adjustments. New feature PRs target the open parent in the same `codex/<stack>/*` stack; different stacks may each have one root targeting `stg`. See [the branch workflow](../docs/shared/git-workflow.md).
