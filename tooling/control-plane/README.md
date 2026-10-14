
### Operator-only verifier reacceptance of a failed execution

`runner/reaccept-verifier-probe.mjs <context.json> <passing-probe.json>` calls
`control.reaccept_verifier_only` after checking current Git object hashes.
The context contains the original execution and an exact human
`verifier_reacceptance_authorized` task event: execution ID, attempt, original
held run ID, exact verifier test paths and the complete mandatory check-name
set from the historical probe. Load the existing control database routing
before invoking it. It neither runs implementation nor reserves an attempt.

All required checks must actually pass, including every original failed check.
Product source objects and the base revision must remain unchanged. The SQL
function independently checks authorization, latest-execution/run ownership,
mandatory results and product source lineage, then appends a formal verification
run/results without changing the original failed execution, historical failure
records or retry policies. It is idempotent for the same approval. It does not
release maintenance or authorize publication. A real product defect must use
the ordinary authorized product-repair path; this mechanism cannot accept it.
