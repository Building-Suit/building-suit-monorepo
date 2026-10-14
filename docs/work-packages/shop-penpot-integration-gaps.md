# Shop cloud integration readiness and remaining gaps

This checkpoint evaluates Shop draft #270 (`30175c1340c85611e60e4635b25d3e519b955faa`) and the validation-only follow-up. It does not mark the requested full design matrix complete.

The exact 33-route inventory, immutable main IDs, required states/dialogs, supplied pixel scope and route-specific implementation/verification assessment are maintained in `shop-penpot-cloud-coverage.json`. Every record remains `fullDesignMatrixComplete: false`. The frozen handoff has five PNGs (shell, approved dashboard, touch POS, product uploader, service uploader); other routes have metadata without comparable pixels. Prior shell/dashboard/POS comparison claims remain attributed to their original checkpoints rather than being recast as new cloud comparison evidence. Product/service references are cropped dialogs, and image transport browser tests are synthetic.

## Validation corrections

The inventory denial regression now locates the canonical state surface's `status` role, while retaining exact denial text and absence of unauthorized actions/false empty data. Only error state surfaces use `alert`; no runtime accessibility behavior changed.

The shared dashboard regression now checks the approved Shop inactive surface button against the card surface and requires the active surface to differ. It retains selected-state, hover contrast >=4.5, responsive navigation, panel geometry and page-overflow assertions. The approved Shop variant intentionally uses bordered default buttons rather than inherited transparent chips; no production styles changed for this checkpoint.

## Media readiness

The five existing compatibility unit tests pass: an absent optional RPC permits legacy reads and media-free saves; media additions and explicit removals fail closed; permission, validation and network errors never cause a legacy retry. This checks adapter behavior, not hosted tenant authorization.

The optional media migration remains prepared and unapplied. The cloud-only disposable Supabase attempt failed while unpacking the Postgres image with `failed to register layer: no space left on device`; no containers started and no SQL fixtures ran. Real Storage/auth/save and tenant-isolation SQL assertions remain unrun. Do not interpret mocked upload tests, build success or these compatibility tests as hosted readiness. No repeated pulls, global cleanup, user services or hosted fallback were used.

## Integration and staging consequences

Parent reports SAS #269/#271 provisioning work incomplete. Wait for the completed SAS checkpoint before forming the authorized combined integration PR and rerunning required checks on its actual final head. Preserve SAS debt-manifest removals and Shop entries during conflict resolution. Individual stack PRs remain drafts; no merge or consolidation is performed here.

Repository Vercel configuration enables deployment for `stg` and `main`, with other branches disabled. Read-only Vercel inspection confirms Shop, Ledger and Super Admin staging projects and staging domains. The app response omits Git production-branch/root-directory settings, so the exact provider automatic-deployment behavior is not fully verified. CI contains verification commands and no automatic hosted migration command; Supabase provider branch automation remains unverified. A normal authorized `stg` merge may trigger provider deployment. No explicit deployment, provider/secret change, hosted migration or main promotion is authorized by this checkpoint.

## Aggregate checks

At the Shop #270 code head plus these test/documentation corrections: `pnpm test` passed 1,328 cases with 23 explicitly gated skips; all six app typechecks passed; `pnpm check` passed. Root lint had zero errors and one inherited SAS attribute-order warning, left with its owning task. Changed test sources passed ESLint with `--no-ignore`.

The initial concurrent build exited 137 in Super Admin Suit. `pnpm exec turbo run build --concurrency=1` then built all six apps successfully. `pnpm test:built-assets` passed one brand production-artifact check. Final `pnpm test:e2e` passed 111 foundation cases with one explicitly initialized-backend skip, then all 18 shared regressions. The earlier failed assertions and their successful focused/shared reruns are recorded rather than hidden. No production source changed after the successful builds/typechecks/unit/lint checks.

These are cloud-local aggregate results, not the final combined Shop+SAS head gates. CI review/branch-policy results must be checked on the published validation commit, and the eventual combined integration PR must run all required final-head gates independently.
