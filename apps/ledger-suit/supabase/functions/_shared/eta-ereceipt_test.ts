// deno-lint-ignore-file no-import-prefix require-await
import { assertEquals, assertRejects } from "jsr:@std/assert@1";
import {
  etaReceiptAccessToken,
  EtaReceiptTransportError,
  resetEtaReceiptTokenForTest,
  signEtaReceiptBatch,
  submitEtaReceiptBatch,
} from "./eta-ereceipt.ts";

const originalFetch = globalThis.fetch;

function configure(): void {
  Deno.env.set("ETA_ERECEIPT_CLIENT_ID", "client");
  Deno.env.set("ETA_ERECEIPT_CLIENT_SECRET", "secret");
  Deno.env.set("ETA_ERECEIPT_POS_SERIAL", "POS-1");
  Deno.env.set("ETA_ERECEIPT_POS_OS_VERSION", "linux");
  Deno.env.set("ETA_ERECEIPT_POS_MODEL_FRAMEWORK", "1");
  Deno.env.set("ETA_ERECEIPT_POS_PRESHARED_KEY", "pre-shared");
  Deno.env.set("ETA_ERECEIPT_BATCH_SIGNER_URL", "https://signer.test/sign");
  Deno.env.set("ETA_ERECEIPT_BATCH_SIGNER_TOKEN", "signer-token");
  Deno.env.delete("ETA_ERECEIPT_API_BASE_URL");
  Deno.env.delete("ETA_ERECEIPT_IDENTITY_URL");
  resetEtaReceiptTokenForTest();
}

Deno.test("eReceipt uses POS authentication headers", async () => {
  configure();
  globalThis.fetch = async (_input, init) => {
    const requestInit = init as unknown as {
      headers: Record<string, string>;
    };
    const headers = requestInit.headers;
    assertEquals(headers.posserial, "POS-1");
    assertEquals(headers.presharedkey, "pre-shared");
    return new Response(
      JSON.stringify({ access_token: "token", expires_in: 3600 }),
      { status: 200 },
    );
  };
  try {
    assertEquals(await etaReceiptAccessToken(), "token");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

Deno.test("eReceipt signer signs the batch with receipt signature names", async () => {
  configure();
  globalThis.fetch = async (_input, init) => {
    const requestInit = init as unknown as { body: string };
    const body = JSON.parse(requestInit.body);
    assertEquals(body.batch.receipts[0].header.uuid, "a".repeat(64));
    return new Response(JSON.stringify({ signature: "fixture-cades-bes" }), {
      status: 200,
    });
  };
  try {
    const signed = await signEtaReceiptBatch({
      header: { uuid: "a".repeat(64) },
    });
    assertEquals(signed.signatures, [{
      signatureType: "I",
      value: "fixture-cades-bes",
    }]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

Deno.test("eReceipt submission retries ETA throttling", async () => {
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
      () => submitEtaReceiptBatch({ receipts: [], signatures: [] }),
      EtaReceiptTransportError,
      "slow down",
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

Deno.test("eReceipt production identity fails closed", async () => {
  configure();
  Deno.env.set(
    "ETA_ERECEIPT_IDENTITY_URL",
    "https://id.eta.gov.eg/connect/token",
  );
  try {
    await assertRejects(
      () => etaReceiptAccessToken(),
      Error,
      "ETA_ERECEIPT_PRODUCTION_NOT_AUTHORIZED",
    );
  } finally {
    Deno.env.delete("ETA_ERECEIPT_IDENTITY_URL");
  }
});
