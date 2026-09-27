import { requiredEnv } from "./env.ts";

type JsonRecord = Record<string, unknown>;

export class EtaTransportError extends Error {
  constructor(
    message: string,
    readonly retryable: boolean,
    readonly retryAfterSeconds?: number,
  ) {
    super(message);
  }
}

let cachedToken: { value: string; expiresAt: number } | null = null;

function preproductionBase(): string {
  const value = (Deno.env.get("ETA_API_BASE_URL") ??
    "https://api.preprod.invoicing.eta.gov.eg").replace(/\/$/, "");
  if (value !== "https://api.preprod.invoicing.eta.gov.eg") {
    throw new Error(
      "ETA_PRODUCTION_NOT_AUTHORIZED: only the official preproduction API is allowed",
    );
  }
  return value;
}

function identityUrl(): string {
  const value = Deno.env.get("ETA_IDENTITY_URL") ??
    "https://id.preprod.eta.gov.eg/connect/token";
  if (value !== "https://id.preprod.eta.gov.eg/connect/token") {
    throw new Error(
      "ETA_PRODUCTION_NOT_AUTHORIZED: only the official preproduction identity service is allowed",
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
  if (!value || !/^\d+$/.test(value)) return undefined;
  return Math.min(Number(value), 3600);
}

export async function etaAccessToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) {
    return cachedToken.value;
  }
  const credentials = btoa(
    `${requiredEnv("ETA_CLIENT_ID")}:${requiredEnv("ETA_CLIENT_SECRET")}`,
  );
  const response = await fetch(identityUrl(), {
    method: "POST",
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      scope: "InvoicingAPI",
    }),
  });
  const payload = await responseJson(response);
  if (!response.ok || typeof payload.access_token !== "string") {
    throw new EtaTransportError(
      providerMessage(
        payload,
        `ETA authentication failed (${response.status})`,
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

export async function signEtaDocument(
  document: JsonRecord,
): Promise<JsonRecord> {
  const signerUrl = requiredEnv("ETA_SIGNER_URL");
  const parsed = new URL(signerUrl);
  if (parsed.protocol !== "https:") {
    throw new Error("ETA_SIGNER_INVALID: signer must use HTTPS");
  }
  const response = await fetch(signerUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${requiredEnv("ETA_SIGNER_TOKEN")}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ document }),
  });
  const payload = await responseJson(response);
  if (
    !response.ok || typeof payload.signature !== "string" || !payload.signature
  ) {
    throw new EtaTransportError(
      providerMessage(payload, `ETA signer failed (${response.status})`),
      response.status >= 500,
    );
  }
  return { ...document, signatures: [{ type: "I", value: payload.signature }] };
}

async function etaApi(
  path: string,
  init: RequestInit,
): Promise<{ payload: JsonRecord; response: Response }> {
  const token = await etaAccessToken();
  const response = await fetch(`${preproductionBase()}${path}`, {
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
    const isDuplicateDelay = response.status === 422 &&
      payload.code === "DuplicateSubmission";
    throw new EtaTransportError(
      providerMessage(payload, `ETA request failed (${response.status})`),
      response.status === 408 || response.status === 429 ||
        response.status >= 500 || isDuplicateDelay,
      retryAfter(response),
    );
  }
  return { payload, response };
}

export async function submitEtaDocument(
  document: JsonRecord,
): Promise<JsonRecord> {
  const { payload, response } = await etaApi("/api/v1.0/documentsubmissions/", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ documents: [document] }),
  });
  if (response.status !== 202 || typeof payload.submissionUUID !== "string") {
    throw new EtaTransportError("ETA submission response is incomplete", false);
  }
  return payload;
}

export async function pollEtaSubmission(
  submissionUuid: string,
): Promise<JsonRecord> {
  if (!/^[A-Za-z0-9]{1,64}$/.test(submissionUuid)) {
    throw new Error("ETA submission identifier is invalid");
  }
  const { payload } = await etaApi(
    `/api/v1.0/documentsubmissions/${submissionUuid}?pageNo=1&pageSize=1`,
    {
      method: "GET",
    },
  );
  return payload;
}

export function resetEtaTokenForTest(): void {
  cachedToken = null;
}
