# Native financial browser qualification — current source review

Task SS-ELEC-606 is open. This review follows capacity head9ec4eb87 on integrated81cdcc60. No hosted access, native reset, production payment or missing recovery reconstruction was attempted.

## Existing implementation, not a replacement

`apps/shop-suit/playwright.qualification.config.ts`, `tests/e2e/pilot-backend.ts`, `pilot-qualification.spec.ts` and `tests/pilot/local-backend.mjs` already provide a real-Auth pilot path. The helper creates random synthetic Auth users through GoTrue, obtains password sessions, uses actual public RPCs, and does not mock business responses. The20 discovered cases exercise a two-branch barber service journey, checkout_pos_sale, exact-request replay, receipt persistence, branch/role denial and reports. Trace/video are off. Discovery is not execution. These service cases do not by themselves establish the electrical measured/reel/weight merchant journey.

The separate `packages/testing/e2e/shop-backend.spec.ts` covers signup/catalog persistence and independent Ledger sessions, not the electrical financial journey. Do not mistake that suite or synthetic electrical RPC responses for the required gate.

## Precise current prerequisite

The fixed disposable native container `supabase_db_building-suit-shop` is absent (Docker inspect: No such container). No prepared Auth/PostgREST backend is available on the maintained fixed Shop loopback API127.0.0.1:61321. The existing CI legacy-baseline initializer additionally rejects this executor with `Requires GitHub Actions`; its admission function requires actual GitHub Actions, github-hosted and explicit disposable acknowledgment. Four existing admission/local-origin unit tests pass. The guard was evaluated without performing setup; no runner variables were spoofed and no alternate interface was used to bypass it.

Native execution is PENDING. Minimum executable prerequisite: a freshly initialized owned native Shop backend with current120 migrations and actual Auth/PostgREST, using the supported preparation path. The existing guarded CI route can supply that after Doctor then Ledger release the coordinated validation slot. Local pilot tools can use an already prepared fixed disposable backend; this review does not invent a blanket ban on all local pilot execution. About790MiB root disk was free, but no native startup was attempted and no out-of-space failure is claimed. Do not prune unrelated volumes or reset any held paid data to obtain space.

## Source repairs verified independently

The real-Auth helper still supplied obsolete create_owner_shop argument p_plan_slug=pro. Current generated contracts expose two-argument or six-argument creation, neither accepts a plan slug. The fixture now uses the existing two-argument plan-neutral trial authority; it does not select/modify a paid subscription or bypass quotas. Its login driver also used retired #login-email/#login-password and a single-step submit. It now follows the current email/Continue/password form, checks hydration readiness, waits for exactly one submit after the finite stage transition, and preserves dashboard/locale checks and existing command deadlines. No business API response is intercepted by the native helper.

Both EN/AR login-driver tests pass against the current built UI with explicitly synthetic transport. An initial English test exposed both transition buttons matching simultaneously; waiting for the existing unique-stage condition fixed that test driver. The complete2-case group passed after correction. This verifies the driver only, not real Auth or financial acceptance. Native20-case discovery passes without starting a server or requesting credentials. Broader native pilot selectors/role/paid-term assumptions still require actual execution; do not declare the entire older pilot repaired. Extend the native scenario for mixed electrical products, measured stock/FIFO, actual issuance/payment/receipts and tenant/location boundaries when the backend is available, using existing authorities rather than recreating missing atomic recovery.

## Independent electrical verification executed

`CHROMIUM_PATH=<owned cloud Chromium> playwright test -c apps/shop-suit/tests/e2e/measured-retail.config.ts` passed all48 cases, one worker, retries0, in3.8minutes on the current published application runtime. This covers measured cart/settings, physical reels/returns, trade prices/quotes/orders, reservation, deposits/partial fulfillment, supplier partial deliveries, supply planning, weight labels, scale/capture setup and commodity pricing, including EN/AR and existing error/retry/read-only guards. Those tests use synthetic RPC transport; they do not prove real Auth/financial RPCs or physical devices. They are distinct from the absent original recovery36-case group and its historical34/36 result. No assertions/deadlines were weakened, forced clicks introduced, cases skipped or retries used to hide failures.

Relevant logs, admission diagnosis and discovery output are stored alongside this record. A PR-only workflow is prepared for the synthetic login-driver regression; no competing CI was dispatched. Native execution, electrical real-Auth scenario completion, merchant/device/native-Arabic acceptance, payment eligibility, provider setup and catalog baseline remain genuine separate gates.
