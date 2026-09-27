// deno-lint-ignore-file no-import-prefix require-await
import { assertEquals, assertRejects } from "jsr:@std/assert@1";
import {
  etaAccessToken,
  EtaTransportError,
  resetEtaTokenForTest,
  signEtaDocument,
  submitEtaDocument,
} from "./eta-einvoice.ts";

const originalFetch = globalThis.fetch;

function configure(): void {
  Deno.env.set("ETA_CLIENT_ID", "test-client");
  Deno.env.set("ETA_CLIENT_SECRET", "test-secret");
  Deno.env.set("ETA_SIGNER_URL", "https://signer.test/sign");
  Deno.env.set("ETA_SIGNER_TOKEN", "signer-token");
  Deno.env.delete("ETA_API_BASE_URL");
  Deno.env.delete("ETA_IDENTITY_URL");
  resetEtaTokenForTest();
}

Deno.test("ETA signer returns only the server signature boundary", async () => {
  configure();
  globalThis.fetch = async (_input, init) => {
    const requestInit = init as unknown as { headers?: Record<string, string> };
    assertEquals(requestInit.headers?.Authorization, "Bearer signer-token");
    return new Response(JSON.stringify({ signature: "fixture-cades-bes" }), {
      status: 200,
    });
  };
  try {
    const signed = await signEtaDocument({
      internalId: "INV-1",
      totalAmount: 114,
    });
    assertEquals(signed, {
      internalId: "INV-1",
      totalAmount: 114,
      signatures: [{ type: "I", value: "fixture-cades-bes" }],
    });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

Deno.test("ETA transport caches OAuth and accepts only a 202 asynchronous submission", async () => {
  configure();
  let tokenCalls = 0;
  let submissionCalls = 0;
  globalThis.fetch = async (input) => {
    const url = String(input);
    if (url.includes("/connect/token")) {
      tokenCalls++;
      return new Response(
        JSON.stringify({ access_token: "token", expires_in: 3600 }),
        { status: 200 },
      );
    }
    submissionCalls++;
    return new Response(
      JSON.stringify({
        submissionUUID: `SUBMISSION${submissionCalls}`,
        acceptedDocuments: [{
          internalId: "INV-1",
          uuid: `DOCUMENT${submissionCalls}`,
          longId: "LONG",
        }],
        rejectedDocuments: [],
      }),
      { status: 202 },
    );
  };
  try {
    assertEquals(
      (await submitEtaDocument({ internalId: "INV-1" })).submissionUUID,
      "SUBMISSION1",
    );
    assertEquals(
      (await submitEtaDocument({ internalId: "INV-1" })).submissionUUID,
      "SUBMISSION2",
    );
    assertEquals(tokenCalls, 1);
    assertEquals(submissionCalls, 2);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

Deno.test("ETA retry classification respects throttling and Retry-After", async () => {
  configure();
  let calls = 0;
  globalThis.fetch = async () => {
    calls++;
    if (calls === 1) {
      return new Response(
        JSON.stringify({ access_token: "token", expires_in: 3600 }),
        { status: 200 },
      );
    }
    return new Response(JSON.stringify({ message: "slow down" }), {
      status: 429,
      headers: { "Retry-After": "120" },
    });
  };
  try {
    await assertRejects(
      () => submitEtaDocument({ internalId: "INV-1" }),
      EtaTransportError,
      "slow down",
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

Deno.test("ETA production identity endpoint fails closed before authentication", async () => {
  configure();
  Deno.env.set("ETA_IDENTITY_URL", "https://id.eta.gov.eg/connect/token");
  try {
    await assertRejects(
      () => etaAccessToken(),
      Error,
      "ETA_PRODUCTION_NOT_AUTHORIZED",
    );
  } finally {
    Deno.env.delete("ETA_IDENTITY_URL");
  }
});
