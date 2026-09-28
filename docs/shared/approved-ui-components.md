# Approved UI component inventory

Status: blocked — authoritative artifact unavailable  
Authority: `building_suit_ui_approved_final.zip`  
Expected component count: 63

This file is the single inventory destination required by the [Atomic Design implementation contract](atomic-design.md). It is intentionally not populated from historical catalogues, filenames guessed from product code or screenshots. At the time of LS-UI-001 implementation, the decision-recorded artifact path `/mnt/data/building_suit_ui_approved_final.zip` did not exist in the task environment, and no repository-local copy was available. Names, approval modes and artifact-to-code mappings therefore cannot be asserted safely.

When the authoritative ZIP is available, replace this blocked notice with exactly 63 rows using the columns below. Preserve artifact-relative paths exactly so reviewers can verify ZIP coverage. `Target implementation` must be a repository-relative `.vue` destination under `packages/ui/src/atoms`, `packages/ui/src/molecules` or `packages/ui/src/organisms`; this approved package does not assign product-local destinations.

| # | Approved component name | Approval mode | Approved HTML artifact | Target layer | Target implementation |
|---:|---|---|---|---|---|

Completion checks:

- Every HTML component artifact in the authoritative ZIP appears exactly once.
- There are exactly 63 component rows, with no inferred or duplicate names.
- Every approval mode is exactly `same` or `reference` and matches the package.
- Every target layer is exactly `atom`, `molecule` or `organism` and agrees with the destination directory.
- Molecules are mapped to compositions of shared atoms; organisms are mapped to compositions of shared molecules and atoms.
- No target points into Ledger Suit, Shop Suit or another application.
