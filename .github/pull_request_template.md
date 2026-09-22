Describe the concrete change and resulting behavior.

- Owning app(s)/shared packages:
- Parent PR / active staging batch (link; only one open PR may target `stg`):
- Dependency and merge order (or independent feature):
- Verification performed and results:
- Deployment/database impact, if any:

Before publishing or resuming: run `pnpm agent:preflight`, inspect manual merges and existing worktrees, and reuse the current feature PR for adjustments. New feature PRs target their parent/active batch branch. See [the branch workflow](../docs/shared/git-workflow.md).
