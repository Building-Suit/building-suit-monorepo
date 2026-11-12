# Part 2: existing employees work together

Scope: existing staff, internal tasks only. No new tools, hiring, customer contact,
providers, or extra Oracle workers. This is not completion of Skills/MCPs.

## Reused contracts

The existing database queue already owns FIFO ordering (`created_at,id`), completed
`depends_on` handoffs, immutable delivery receipts, task delegation and department/
CEO review. The employee-active unique index prevents two jobs for one employee.
Worker journals preserve at-most-once inference after uncertain outcomes.

## Narrow change

The old worker and claim path admitted only one job globally. A new authenticated
claim RPC opts into a fixed cap of two independent employees. Legacy claim callers
remain serial. Qualification, admission fences, task context and review wrappers
are retained. There is no caller-selected unbounded capacity.

The host claims serially and overlaps only leased execution. It stops admitting
new work on pause/failure, settles every already-started execution before leaving
the durable in-flight scope, and never retries inference. Staffing and Brain
publication stay outside the parallel pool. Completed jobs are removed from the
local active set before another claim so a quick employee can take the next job.

## Acceptance

- Two independent employees overlap, never exceeding two active jobs.
- A busy employee cannot take its next job; another idle employee can work.
- A dependent reviewer waits for its prerequisite to complete.
- Steve's existing review/delivery flow remains unchanged.
- Duplicate delivery and failed lease behavior remain unchanged.
- Pause/failure settles active jobs without a new claim or lost durable marker.
- Legacy worker runs with one active job; old release can still pass byte checks.

Local mocked tests are not hosted acceptance. Deployment and a small internal HQ
run must be verified separately before marking Part 2 complete. No external
customer messages are part of the acceptance run.
