import {
  adminClient,
  authenticatedClient,
  handleOptions,
  json,
  readJson,
  requiredEnv,
} from "../_shared/http.ts";
import {
  assignEtaReceiptUuid,
  buildEtaReceipt,
  parseEtaReceiptAction,
} from "../_shared/eta-ereceipt-contract.ts";
import {
  EtaReceiptTransportError,
  pollEtaReceiptSubmission,
  signEtaReceiptBatch,
  submitEtaReceiptBatch,
} from "../_shared/eta-ereceipt.ts";

type JsonRecord = Record<string, unknown>;

function firstRecord(value: unknown): JsonRecord | null {
  return Array.isArray(value) && value[0] && typeof value[0] === "object"
    ? value[0] as JsonRecord
    : null;
}

function errorDetails(value: unknown): { code: string; message: string } {
  if (!value || typeof value !== "object") {
    return {
      code: "ETA_ERECEIPT_REJECTED",
      message: "ETA rejected the receipt",
    };
  }
  const error = value as JsonRecord;
  return {
    code: typeof error.code === "string" ? error.code : "ETA_ERECEIPT_REJECTED",
    message: typeof error.message === "string"
      ? error.message
      : "ETA rejected the receipt",
  };
}

async function recordResult(args: JsonRecord): Promise<void> {
  const { error } = await adminClient().rpc(
    "record_eta_ereceipt_preproduction_result",
    args,
  );
  if (error) throw error;
}

function publicMessage(error: unknown): string {
  const message = error instanceof Error
    ? error.message
    : "ETA eReceipt request failed";
  if (
    message.startsWith("Missing server secret:") ||
    message.includes("ETA_ERECEIPT_SIGNER")
  ) {
    return "ETA eReceipt preproduction POS credentials or batch signing are not configured.";
  }
  return message.slice(0, 1000);
}

Deno.serve(async (request) => {
  const preflight = handleOptions(request);
  if (preflight) return preflight;

  let organizationId: string | null = null;
  let documentId: string | null = null;
  let mayRecordResult = false;
  try {
    const action = parseEtaReceiptAction(await readJson<unknown>(request));
    organizationId = action.organizationId;
    documentId = action.documentId;
    const userClient = await authenticatedClient(request);

    if (action.action === "submit") {
      const { data, error } = await userClient.rpc(
        "request_eta_ereceipt_preproduction_submission",
        { p_organization_id: organizationId, p_document_id: documentId },
      );
      if (error) throw error;
      mayRecordResult = true;
      const receipt = await assignEtaReceiptUuid(buildEtaReceipt(data));
      const seller = receipt.seller as JsonRecord;
      if (seller.rin !== requiredEnv("ETA_ERECEIPT_ISSUER_RIN")) {
        throw new Error(
          "ETA_ERECEIPT_ISSUER_MISMATCH: server taxpayer does not match the source snapshot",
        );
      }
      if (
        seller.deviceSerialNumber !==
          requiredEnv("ETA_ERECEIPT_POS_SERIAL")
      ) {
        throw new Error(
          "ETA_ERECEIPT_DEVICE_MISMATCH: server POS does not match the source snapshot",
        );
      }
      const receiptUuid = (receipt.header as JsonRecord).uuid as string;
      await recordResult({
        p_organization_id: organizationId,
        p_document_id: documentId,
        p_status: "signing",
        p_eta_receipt_uuid: receiptUuid,
      });
      const batch = await signEtaReceiptBatch(receipt);
      const result = await submitEtaReceiptBatch(batch);
      const submissionUuid = result.submissionUUID as string;
      const rejected = firstRecord(result.rejectedDocuments);
      if (rejected) {
        const details = errorDetails(rejected.error);
        await recordResult({
          p_organization_id: organizationId,
          p_document_id: documentId,
          p_status: "rejected",
          p_submission_uuid: submissionUuid,
          p_eta_receipt_uuid: receiptUuid,
          p_error_code: details.code,
          p_error_message: details.message,
          p_provider_payload: result,
        });
        return json({
          status: "rejected",
          submissionUuid,
          error: details.message,
        }, 422);
      }
      const accepted = firstRecord(result.acceptedDocuments);
      if (!accepted || accepted.uuid !== receiptUuid) {
        throw new Error(
          "ETA accepted-receipt response is incomplete or mismatched",
        );
      }
      await recordResult({
        p_organization_id: organizationId,
        p_document_id: documentId,
        p_status: "submitted",
        p_submission_uuid: submissionUuid,
        p_eta_receipt_uuid: receiptUuid,
        p_eta_long_id: typeof accepted.longId === "string"
          ? accepted.longId
          : null,
        p_provider_payload: result,
      });
      return json({ status: "submitted", submissionUuid, receiptUuid }, 202);
    }

    const { data: context, error } = await userClient.rpc(
      "read_eta_ereceipt_preproduction_submission",
      { p_organization_id: organizationId, p_document_id: documentId },
    );
    if (error) throw error;
    const state = context as JsonRecord;
    if (typeof state.submissionUuid !== "string") {
      throw new Error("ETA eReceipt has not been submitted");
    }
    mayRecordResult = true;
    const result = await pollEtaReceiptSubmission(state.submissionUuid);
    const summary = firstRecord(result.receipts);
    const providerStatus = typeof summary?.status === "string"
      ? summary.status.toLowerCase()
      : typeof result.status === "string"
      ? result.status.toLowerCase()
      : "inprogress";
    const status = providerStatus === "valid" || providerStatus === "invalid" ||
        providerStatus === "cancelled"
      ? providerStatus
      : "processing";
    await recordResult({
      p_organization_id: organizationId,
      p_document_id: documentId,
      p_status: status,
      p_submission_uuid: state.submissionUuid,
      p_eta_receipt_uuid: state.etaReceiptUuid,
      p_eta_long_id: typeof summary?.longId === "string"
        ? summary.longId
        : null,
      p_provider_payload: result,
    });
    return json({
      status,
      submissionUuid: state.submissionUuid,
      receiptUuid: state.etaReceiptUuid,
    });
  } catch (error) {
    if (organizationId && documentId && mayRecordResult) {
      const transport = error instanceof EtaReceiptTransportError
        ? error
        : null;
      try {
        await recordResult({
          p_organization_id: organizationId,
          p_document_id: documentId,
          p_status: transport?.retryable ? "retry_wait" : "failed",
          p_error_code: transport
            ? "ETA_ERECEIPT_TRANSPORT_ERROR"
            : "ETA_ERECEIPT_LOCAL_VALIDATION_ERROR",
          p_error_message: publicMessage(error),
          p_retry_after_seconds: transport?.retryAfterSeconds ?? null,
        });
      } catch {
        // Keep the original failure when no claimed delivery row can transition.
      }
    }
    return json(
      { error: publicMessage(error) },
      error instanceof EtaReceiptTransportError && error.retryable ? 503 : 400,
    );
  }
});
