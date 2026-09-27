// Match the existing Edge Function test convention without adding app dependencies.
// deno-lint-ignore no-import-prefix
import { assertEquals, assertFalse } from "jsr:@std/assert@1";
import {
  matchesPlan,
  type PaymobPlan,
  planSpecs,
} from "../scripts/provision-paymob-plans.ts";

const expectedCatalog: Array<[string, number, number]> = [
  ["PAYMOB_SOLO_MONTHLY_PLAN_ID", 30, 39900],
  ["PAYMOB_SOLO_YEARLY_PLAN_ID", 360, 325584],
  ["PAYMOB_STARTER_MONTHLY_PLAN_ID", 30, 59900],
  ["PAYMOB_STARTER_YEARLY_PLAN_ID", 360, 488784],
  ["PAYMOB_BUSINESS_MONTHLY_PLAN_ID", 30, 109900],
  ["PAYMOB_BUSINESS_YEARLY_PLAN_ID", 360, 896784],
];

Deno.test("Paymob plan verifier uses the approved six-price 30/360-day catalog", () => {
  assertEquals(
    planSpecs.map((spec) => [spec.envName, spec.frequency, spec.amountCents]),
    expectedCatalog,
  );
});

Deno.test("Paymob plan verifier rejects every charge-relevant mismatch", () => {
  const spec = planSpecs[0]!;
  const callbackUrl =
    "https://ledger-test.supabase.co/functions/v1/paymob-webhook";
  const plan: PaymobPlan = {
    id: 42,
    name: spec.name,
    frequency: spec.frequency,
    amount_cents: spec.amountCents,
    integration: 9001,
    use_transaction_amount: true,
    is_active: true,
    webhook_url: callbackUrl,
  };
  assertEquals(matchesPlan(plan, spec, 9001, callbackUrl), true);
  assertFalse(
    matchesPlan({ ...plan, frequency: 360 }, spec, 9001, callbackUrl),
  );
  assertFalse(
    matchesPlan({ ...plan, amount_cents: 1 }, spec, 9001, callbackUrl),
  );
  assertFalse(
    matchesPlan({ ...plan, integration: 2 }, spec, 9001, callbackUrl),
  );
  assertFalse(
    matchesPlan(
      { ...plan, use_transaction_amount: false },
      spec,
      9001,
      callbackUrl,
    ),
  );
  assertFalse(
    matchesPlan({ ...plan, is_active: false }, spec, 9001, callbackUrl),
  );
  assertFalse(
    matchesPlan(
      { ...plan, webhook_url: "https://invalid.test" },
      spec,
      9001,
      callbackUrl,
    ),
  );
});
