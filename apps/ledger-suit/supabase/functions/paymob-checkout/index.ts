import {
  authenticatedClient,
  handleOptions,
  json,
  publicError,
  readJson,
} from "../_shared/http.ts";
import {
  assertCheckoutAccessState,
  parseCheckoutRequest,
} from "../_shared/paymob-checkout-contract.ts";

// New subscriptions use the existing quoted/manual evidence-and-review flow.
// Keep the authenticated endpoint closed to enrollment so old clients cannot
// bypass the current checkout UI. Historical HMAC callbacks remain separate.
Deno.serve(async (request) => {
  const preflight = handleOptions(request);
  if (preflight) return preflight;
  try {
    const { organizationId, planKey, interval } = parseCheckoutRequest(
      await readJson<unknown>(request),
    );
    const supabase = await authenticatedClient(request);
    const { data, error } = await supabase.rpc("billing_checkout_context", {
      p_organization_id: organizationId,
      p_plan_key: planKey,
      p_interval: interval,
    });
    if (error) throw error;
    const context = (data as { access_state: string }[] | null)?.[0];
    if (!context) throw new Error("Organization not found");
    assertCheckoutAccessState(context.access_state);
    return json({
      error:
        "Online checkout is unavailable. Use the current InstaPay payment instructions and manual review in Billing.",
    }, 410);
  } catch (error) {
    return json({ error: publicError(error) }, 400);
  }
});
