export interface PaymobPlan {
  id: number;
  name: string;
  frequency: number;
  amount_cents: number;
  integration: number;
  use_transaction_amount: boolean;
  is_active: boolean;
  webhook_url: string | null;
}

export interface PlanSpec {
  envName: string;
  name: string;
  frequency: 30 | 360;
  amountCents: number;
}

export const planSpecs: readonly PlanSpec[] = [
  {
    envName: "PAYMOB_SOLO_MONTHLY_PLAN_ID",
    name: "Ledger Suit Solo Monthly",
    frequency: 30,
    amountCents: 39900,
  },
  {
    envName: "PAYMOB_SOLO_YEARLY_PLAN_ID",
    name: "Ledger Suit Solo Yearly",
    frequency: 360,
    amountCents: 325584,
  },
  {
    envName: "PAYMOB_STARTER_MONTHLY_PLAN_ID",
    name: "Ledger Suit Starter Monthly",
    frequency: 30,
    amountCents: 59900,
  },
  {
    envName: "PAYMOB_STARTER_YEARLY_PLAN_ID",
    name: "Ledger Suit Starter Yearly",
    frequency: 360,
    amountCents: 488784,
  },
  {
    envName: "PAYMOB_BUSINESS_MONTHLY_PLAN_ID",
    name: "Ledger Suit Business Monthly",
    frequency: 30,
    amountCents: 109900,
  },
  {
    envName: "PAYMOB_BUSINESS_YEARLY_PLAN_ID",
    name: "Ledger Suit Business Yearly",
    frequency: 360,
    amountCents: 896784,
  },
];

function requiredEnv(name: string): string {
  const value = Deno.env.get(name)?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
}

function positiveInteger(name: string): number {
  const value = Number(requiredEnv(name));
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new Error(`${name} must be a positive integer`);
  }
  return value;
}

function webhookUrl(args: string[]): string {
  const argument = args.find((value) => value.startsWith("--webhook-url="))
    ?.slice("--webhook-url=".length);
  if (!argument) {
    throw new Error(
      "Pass the deployed callback as --webhook-url=https://<project-ref>.supabase.co/functions/v1/paymob-webhook",
    );
  }
  const url = new URL(argument);
  if (
    url.protocol !== "https:" ||
    !url.pathname.endsWith("/functions/v1/paymob-webhook")
  ) {
    throw new Error(
      "The webhook URL must be HTTPS and end with /functions/v1/paymob-webhook",
    );
  }
  return url.toString();
}

async function responseJson<T>(response: Response): Promise<T> {
  const payload = await response.json().catch(() => ({})) as Record<
    string,
    unknown
  >;
  if (!response.ok) {
    const message = payload.detail ?? payload.message ??
      `Paymob request failed (${response.status})`;
    throw new Error(
      typeof message === "string" ? message : JSON.stringify(message),
    );
  }
  return payload as T;
}

async function authToken(baseUrl: string, apiKey: string): Promise<string> {
  const response = await fetch(`${baseUrl}/api/auth/tokens`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ api_key: apiKey }),
  });
  const payload = await responseJson<{ token?: string }>(response);
  if (!payload.token) {
    throw new Error("Paymob authentication did not return a token");
  }
  return payload.token;
}

async function listPlans(
  baseUrl: string,
  token: string,
): Promise<PaymobPlan[]> {
  const plans: PaymobPlan[] = [];
  let next: string | null = `${baseUrl}/api/acceptance/subscription-plans`;
  while (next) {
    const response: Response = await fetch(next, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const page: { results?: PaymobPlan[]; next?: string | null } =
      await responseJson(response);
    plans.push(...(page.results ?? []));
    next = page.next ?? null;
  }
  return plans;
}

export function matchesPlan(
  plan: PaymobPlan,
  spec: PlanSpec,
  motoIntegrationId: number,
  callbackUrl: string,
): boolean {
  return plan.frequency === spec.frequency &&
    plan.amount_cents === spec.amountCents &&
    plan.integration === motoIntegrationId &&
    plan.use_transaction_amount === true &&
    plan.is_active === true &&
    plan.webhook_url === callbackUrl;
}

async function ensurePlan(
  baseUrl: string,
  token: string,
  plans: PaymobPlan[],
  spec: PlanSpec,
  motoIntegrationId: number,
  callbackUrl: string,
  verifyOnly: boolean,
): Promise<PaymobPlan> {
  const namedPlans = plans.filter((plan) => plan.name === spec.name);
  if (namedPlans.length > 1) {
    throw new Error(
      `${spec.name} has duplicate provider plans; resolve them in Paymob before charging customers`,
    );
  }
  const existing = namedPlans[0];
  if (existing && matchesPlan(existing, spec, motoIntegrationId, callbackUrl)) {
    return existing;
  }
  if (existing) {
    throw new Error(
      `${spec.name} exists with different billing settings; review it in Paymob instead of creating a duplicate`,
    );
  }
  if (verifyOnly) {
    throw new Error(`${spec.name} is missing from the Paymob merchant account`);
  }

  const response = await fetch(`${baseUrl}/api/acceptance/subscription-plans`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      frequency: spec.frequency,
      name: spec.name,
      webhook_url: callbackUrl,
      plan_type: "rent",
      number_of_deductions: null,
      amount_cents: spec.amountCents,
      use_transaction_amount: true,
      is_active: true,
      integration: motoIntegrationId,
    }),
  });
  return await responseJson<PaymobPlan>(response);
}

async function main(): Promise<void> {
  const unknownArguments = Deno.args.filter((value) =>
    value !== "--verify-only" && !value.startsWith("--webhook-url=")
  );
  if (unknownArguments.length) {
    throw new Error(`Unknown argument: ${unknownArguments[0]}`);
  }

  const baseUrl =
    (Deno.env.get("PAYMOB_BASE_URL")?.trim() || "https://accept.paymob.com")
      .replace(/\/$/, "");
  const apiKey = requiredEnv("PAYMOB_API_KEY");
  const motoIntegrationId = positiveInteger("PAYMOB_MOTO_INTEGRATION_ID");
  const callbackUrl = webhookUrl(Deno.args);
  const verifyOnly = Deno.args.includes("--verify-only");
  const token = await authToken(baseUrl, apiKey);
  const plans = await listPlans(baseUrl, token);
  const readyPlans = [];
  for (const spec of planSpecs) {
    readyPlans.push({
      spec,
      plan: await ensurePlan(
        baseUrl,
        token,
        plans,
        spec,
        motoIntegrationId,
        callbackUrl,
        verifyOnly,
      ),
    });
  }

  console.log(
    verifyOnly
      ? "Paymob subscription plans match the Ledger Suit contract:"
      : "Paymob subscription plans are ready:",
  );
  for (const { spec, plan } of readyPlans) {
    console.log(`${spec.envName}="${plan.id}"`);
  }
}

if (import.meta.main) await main();
