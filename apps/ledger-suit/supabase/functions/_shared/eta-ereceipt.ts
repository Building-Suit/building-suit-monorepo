import { requiredEnv } from "./env.ts";

type JsonRecord = Record<string, unknown>;

export class EtaReceiptTransportError extends Error {
  constructor(
    message: string,
    readonly retryable: boolean,
    readonly retryAfterSeconds?: number,
  ) {
    super(message);
  }
}

let cachedToken: { value: string; expiresAt: number } | null = null;

function apiBase(): string {
  const value = (Deno.env.get("ETA_ERECEIPT_API_BASE_URL") ??
    "https://api.preprod.invoicing.eta.gov.eg").replace(/\/$/, "");
  if (value !== "https://api.preprod.invoicing.eta.gov.eg") {
    throw new Error(
      "ETA_ERECEIPT_PRODUCTION_NOT_AUTHORIZED: only the official preproduction API is allowed",
    );
  }
  return value;
}

function identityUrl(): string {
  const value = Deno.env.get("ETA_ERECEIPT_IDENTITY_URL") ??
    "https://id.preprod.eta.gov.eg/connect/token";
  if (value !== "https://id.preprod.eta.gov.eg/connect/token") {
    throw new Error(
      "ETA_ERECEIPT_PRODUCTION_NOT_AUTHORIZED: only the official preproduction identity service is allowed",
    );
  }
  return value;
}

async function responseJson(response: Response): Promise<JsonRecord> {
  return await response.json().catch(() => ({})) as JsonRecord;
}

function providerMessage(payload: JsonRecord, fallback: string): string {
  for (
    const value of [payload.error_description, payload.message, payload.error]
  ) {
    if (typeof value === "string" && value) return value;
  }
  return fallback;
}

function retryAfter(response: Response): number | undefined {
  const value = response.headers.get("Retry-After");
  return value && /^\d+$/.test(value)
    ? Math.min(Number(value), 3600)
    : undefined;
}

export async function etaReceiptAccessToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) {
    return cachedToken.value;
  }
  const response = await fetch(identityUrl(), {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      posserial: requiredEnv("ETA_ERECEIPT_POS_SERIAL"),
      pososversion: requiredEnv("ETA_ERECEIPT_POS_OS_VERSION"),
      posmodelframework: requiredEnv("ETA_ERECEIPT_POS_MODEL_FRAMEWORK"),
      presharedkey: requiredEnv("ETA_ERECEIPT_POS_PRESHARED_KEY"),
    },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      client_id: requiredEnv("ETA_ERECEIPT_CLIENT_ID"),
      client_secret: requiredEnv("ETA_ERECEIPT_CLIENT_SECRET"),
    }),
  });
  const payload = await responseJson(response);
  if (!response.ok || typeof payload.access_token !== "string") {
    throw new EtaReceiptTransportError(
      providerMessage(
        payload,
        `ETA eReceipt authentication failed (${response.status})`,
      ),
      response.status >= 500,
    );
  }
  const expiresIn = typeof payload.expires_in === "number" &&
      Number.isFinite(payload.expires_in)
    ? Math.max(60, Math.min(payload.expires_in, 3600))
    : 3600;
  cachedToken = {
    value: payload.access_token,
    expiresAt: Date.now() + expiresIn * 1000,
  };
  return cachedToken.value;
}

export async function signEtaReceiptBatch(
  receipt: JsonRecord,
): Promise<JsonRecord> {
  const signerUrl = requiredEnv("ETA_ERECEIPT_BATCH_SIGNER_URL");
  if (new URL(signerUrl).protocol !== "https:") {
    throw new Error("ETA_ERECEIPT_SIGNER_INVALID: signer must use HTTPS");
  }
  const batch = { receipts: [receipt] };
  const response = await fetch(signerUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${requiredEnv("ETA_ERECEIPT_BATCH_SIGNER_TOKEN")}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ batch }),
  });
  const payload = await responseJson(response);
  if (
    !response.ok || typeof payload.signature !== "string" || !payload.signature
  ) {
    throw new EtaReceiptTransportError(
      providerMessage(
        payload,
        `ETA eReceipt batch signer failed (${response.status})`,
      ),
      response.status >= 500,
    );
  }
  return {
    ...batch,
    signatures: [{ signatureType: "I", value: payload.signature }],
  };
}

async function etaApi(
  path: string,
  init: RequestInit,
): Promise<{ payload: JsonRecord; response: Response }> {
  const token = await etaReceiptAccessToken();
  const response = await fetch(`${apiBase()}${path}`, {
    ...init,
    headers: {
      Accept: "application/json",
      "Accept-Language": "en",
      Authorization: `Bearer ${token}`,
      ...(init.headers ?? {}),
    },
  });
  const payload = await responseJson(response);
  if (!response.ok) {
    if (response.status === 401) cachedToken = null;
    const duplicateDelay = response.status === 422 &&
      payload.code === "DuplicateSubmission";
    throw new EtaReceiptTransportError(
      providerMessage(
        payload,
        `ETA eReceipt request failed (${response.status})`,
      ),
      response.status === 408 || response.status === 429 ||
        response.status >= 500 || duplicateDelay,
      retryAfter(response),
    );
  }
  return { payload, response };
}

export async function submitEtaReceiptBatch(
  batch: JsonRecord,
): Promise<JsonRecord> {
  const { payload, response } = await etaApi("/api/v1/receiptsubmissions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(batch),
  });
  if (response.status !== 202 || typeof payload.submissionUUID !== "string") {
    throw new EtaReceiptTransportError(
      "ETA eReceipt submission response is incomplete",
      false,
    );
  }
  return payload;
}

export async function pollEtaReceiptSubmission(
  submissionUuid: string,
): Promise<JsonRecord> {
  if (!/^[A-Za-z0-9]{1,64}$/.test(submissionUuid)) {
    throw new Error("ETA eReceipt submission identifier is invalid");
  }
  const { payload } = await etaApi(
    `/api/v1/receiptsubmissions/${submissionUuid}/details?PageNo=1&PageSize=1`,
    { method: "GET" },
  );
  return payload;
}

export function resetEtaReceiptTokenForTest(): void {
  cachedToken = null;
}
